import Stripe from 'stripe';
import { getSupabaseAdmin } from '../lib/supabase';
import { getPlans, getPlanFromPriceId } from '../config/plans';
import {
  getGeoTier,
  getPriceForTier,
  getTierFromPriceId,
  authoritativeTier,
  resolveChargeTier,
  tierAmount,
  type GeoTier,
  type PlanName,
} from '../config/geo-pricing';
import logger from '../lib/logger';
import { trackEvent } from '../lib/platform-events';
import { withTimeout, envTimeoutMs } from '../lib/with-timeout';

// Stripe statuses where the subscription still exists and bills → "has an active
// subscription" for the double-create guard + the change-plan path.
const ACTIVE_SUB_STATUS = new Set<Stripe.Subscription.Status>([
  'active',
  'trialing',
  'past_due',
  'unpaid',
]);

/**
 * Return the user's live Stripe subscription (from the id persisted on the row),
 * or null when there is none / it is no longer billing. Verifies against Stripe
 * so a stale db id can't make us think a cancelled sub is still active.
 */
async function getActiveSubscription(userId: string): Promise<Stripe.Subscription | null> {
  const supabase = getSupabaseAdmin();
  const stripe = getStripe();
  const { data: user } = await supabase
    .from('users')
    .select('stripe_subscription_id')
    .eq('id', userId)
    .maybeSingle();
  const subId = user?.stripe_subscription_id as string | null | undefined;
  if (!subId) return null;
  try {
    const sub = await stripe.subscriptions.retrieve(subId);
    return ACTIVE_SUB_STATUS.has(sub.status) ? sub : null;
  } catch {
    return null;
  }
}

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

// E-6: per-call timeout budget for the synchronous, user-facing money calls
// (checkout / subscribe / change-plan / proration preview). The webhook processor
// already bounds every Stripe call in time (stripe-webhook-processor.ts); these
// request-path calls were the last raw `stripe.*` awaits with no ceiling. On a
// stalled Stripe upstream the caller now gets an honest TimeoutError (surfaced as a
// 500 by the route) instead of hanging until the SDK's own default. Env-overridable.
const moneyCallTimeoutMs = () => envTimeoutMs('STRIPE_MONEY_TIMEOUT_MS', 15_000);

