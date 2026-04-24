import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { PLANS, getPlanFromPriceId } from '../config/plans';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20'
});

export async function createCheckoutSession(userId: string, targetPlan: string): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: user } = await supabase
    .from('users')
    .select('email, stripe_customer_id')
    .eq('id', userId)
    .single();

  const plan = PLANS[targetPlan];

  const session = await stripe.checkout.sessions.create({
    customer: user.stripe_customer_id || undefined,
    customer_email: user.stripe_customer_id ? undefined : user.email,
    payment_method_types: ['card'],
    line_items: [{
      price: plan.stripePriceId,
      quantity: 1
    }],
    mode: 'subscription',
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing`,
    metadata: {
      userId,
      plan: targetPlan
    }
  });

  return session.url!;
}

export async function createPortalSession(userId: string): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: user } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing`
  });

  return session.url;
}

export async function handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const userId = subscription.metadata.userId;
  const priceId = subscription.items.data[0].price.id;
  const plan = getPlanFromPriceId(priceId) || 'seed';
  const planConfig = PLANS[plan];

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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const priceId = subscription.items.data[0].price.id;
  const plan = getPlanFromPriceId(priceId) || 'seed';
  const planConfig = PLANS[plan];

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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase
    .from('users')
    .update({
      plan: 'seed',
      monthly_limit: PLANS.seed.monthlyRequests,
      stripe_subscription_id: null
    })
    .eq('stripe_subscription_id', subscription.id);
}

export async function resetMonthlyUsage(userId: string): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase
    .from('users')
    .update({ monthly_requests_used: 0 })
    .eq('id', userId);
}