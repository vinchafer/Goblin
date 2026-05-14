import Stripe from 'stripe';
import { getSupabaseAdmin } from '../lib/supabase';
import { getPlans, getPlanFromPriceId } from '../config/plans';
import { getGeoTier, getPriceForTier, type GeoTier } from '../config/geo-pricing';

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

  const tier = getGeoTier(countryCode ?? null) as GeoTier;
  const priceId = getPriceForTier(targetPlan, tier) ?? getPlans()[targetPlan]?.stripePriceId;

  if (!priceId) {
    throw new Error(`No price configured for plan: ${targetPlan}`);
  }

  const session = await stripe.checkout.sessions.create({
    customer: user.stripe_customer_id ?? undefined,
    customer_email: !user.stripe_customer_id ? user.email : undefined,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?canceled=true`,
    metadata: { userId, plan: targetPlan, geo_tier: String(tier) },
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
  const planConfig = getPlans()[plan] ?? getPlans()['build']!;

  await supabase
    .from('users')
    .update({
      plan,
      monthly_limit: planConfig.monthlyRequests,
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
  const planConfig = getPlans()[plan] ?? getPlans()['build']!;

  await supabase
    .from('users')
    .update({
      plan,
      monthly_limit: planConfig.monthlyRequests,
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
      monthly_limit: getPlans()['build']!.monthlyRequests,
      stripe_subscription_id: null
    })
    .eq('stripe_subscription_id', subscription.id);
}

export async function resetMonthlyUsage(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  await supabase
    .from('users')
    .update({ monthly_requests_used: 0 })
    .eq('id', userId);
}