// E-4: a post-charge entitlement write failure is NON-FATAL. Once the money has moved
// (subscription created / plan changed + charged), we must NEVER report a failed charge
// to the user (F-29 species, chargeback vector). We log loudly, return an honest
// success carrying this note, and let the webhook (customer.subscription.created /
// updated) reconcile the plan. German UI + EN i18n.
const ENTITLEMENT_PENDING_NOTE = {
  de: 'Zahlung erhalten — dein Plan wird gerade aktiviert.',
  en: 'Payment received — your plan is being activated.',
};

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

  const session = await withTimeout(stripe.checkout.sessions.create({
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
  }), moneyCallTimeoutMs(), 'checkout.sessions.create');

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
  | { ok: true; plan: string; tier: GeoTier; amount: number; subscriptionId: string; status: string; entitlementPending?: boolean; note?: { en: string; de: string } }
  | { ok: false; needsReconfirm: true; resolved: ResolvedPrice }
  | { ok: false; hasActiveSubscription: true };

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

  // P0 double-subscription guard: never create a second active subscription on a
  // customer who already has one. A plan change must go through change-plan
  // (subscriptions.update), not a second create. This makes a duplicate sub
  // impossible even if a client ever calls the wrong endpoint.
  const existing = await getActiveSubscription(userId);
  if (existing) {
    return { ok: false, hasActiveSubscription: true };
  }

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

  const subscription = await withTimeout(stripe.subscriptions.create({
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
  }), moneyCallTimeoutMs(), 'subscriptions.create');

  // Entitlement: set the plan from the resolved price id immediately (the webhook
  // customer.subscription.created keeps it in sync, but we don't block on it). The
  // charge has ALREADY happened above (subscriptions.create), so a failure here is
  // NON-FATAL (E-4): never report a failed charge after money moved. Log loudly and
  // return an honest pending-success; the webhook reconciles the plan.
  let entitlementPending = false;
  try {
    await handleSubscriptionCreated(subscription);
  } catch (err) {
    entitlementPending = true;
    logger.error(
      { userId, subId: subscription.id, err: err instanceof Error ? err.message : String(err) },
      'createSubscriptionAtTier: entitlement write failed AFTER charge — webhook will reconcile (E-4)',
    );
  }

  return {
    ok: true,
    plan: getPlanFromPriceId(resolved.priceId) ?? targetPlan,
    tier: resolved.resolvedTier,
    amount: resolved.amount,
    subscriptionId: subscription.id,
    status: subscription.status,
    ...(entitlementPending ? { entitlementPending: true, note: ENTITLEMENT_PENDING_NOTE } : {}),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Change plan for an EXISTING subscriber — subscriptions.update (NOT create),
// at the user's already-resolved card-country tier. No new SetupIntent, no card
// re-entry. Upgrade charges prorated difference now; downgrade credits.
// ──────────────────────────────────────────────────────────────────────────

/** Resolve the tier an existing sub is on (from its current price), with a card-country fallback. */
async function tierForExistingSub(
  sub: Stripe.Subscription,
  customerId: string,
): Promise<GeoTier> {
  const currentPriceId = sub.items.data[0]?.price.id ?? null;
  const fromPrice = getTierFromPriceId(currentPriceId);
  if (fromPrice) return fromPrice;
  // Fallback: read the default payment method's card country.
  try {
    const stripe = getStripe();
    const customer = (await stripe.customers.retrieve(customerId, {
      expand: ['invoice_settings.default_payment_method'],
    })) as Stripe.Customer;
    const pm = customer.invoice_settings?.default_payment_method as Stripe.PaymentMethod | null;
    const cardCountry = pm?.card?.country ?? null;
    return resolveChargeTier(cardCountry, null);
  } catch {
    return 1;
  }
}

export interface PlanChangePreview {
  hasActiveSubscription: boolean;
  samePlan: boolean;
  newPlan: PlanName;
  newPriceId: string;
  tier: GeoTier;
  newMonthlyAmount: number; // recurring $/mo at the user's tier
  amountDueNow: number;     // prorated charge due immediately (>= 0)
  creditAmount: number;     // prorated credit for downgrades (>= 0)
  currency: string;
}

/**
 * Preview a plan change without applying it: returns the new recurring price and
 * the prorated amount that will be charged now (or credited). Pure read — the
 * upcoming-invoice preview never charges.
 */
export async function previewPlanChange(
  userId: string,
  targetPlan: PlanName,
): Promise<PlanChangePreview | { hasActiveSubscription: false }> {
  const stripe = getStripe();
  const sub = await getActiveSubscription(userId);
  if (!sub) return { hasActiveSubscription: false };

  const customerId = sub.customer as string;
  const item = sub.items.data[0];
  const currentPriceId = item?.price.id ?? null;
  const tier = await tierForExistingSub(sub, customerId);
  const newPriceId = getPriceForTier(targetPlan, tier);
  if (!newPriceId) throw new Error(`No price configured for plan: ${targetPlan}`);

  const samePlan = newPriceId === currentPriceId;
  const newMonthlyAmount = tierAmount(targetPlan, tier);

  let amountDueNow = 0;
  let creditAmount = 0;
  let currency = 'usd';
  if (!samePlan && item) {
    const upcoming = await withTimeout(stripe.invoices.retrieveUpcoming({
      customer: customerId,
      subscription: sub.id,
      subscription_items: [{ id: item.id, price: newPriceId }],
      subscription_proration_behavior: 'create_prorations',
    }), moneyCallTimeoutMs(), 'invoices.retrieveUpcoming');
    currency = upcoming.currency ?? 'usd';
    // Sum only the proration line items so the figure reflects the change itself,
    // not the full next-cycle total.
    const prorationCents = upcoming.lines.data
      .filter((l) => l.proration)
      .reduce((s, l) => s + l.amount, 0);
    if (prorationCents >= 0) amountDueNow = prorationCents / 100;
    else creditAmount = -prorationCents / 100;
  }

  return {
    hasActiveSubscription: true,
    samePlan,
    newPlan: targetPlan,
    newPriceId,
    tier,
    newMonthlyAmount,
    amountDueNow,
    creditAmount,
    currency,
  };
}

export type ChangePlanResult =
  | { ok: true; samePlan: boolean; plan: string; tier: GeoTier; amount: number; subscriptionId: string; status: string; entitlementPending?: boolean; note?: { en: string; de: string } }
  | { ok: false; needsReconfirm: true; newPriceId: string; newAmount: number }
  | { ok: false; hasActiveSubscription: false };

/**
 * Apply a plan change on the existing subscription. Money invariant: the price we
 * switch to must equal the `confirmedPriceId` the client previewed — any drift
 * (tier changed underfoot) returns needsReconfirm, never a silent switch.
 */
export async function changePlan(
  userId: string,
  targetPlan: PlanName,
  confirmedPriceId: string,
): Promise<ChangePlanResult> {
  const stripe = getStripe();
  const sub = await getActiveSubscription(userId);
  if (!sub) return { ok: false, hasActiveSubscription: false };

  const customerId = sub.customer as string;
  const item = sub.items.data[0];
  if (!item) return { ok: false, hasActiveSubscription: false };
  const currentPriceId = item.price.id;
  const tier = await tierForExistingSub(sub, customerId);
  const newPriceId = getPriceForTier(targetPlan, tier);
  if (!newPriceId) throw new Error(`No price configured for plan: ${targetPlan}`);

  // Already on this plan → no-op (don't issue a needless proration of $0).
  if (newPriceId === currentPriceId) {
    return {
      ok: true,
      samePlan: true,
      plan: getPlanFromPriceId(newPriceId) ?? targetPlan,
      tier,
      amount: tierAmount(targetPlan, tier),
      subscriptionId: sub.id,
      status: sub.status,
    };
  }

  // Never switch to a price the user didn't preview/confirm.
  if (confirmedPriceId !== newPriceId) {
    return { ok: false, needsReconfirm: true, newPriceId, newAmount: tierAmount(targetPlan, tier) };
  }

  // always_invoice: invoice AND charge the net proration NOW (Decision A — the user
  // gets the higher limits today, so they pay today). Billing-cycle anchor is left
  // untouched, so the next full invoice still lands on the original date; only the
  // prorated difference is billed immediately. error_if_incomplete: if that immediate
  // charge can't be paid (declined card), the update FAILS and the subscription is
  // left UNCHANGED — never changed-but-unpaid.
  const updated = await withTimeout(stripe.subscriptions.update(sub.id, {
    items: [{ id: item.id, price: newPriceId }],
    proration_behavior: 'always_invoice',
    payment_behavior: 'error_if_incomplete',
    expand: ['latest_invoice.payment_intent'],
  }), moneyCallTimeoutMs(), 'subscriptions.update');

  // Persist entitlement immediately (webhook customer.subscription.updated keeps it in
  // sync, but we don't block on it). The prorated charge has ALREADY cleared above
  // (always_invoice + error_if_incomplete means a declined card would have thrown from
  // subscriptions.update, before this point), so a failure here is NON-FATAL (E-4):
  // never report a failed charge after money moved. Log loudly and return an honest
  // pending-success; the webhook reconciles the plan.
  let entitlementPending = false;
  try {
    await handleSubscriptionUpdated(updated);
  } catch (err) {
    entitlementPending = true;
    logger.error(
      { userId, subId: updated.id, err: err instanceof Error ? err.message : String(err) },
      'changePlan: entitlement write failed AFTER charge — webhook will reconcile (E-4)',
    );
  }

  return {
    ok: true,
    samePlan: false,
    plan: getPlanFromPriceId(newPriceId) ?? targetPlan,
    tier,
    amount: tierAmount(targetPlan, tier),
    subscriptionId: updated.id,
    status: updated.status,
    ...(entitlementPending ? { entitlementPending: true, note: ENTITLEMENT_PENDING_NOTE } : {}),
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

  // Hardening: if NEXT_PUBLIC_APP_URL is unset on the API host the return_url
  // would be `undefined/...` → Stripe throws "Invalid URL". Fall back to the
  // known prod URL so the portal still opens.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://justgoblin.com';

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${appUrl}/dashboard/billing`,
    });
    return session.url;
  } catch (e) {
    // Log the real Stripe error (portal not configured for this mode, bad
    // return_url, etc.) instead of letting the route surface only a generic
    // "unavailable" message with no server-side trace.
    logger.error(
      { userId, error: e instanceof Error ? e.message : String(e) },
      'createPortalSession failed',
    );
    throw e;
  }
}

/**
 * Read the current-period-end (unix secs → ISO) defensively across Stripe API
 * versions. In 2024-06-20 `current_period_end` is a top-level field on the
 * Subscription; in 2025-03-31.basil+ (the live webhook endpoint serializes
 * ~2026-04-22.dahlia) it moved ONTO each subscription item. The old code read
 * only the top-level field, so a dahlia-shaped webhook payload yielded
 * `new Date(undefined * 1000).toISOString()` → RangeError → the whole handler
 * threw and the cancel-at-period-end flag was never persisted. Returns null when
 * neither shape carries a usable value, so callers never write an Invalid Date.
 */
function periodEndISO(subscription: Stripe.Subscription): string | null {
  const top = (subscription as unknown as { current_period_end?: unknown }).current_period_end;
  const item = (subscription.items?.data?.[0] as unknown as { current_period_end?: unknown })?.current_period_end;
  const secs = typeof top === 'number' ? top : typeof item === 'number' ? item : null;
  return secs ? new Date(secs * 1000).toISOString() : null;
}

export async function handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  const supabase = getSupabaseAdmin();
  const userId = subscription.metadata.userId;
  const priceId = subscription.items.data[0]?.price.id || '';
  const plan = getPlanFromPriceId(priceId) || 'build';

  // DD §A: the legacy `monthly_limit` request-count is retired — the only limit is
  // the weighted Goblin allowance (lib/goblin-cap.ts), keyed off `plan`. Nothing to
  // write here beyond the plan + subscription identifiers.
  const patch: Record<string, unknown> = {
    plan,
    stripe_customer_id: subscription.customer as string,
    stripe_subscription_id: subscription.id,
    // A fresh subscription clears any stale cancellation flag (re-subscribe after
    // churn → clean paid state).
    cancel_at_period_end: subscription.cancel_at_period_end === true,
    // Consume the trial: once an account has ever subscribed the free trial is
    // spent and must NEVER reappear (derivePlanTruth gates on this). Stamp once.
    trial_consumed_at: new Date().toISOString(),
  };
  // Only write the period end when we can read a real value — never clobber a
  // previously-good date with null because a payload shape changed.
  const pe = periodEndISO(subscription);
  if (pe) patch.subscription_current_period_end = pe;

  await supabase.from('users').update(patch).eq('id', userId);

  // I1 funnel: upgraded — fires from the Stripe webhook truth (a real paid
  // subscription now exists), the final funnel stage. Metadata only (which plan).
  if (userId) trackEvent({ eventType: 'upgraded', userId, meta: { plan } });
}

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const supabase = getSupabaseAdmin();
  const priceId = subscription.items.data[0]?.price.id || '';
  const plan = getPlanFromPriceId(priceId) || 'build';

  // Cancel-at-period-end: Stripe keeps the sub `active` until current_period_end and
  // fires this event with cancel_at_period_end=true. The user KEEPS paid access until
  // then — so we persist the flag + period end and NEVER null stripe_subscription_id
  // here. Nulling it mid-period would drop them straight to the paywall (and could
  // resurrect an old trial). The true end is handled by handleSubscriptionDeleted,
  // which Stripe fires at the period boundary.
  //
  // The cancel flag is written UNCONDITIONALLY and is decoupled from the period-end
  // date: even if the period end is unreadable on some payload shape, the
  // "läuft aus am" flag still lands (the existing stored period end stays as the
  // ending date). This is the exact bug behind "Nächste Abbuchung" persisting after
  // a real cancel — see periodEndISO().
  const patch: Record<string, unknown> = {
    plan,
    cancel_at_period_end: subscription.cancel_at_period_end === true,
  };
  const pe = periodEndISO(subscription);
  if (pe) patch.subscription_current_period_end = pe;

  await supabase.from('users').update(patch).eq('stripe_subscription_id', subscription.id);
}

// ──────────────────────────────────────────────────────────────────────────
// D-F (FW5-U5) — downgrade fairness: auto-refund any remaining credit on cancel.
//
// A downgrade leaves a prorated CREDIT on the customer's Stripe balance toward FUTURE
// invoices (Stripe stores a customer credit as a NEGATIVE `customer.balance`, in cents).
// If the user then CANCELS, there are no future invoices — we would sit on money for
// service never rendered. Founder decision (c): keep the credit, and on cancellation
// auto-refund any remaining positive credit to the original payment method.
//
// Mechanics: Stripe balance credit can't be refunded directly (refunds attach to a
// charge), so we refund the credit amount against the customer's most recent refundable
// succeeded charge (= the original card), then ZERO the refunded credit with a balance
// transaction so it isn't ALSO consumed elsewhere. Idempotency-keyed on the subscription
// so a webhook RETRY never double-refunds. Non-throwing: a refund failure is logged for
// admin visibility and NEVER surfaced as a user-facing success (F-29 species) — it must
// not fail the whole subscription.deleted handler (entitlement reset already succeeded).
//
// COST NOTE (verified 2026-07-15, ledger): Stripe does NOT return the original processing
// fee on refunds (any method, EU incl.) — the ~1.4% + €0.25 of the refunded amount is an
// accepted brand/fairness cost, documented in the ledger, not recovered from the user.
// ──────────────────────────────────────────────────────────────────────────

const refundTimeoutMs = () => envTimeoutMs('STRIPE_WEBHOOK_STRIPE_TIMEOUT_MS', 10_000);

export type CancelRefundStatus =
  | 'noop' // no credit (zero/positive balance) → nothing to refund
  | 'refunded' // credit refunded to the card AND the balance zeroed
  | 'refunded_balance_unadjusted' // money refunded, but zeroing the balance failed (admin)
  | 'skipped' // no customer / Stripe not configured
  | 'failed'; // could not refund (no refundable charge / Stripe error) — admin-visible

export interface CancelRefundResult {
  status: CancelRefundStatus;
  creditCents?: number;
  refundedCents?: number;
  refundId?: string;
  reason?: string;
}

async function computeCancelRefund(
  subscription: Stripe.Subscription,
): Promise<CancelRefundResult> {
  if (!process.env.STRIPE_SECRET_KEY) return { status: 'skipped', reason: 'stripe_not_configured' };
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id;
  if (!customerId) return { status: 'skipped', reason: 'no_customer' };

  const stripe = getStripe();
  // Idempotency keys: BOTH sides of the refund are keyed per subscription so a webhook
  // retry / cron replay can never double-refund the card NOR double-adjust (over-zero)
  // the balance (E-2). We also stamp the refund with metadata so a replay can recognise
  // its OWN prior refund and resume at the balance-zero step instead of re-refunding.
  const idemRefundKey = `goblin-cancel-credit-refund-${subscription.id}`;
  const idemZeroKey = `goblin-cancel-credit-zero-${subscription.id}`;

  // Zero the already-refunded credit with a POSITIVE balance transaction so it isn't
  // ALSO applied to a later invoice. Idempotency-keyed → a retry of the zeroing can
  // never push the balance past 0 into a customer-owes state. Shared by the fresh-refund
  // path and the resume path so "thought-failed-but-succeeded" zeroing is a safe no-op.
  const zeroCredit = async (amount: number, currency: string, refundId: string): Promise<CancelRefundResult> => {
    try {
      await withTimeout(
        stripe.customers.createBalanceTransaction(
          customerId,
          { amount, currency, description: `Goblin: auto-refund of remaining credit on cancellation (refund ${refundId})` },
          { idempotencyKey: idemZeroKey },
        ),
        refundTimeoutMs(),
        'cancelRefund:balanceTxn',
      );
    } catch (err) {
      // The money WAS returned; only the balance adjust failed. Admin-visible, and now
      // RETRYABLE (refundNeedsRetry) — the cron sweep resumes here, keyed so it can't
      // over-zero, so the retained-credit double-benefit converges away.
      logger.error({ customerId, subId: subscription.id, refundId, refundedCents: amount, err: err instanceof Error ? err.message : String(err) }, 'cancel_refund_balance_adjust_failed');
      return { status: 'refunded_balance_unadjusted', refundId, refundedCents: amount, reason: 'balance_unadjusted' };
    }
    logger.info({ customerId, subId: subscription.id, refundId, refundedCents: amount }, 'cancel_refund_succeeded');
    return { status: 'refunded', refundId, refundedCents: amount };
  };

  try {
    // 1. Read the current credit balance (fresh from Stripe, so payload shape is moot).
    const customer = await withTimeout(stripe.customers.retrieve(customerId), refundTimeoutMs(), 'cancelRefund:retrieveCustomer');
    if (!customer || (customer as Stripe.DeletedCustomer).deleted) return { status: 'skipped', reason: 'no_customer' };
    const balance = (customer as Stripe.Customer).balance ?? 0;
    const currency = (customer as Stripe.Customer).currency ?? 'eur';
    const credit = balance < 0 ? -balance : 0; // negative balance = credit owed to the user
    if (credit <= 0) return { status: 'noop', creditCents: 0 };

    const charges = await withTimeout(stripe.charges.list({ customer: customerId, limit: 10 }), refundTimeoutMs(), 'cancelRefund:listCharges');

    // 2. RESUME detection (E-2): did a PRIOR attempt already refund for THIS cancellation
    //    (e.g. the balance-zero failed → refunded_balance_unadjusted)? If so the money is
    //    already back on the card — never refund again; just (re)zero that exact refund's
    //    amount. We recognise our own refund by the metadata stamped on create. Recompute
    //    is unsafe (the refundable room shrank after our refund), so this is the only
    //    correct way to resume to consistency without recharging.
    for (const ch of charges.data) {
      if (ch.status !== 'succeeded' || (ch.amount_refunded ?? 0) <= 0) continue;
      let priorRefund: Stripe.Refund | undefined;
      try {
        const refunds = await withTimeout(stripe.refunds.list({ charge: ch.id, limit: 10 }), refundTimeoutMs(), 'cancelRefund:listRefunds');
        priorRefund = refunds.data.find(
          (r) => (r.metadata as Record<string, string> | null)?.goblin_cancel_sub === subscription.id
            && r.status !== 'failed' && r.status !== 'canceled',
        );
      } catch { /* refunds.list unavailable → fall through; the keyed create below is the safety net */ }
      if (priorRefund) return zeroCredit(priorRefund.amount, currency, priorRefund.id);
    }

    // 3. Fresh path: find the most recent refundable succeeded charge (the original card).
    const charge = charges.data.find(
      (ch) => ch.status === 'succeeded' && !ch.refunded && ch.amount - ch.amount_refunded > 0,
    );
    if (!charge) {
      logger.error({ customerId, subId: subscription.id, creditCents: credit }, 'cancel_refund_no_refundable_charge');
      return { status: 'failed', reason: 'no_refundable_charge', creditCents: credit };
    }

    // 4. Refund the remaining credit (capped at the charge's refundable room) to the card.
    //    Idempotency-keyed AND metadata-stamped so a retry can't double-refund and a
    //    resume can find this refund.
    const amount = Math.min(credit, charge.amount - charge.amount_refunded);
    let refund: Stripe.Refund;
    try {
      refund = await withTimeout(
        stripe.refunds.create(
          { charge: charge.id, amount, reason: 'requested_by_customer', metadata: { goblin_cancel_sub: subscription.id } },
          { idempotencyKey: idemRefundKey },
        ),
        refundTimeoutMs(),
        'cancelRefund:create',
      );
    } catch (err) {
      logger.error({ customerId, subId: subscription.id, creditCents: credit, err: err instanceof Error ? err.message : String(err) }, 'cancel_refund_failed');
      return { status: 'failed', reason: 'refund_error', creditCents: credit };
    }

    // 5. Zero the refunded credit (idempotency-keyed). Carries creditCents for the surface.
    const zeroed = await zeroCredit(amount, currency, refund.id);
    return zeroed.status === 'refunded' ? { ...zeroed, creditCents: credit } : zeroed;
  } catch (err) {
    // Any unexpected error (e.g. the customer retrieve timed out) is admin-visible and
    // swallowed — never fail the entitlement reset over a best-effort refund.
    logger.error({ customerId, subId: subscription.id, err: err instanceof Error ? err.message : String(err) }, 'cancel_refund_unexpected_error');
    return { status: 'failed', reason: 'unexpected_error' };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// DD-hardening FW6-U1 (+ DD-backlog U1/E-2) — refund RESILIENCE: an unresolved
// refund becomes a durable, retryable job (0094_refund_jobs.sql), the pattern 0084
// established for webhook side-effects. `computeCancelRefund` above still NEVER throws
// and remains F-29-safe (the subscription.deleted handler ignores the return value, so
// no user-facing success/string changes) — persistence is a pure side-effect layered
// on top by the exported wrapper below.
//
//   failed / refunded_balance_unadjusted → upsert a releasable job (attempts++), LOUD
//                    operator alert once it has failed N times. The sweep replays it:
//                    a failed one re-tries the whole (idempotent) refund; a balance-
//                    unadjusted one resumes at the idempotency-keyed balance zero.
//   refunded / noop / skipped           → resolve (mark done) any job left over from an
//                    earlier unresolved attempt, so the retry sweep converges.
//
// Pre-migration tolerant: if refund_jobs is absent the persistence log-and-no-ops, so
// cancellation refunds behave exactly as they did in FW5-U5 until 0094 lands.
// ──────────────────────────────────────────────────────────────────────────

const REFUND_JOB_ALERT_ATTEMPTS = () =>
  Math.max(1, Number(process.env.REFUND_JOB_ALERT_ATTEMPTS ?? 3) || 3);

// A refund attempt is "unresolved" (needs a retry job) when it FAILED (no money out yet)
// or landed in refunded_balance_unadjusted (money out, but the credit was NOT zeroed →
// a retained-credit double-benefit, E-2). The sweep replays both: a failed one re-tries
// the whole refund; a balance-unadjusted one resumes at the idempotency-keyed balance
// zero (never re-refunding). refunded / noop / skipped are terminal (nothing more owed).
function refundNeedsRetry(status: CancelRefundStatus): boolean {
  return status === 'failed' || status === 'refunded_balance_unadjusted';
}

/** Best-effort: persist the outcome of a refund attempt as a durable job. Never throws. */
async function persistRefundOutcome(
  subscription: Stripe.Subscription,
  result: CancelRefundResult,
): Promise<void> {
  const subId = subscription.id;
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id ?? null;
  try {
    const supabase = getSupabaseAdmin();

    if (!refundNeedsRetry(result.status)) {
      // Resolve any job a prior failed attempt left behind (cheap no-op if none).
      await supabase
        .from('refund_jobs')
        .update({ status: 'done', last_error: null, updated_at: new Date().toISOString() })
        .eq('subscription_id', subId)
        .neq('status', 'done');
      return;
    }

    // Failed → upsert a releasable job, incrementing attempts across retries.
    let attempts = 1;
    try {
      const { data } = await supabase
        .from('refund_jobs')
        .select('attempts')
        .eq('subscription_id', subId)
        .maybeSingle();
      if (data && typeof (data as { attempts?: number }).attempts === 'number') {
        attempts = (data as { attempts: number }).attempts + 1;
      }
    } catch { /* first failure → attempts = 1 */ }

    const { error } = await supabase
      .from('refund_jobs')
      .upsert(
        {
          subscription_id: subId,
          customer_id: customerId,
          status: 'failed',
          attempts,
          last_reason: result.reason ?? null,
          last_error: result.reason ?? 'refund_failed',
          credit_cents: result.creditCents ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'subscription_id' },
      );
    if (error) throw new Error(error.message);

    if (attempts >= REFUND_JOB_ALERT_ATTEMPTS()) {
      // Operator-visible: this refund has now failed N times and needs a human.
      logger.error(
        { subId, customerId, attempts, reason: result.reason, creditCents: result.creditCents },
        'cancel_refund_job_alert — refund still failing after retries, MANUAL refund required',
      );
    }
  } catch (err) {
    // Persistence itself failed (e.g. table absent pre-migration, or Supabase off in
    // a unit test) — log and swallow. A lost job row is strictly better than failing
    // the cancel; the money owed is still logged on every attempt by computeCancelRefund.
    logger.warn(
      { subId, err: err instanceof Error ? err.message : String(err) },
      'cancel_refund_job_persist_failed (non-fatal — refund_jobs may be pre-migration)',
    );
  }
}

/**
 * Auto-refund any remaining downgrade credit on cancellation, and PERSIST the
 * outcome so a failed refund is retried on a cron sweep instead of silently lost.
 * The returned {@link CancelRefundResult} is identical to computeCancelRefund's —
 * callers (and the user-facing handler) see no behavioural change (F-29).
 */
export async function refundRemainingCreditOnCancel(
  subscription: Stripe.Subscription,
): Promise<CancelRefundResult> {
  const result = await computeCancelRefund(subscription);
  await persistRefundOutcome(subscription, result);
  return result;
}

/**
 * CRON durability backstop for U1. Re-runs every releasable refund job (pending or
 * previously-failed) by replaying computeCancelRefund from the stored subscription
 * id — everything else (credit balance, refundable charge) is re-read fresh from
 * Stripe, and the refund is idempotency-keyed per subscription, so replay can never
 * double-refund. A job that finally succeeds is marked done; one that fails again
 * increments attempts (and re-alerts past the threshold).
 */
export async function retryFailedRefunds(limit = 25): Promise<{ resolved: number; stillFailing: number }> {
  const supabase = getSupabaseAdmin();
  let rows: Array<{ subscription_id: string; customer_id: string | null }> = [];
  try {
    const { data, error } = await supabase
      .from('refund_jobs')
      .select('subscription_id, customer_id')
      .in('status', ['pending', 'failed'])
      .order('updated_at', { ascending: true })
      .limit(limit);
    if (error) {
      // 42P01 = table absent (pre-migration): nothing to sweep, not an error.
      if (error.code !== '42P01' && !/does not exist/i.test(error.message)) {
        logger.error({ error: error.message }, 'refund-retry sweep: query failed');
      }
      return { resolved: 0, stillFailing: 0 };
    }
    rows = (data ?? []) as Array<{ subscription_id: string; customer_id: string | null }>;
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, 'refund-retry sweep: query threw');
    return { resolved: 0, stillFailing: 0 };
  }

  let resolved = 0;
  let stillFailing = 0;
  for (const row of rows) {
    // Reconstruct the minimal subscription computeCancelRefund needs (id + customer);
    // it re-reads the live credit/charge state from Stripe, so this is sufficient.
    const sub = { id: row.subscription_id, customer: row.customer_id ?? undefined } as unknown as Stripe.Subscription;
    const result = await refundRemainingCreditOnCancel(sub);
    if (refundNeedsRetry(result.status)) stillFailing++;
    else resolved++;
  }

  if (resolved > 0 || stillFailing > 0) {
    logger.info({ resolved, stillFailing }, 'refund-retry sweep: complete');
  }
  return { resolved, stillFailing };
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Fired at the TRUE end of the subscription (period boundary for a cancel-at-period-
  // end sub, or immediately for an immediate cancel). Now access really ends.
  //
  // Reset to the neutral 'none' — NOT 'build' (a real paid plan; that made a churned
  // user indistinguishable from a never-payer and handed them free Build quota) and
  // NOT trial (the trial is consumed; trial_consumed_at stays set so derivePlanTruth
  // routes them to the paywall / re-subscribe, never back to a trial). Requires
  // migration 0070 (adds 'none' to the CHECK) + 0071 (cancel_at_period_end column).
  await supabase
    .from('users')
    .update({
      plan: 'none',
      stripe_subscription_id: null,
      cancel_at_period_end: false,
      // Churn → no live sub → no payment-failing state to carry. Clear it so a
      // resubscribe never inherits a stale past_due banner.
      payment_state: null,
      payment_failing_since: null,
      next_payment_attempt: null,
    })
    .eq('stripe_subscription_id', subscription.id);

  // D-F (FW5-U5): after entitlement is reset, auto-refund any remaining credit to the
  // card. Non-throwing — a refund failure is logged for admin visibility and must not
  // fail this handler (which would retry the whole event); the refund is idempotent.
  await refundRemainingCreditOnCancel(subscription);
}

// ──────────────────────────────────────────────────────────────────────────
// Dunning (failed-payment grace) 2026-06-27.
//
// CRITICAL SHAPE RULE: RAW webhook payloads (event.data.object) arrive in the
// endpoint's 2026-05-27.dahlia shape — NOT the SDK-pinned 2024-06-20 shape. The
// invoice fields MOVED in dahlia (confirmed against a real captured test-mode
// payload):
//   - subscription id: invoice.parent.subscription_details.subscription
//     (invoice.subscription is GONE / undefined)
//   - billing reason : invoice.billing_reason ('subscription_cycle' = a renewal)
//   - retry deadline : invoice.next_payment_attempt (unix secs, nullable)
// We read the dahlia path first and fall back to the legacy field defensively so a
// future API-version flip can't silently null the lookup (the periodEndISO lesson).
// ──────────────────────────────────────────────────────────────────────────

/** Dahlia-aware subscription id from an invoice payload (legacy fallback). */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const dahlia = (invoice as unknown as {
    parent?: { subscription_details?: { subscription?: unknown } };
  }).parent?.subscription_details?.subscription;
  const legacy = (invoice as unknown as { subscription?: unknown }).subscription;
  if (typeof dahlia === 'string' && dahlia) return dahlia;
  if (typeof legacy === 'string' && legacy) return legacy;
  return null;
}

/** Dahlia next_payment_attempt (unix secs) → ISO, or null. */
function nextAttemptISO(invoice: Stripe.Invoice): string | null {
  const secs = (invoice as unknown as { next_payment_attempt?: unknown }).next_payment_attempt;
  return typeof secs === 'number' ? new Date(secs * 1000).toISOString() : null;
}

/**
 * invoice.payment_failed — a renewal charge failed. KEEP the plan paid (access
 * retained during Stripe's ~14-day Smart Retry window) but flag payment_state so
 * the in-app banner shows. Only acts on RENEWAL failures (billing_reason =
 * subscription_cycle) — a failed FIRST invoice (subscription_create) means the sub
 * never activated and is handled by the create/incomplete path, not dunning.
 * Idempotent: re-delivery re-sets the same state; payment_failing_since is stamped
 * only once (first failure) so it reflects the true start.
 */
export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const billingReason = (invoice as unknown as { billing_reason?: string }).billing_reason;
  if (billingReason !== 'subscription_cycle') return; // not a renewal → ignore

  const subId = invoiceSubscriptionId(invoice);
  if (!subId) return; // no subscription tied to this invoice → nothing to flag

  const supabase = getSupabaseAdmin();

  // Read the current failing-since so re-delivery doesn't reset the start time.
  const { data: existing } = await supabase
    .from('users')
    .select('payment_failing_since')
    .eq('stripe_subscription_id', subId)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    payment_state: 'past_due',
    next_payment_attempt: nextAttemptISO(invoice),
  };
  if (!existing?.payment_failing_since) {
    patch.payment_failing_since = new Date().toISOString();
  }

  await supabase.from('users').update(patch).eq('stripe_subscription_id', subId);
}

/**
 * invoice.payment_succeeded — a charge cleared. Recovery: CLEAR the payment-failing
 * state so the banner disappears and the plan reads healthy. Runs for any
 * subscription-tied success (renewal retry that recovered, or a normal cycle); a
 * first-payment success simply clears an already-null state (no-op). Idempotent.
 */
export async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  const subId = invoiceSubscriptionId(invoice);
  if (!subId) return;

  const supabase = getSupabaseAdmin();
  await supabase
    .from('users')
    .update({
      payment_state: null,
      payment_failing_since: null,
      next_payment_attempt: null,
    })
    .eq('stripe_subscription_id', subId);
}