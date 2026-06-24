import Stripe from 'stripe';
import { getSupabaseAdmin } from '../lib/supabase';
import { getPlans, getPlanFromPriceId } from '../config/plans';
import {
  getGeoTier,
  getPriceForTier,
  authoritativeTier,
  resolveChargeTier,
  tierAmount,
  type GeoTier,
  type PlanName,
} from '../config/geo-pricing';

// Shown on the Stripe checkout page when the card-country tier is pricier than
// the displayed (IP) tier, so an up-charge is never a silent bait-and-switch.
const RETIER_NOTICE =
  'Preis basiert auf dem Land deiner Zahlungsmethode. · ' +
  "Pricing is based on your payment method's country.";

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-06-20'
    });
  }
  return _stripe;
}

export async function createCheckoutSession(
  userId: string,
  targetPlan: string,
  countryCode?: string | null,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const stripe = getStripe();

  const { data: user, error } = await supabase
    .from('users')
    .select('email, stripe_customer_id')
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new Error('User not found');
  }

  const ipTier = getGeoTier(countryCode ?? null) as GeoTier;

  // Card country is authoritative. If this is a returning customer with a saved
  // payment method, we already know the card country → price the session at the
  // card tier up front, so the very first invoice is correct (no proration).
  // For new customers the card country is unknown until checkout completes; the
  // webhook reconciles to the card tier on checkout.session.completed.
  let cardCountry: string | null = null;
  if (user.stripe_customer_id) {
    try {
      const customer = await stripe.customers.retrieve(user.stripe_customer_id, {
        expand: ['invoice_settings.default_payment_method'],
      }) as Stripe.Customer;
      const pm = customer.invoice_settings?.default_payment_method as Stripe.PaymentMethod | null;
      cardCountry = pm?.card?.country ?? pm?.billing_details?.address?.country ?? null;
    } catch { /* unknown card country → fall back to IP tier */ }
  }

  const tier = authoritativeTier(cardCountry, ipTier);
  const priceId = getPriceForTier(targetPlan, tier) ?? getPlans()[targetPlan]?.stripePriceId;

  if (!priceId) {
    throw new Error(`No price configured for plan: ${targetPlan}`);
  }

  // Pricier than what the user saw → show the transparency notice on checkout.
  const reTieredUp = tier < ipTier;

  const session = await stripe.checkout.sessions.create({
    customer: user.stripe_customer_id ?? undefined,
    customer_email: !user.stripe_customer_id ? user.email : undefined,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    // Anti-VPN: collect billing address so the card/billing country (authoritative)
    // can be reconciled on checkout.session.completed for new customers.
    billing_address_collection: 'required',
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?canceled=true`,
    metadata: { userId, plan: targetPlan, geo_tier: String(tier), ip_tier: String(ipTier) },
    ...(reTieredUp ? { custom_text: { submit: { message: RETIER_NOTICE } } } : {}),
  });

  return session.url!;
}

// ──────────────────────────────────────────────────────────────────────────
// Elements / SetupIntent flow (2026-06-23 rebuild).
// Card issuing country (`paymentMethod.card.country`, BIN-derived) is the
// authoritative charge signal. The price is resolved BEFORE the charge and the
// subscription is created server-side at the resolved tier — no hosted-checkout
// up-front price lock, no webhook cheap-keep reconcile. A cheaper-than-displayed
// tier is granted ONLY on positive card-country confirmation (resolveChargeTier).
// ──────────────────────────────────────────────────────────────────────────

export interface ResolvedPrice {
  displayTier: GeoTier;   // IP-derived tier the user was shown
  resolvedTier: GeoTier;  // authoritative tier we will charge
  priceId: string;        // Stripe price id for plan × resolvedTier
  amount: number;         // dollars/mo at resolvedTier (== shown on pay button)
  currency: 'usd';
  differs: boolean;       // resolvedTier !== displayTier → surface the inline note
  cardCountry: string | null;
  note: { en: string; de: string } | null;
}

/** Ensure the user has a Stripe customer; create on first use. Returns the id. */
async function ensureStripeCustomer(userId: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const stripe = getStripe();

  const { data: user, error } = await supabase
    .from('users')
    .select('email, stripe_customer_id')
    .eq('id', userId)
    .single();
  if (error || !user) throw new Error('User not found');

  if (user.stripe_customer_id) return user.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    metadata: { userId },
  });
  await supabase.from('users').update({ stripe_customer_id: customer.id }).eq('id', userId);
  return customer.id;
}

/**
 * Create a SetupIntent so the client can collect + tokenize a card via Elements
 * without charging it yet. We read the resulting payment method's BIN country
 * afterwards to resolve the authoritative tier, then create the subscription.
 */
export async function createSetupIntent(
  userId: string,
): Promise<{ clientSecret: string; customerId: string }> {
  const stripe = getStripe();
  const customerId = await ensureStripeCustomer(userId);
  const intent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
    usage: 'off_session',
    metadata: { userId },
  });
  return { clientSecret: intent.client_secret!, customerId };
}

function reTierNote(amount: number): { en: string; de: string } {
  return {
    en: `Price set to your card's country: $${amount}/mo`,
    de: `Preis für dein Kartenland: $${amount}/Monat`,
  };
}

