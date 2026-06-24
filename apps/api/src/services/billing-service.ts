import Stripe from 'stripe';
import { getSupabaseAdmin } from '../lib/supabase';
import { getPlans, getPlanFromPriceId } from '../config/plans';
import { getGeoTier, getPriceForTier, authoritativeTier, type GeoTier } from '../config/geo-pricing';

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