/**
 * Resolve the price a checkout will be charged at, from the card's issuing
 * country. Pure read — does NOT charge. The returned `amount` is exactly what
 * the pay button must show; the subscription is later created at `priceId`.
 */
export async function resolveCheckoutPrice(
  targetPlan: PlanName,
  paymentMethodId: string | null,
  ipCountry: string | null,
): Promise<ResolvedPrice> {
  const stripe = getStripe();

  // Read the BIN-derived issuing country (authoritative). Never a typed address.
  let cardCountry: string | null = null;
  if (paymentMethodId) {
    try {
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
      cardCountry = pm.card?.country ?? null;
    } catch {
      cardCountry = null; // unreadable → fail-safe falls through to IP/T1
    }
  }

  const displayTier = getGeoTier(ipCountry);
  const resolvedTier = resolveChargeTier(cardCountry, ipCountry);
  const priceId = getPriceForTier(targetPlan, resolvedTier);
  if (!priceId) throw new Error(`No price configured for plan: ${targetPlan}`);

  const amount = tierAmount(targetPlan, resolvedTier);
  const differs = resolvedTier !== displayTier;

  return {
    displayTier,
    resolvedTier,
    priceId,
    amount,
    currency: 'usd',
    differs,
    cardCountry,
    note: differs ? reTierNote(amount) : null,
  };
}

export type CreateSubscriptionResult =
  | { ok: true; plan: string; tier: GeoTier; amount: number; subscriptionId: string; status: string }
  | { ok: false; needsReconfirm: true; resolved: ResolvedPrice };

/**
 * Create the subscription server-side at the authoritative (card-country) tier.
 *
 * Money invariant: we NEVER charge more than the amount the pay button showed at
 * confirmation. The client echoes back the `confirmedPriceId` it displayed; we
 * re-resolve authoritatively and, if they disagree (a rare race — card changed,
 * IP changed), we charge NOTHING and return `needsReconfirm` with the new price
 * so the client re-shows the button. The charge only happens on an exact match.
 */
export async function createSubscriptionAtTier(
  userId: string,
  targetPlan: PlanName,
  paymentMethodId: string,
  ipCountry: string | null,
  confirmedPriceId: string,
): Promise<CreateSubscriptionResult> {
  const stripe = getStripe();
  const customerId = await ensureStripeCustomer(userId);

  const resolved = await resolveCheckoutPrice(targetPlan, paymentMethodId, ipCountry);

  // Charged price must equal what the user confirmed on the button. Any drift →
  // re-confirm, never a silent (higher OR lower) charge.
  if (resolved.priceId !== confirmedPriceId) {
    return { ok: false, needsReconfirm: true, resolved };
  }

  // Attach the card and make it the default for the subscription's invoices.
  try {
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
  } catch (e) {
    // Already attached to this customer is fine; anything else re-throws.
    if (!(e instanceof Stripe.errors.StripeInvalidRequestError) ||
        !/already been attached/i.test(e.message)) throw e;
  }
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: resolved.priceId, quantity: 1 }],
    default_payment_method: paymentMethodId,
    metadata: {
      userId,
      plan: targetPlan,
      geo_tier: String(resolved.resolvedTier),
      ip_tier: String(resolved.displayTier),
      card_country: resolved.cardCountry ?? 'unknown',
    },
    expand: ['latest_invoice.payment_intent'],
  });

  // Entitlement: set the plan from the resolved price id immediately (the webhook
  // customer.subscription.created keeps it in sync, but we don't block on it).
  await handleSubscriptionCreated(subscription);

  return {
    ok: true,
    plan: getPlanFromPriceId(resolved.priceId) ?? targetPlan,
    tier: resolved.resolvedTier,
    amount: resolved.amount,
    subscriptionId: subscription.id,
    status: subscription.status,
  };
}

export async function createPortalSession(userId: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const stripe = getStripe();

  const { data: user, error } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  if (error || !user || !user.stripe_customer_id) {
    throw new Error('No billing account found. Please subscribe first.');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`
  });

  return session.url;
}

export async function handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  const supabase = getSupabaseAdmin();
  const userId = subscription.metadata.userId;
  const priceId = subscription.items.data[0]?.price.id || '';
  const plan = getPlanFromPriceId(priceId) || 'build';

  // DD §A: the legacy `monthly_limit` request-count is retired — the only limit is
  // the weighted Goblin allowance (lib/goblin-cap.ts), keyed off `plan`. Nothing to
  // write here beyond the plan + subscription identifiers.
  await supabase
    .from('users')
    .update({
      plan,
      stripe_customer_id: subscription.customer as string,
      stripe_subscription_id: subscription.id,
      subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
    })
    .eq('id', userId);
}

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const supabase = getSupabaseAdmin();
  const priceId = subscription.items.data[0]?.price.id || '';
  const plan = getPlanFromPriceId(priceId) || 'build';

  await supabase
    .from('users')
    .update({
      plan,
      subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
    })
    .eq('stripe_subscription_id', subscription.id);
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const supabase = getSupabaseAdmin();

  await supabase
    .from('users')
    .update({
      plan: 'build',
      stripe_subscription_id: null
    })
    .eq('stripe_subscription_id', subscription.id);
}