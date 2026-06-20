import { Hono } from 'hono';
import Stripe from 'stripe';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import {
  createCheckoutSession,
  createPortalSession,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted
} from '../services/billing-service';
import { getSupabaseAdmin } from '../lib/supabase';
import { getGeoTier, PLAN_PRICES, TIER_LABELS } from '../config/geo-pricing';

type Variables = { userId: string }
const billing = new Hono<{ Variables: Variables }>();

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });
}

billing.post('/create-checkout-session', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const schema = z.object({
    targetPlan: z.enum(['build', 'pro', 'power']),
    countryCode: z.string().length(2).optional(),
  });
  const result = schema.safeParse(body);
  if (!result.success) return c.json({ error: 'Invalid plan' }, 400);

  // Detect country from Cloudflare header (most reliable), fallback to client-provided
  const cfCountry = c.req.header('CF-IPCountry');
  const countryCode = cfCountry ?? result.data.countryCode ?? null;

  const checkoutUrl = await createCheckoutSession(userId, result.data.targetPlan, countryCode);
  return c.json({ checkoutUrl });
});

// GET /api/billing/geo-pricing — returns tier + prices for current user's region
billing.get('/geo-pricing', async (c) => {
  const cfCountry = c.req.header('CF-IPCountry') ?? null;
  const tier = getGeoTier(cfCountry);
  return c.json({
    tier,
    country: cfCountry,
    label: TIER_LABELS[tier],
    prices: {
      build: PLAN_PRICES.build[tier],
      pro:   PLAN_PRICES.pro[tier],
      power: PLAN_PRICES.power[tier],
    },
  });
});

billing.post('/create-portal-session', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const portalUrl = await createPortalSession(userId);
  return c.json({ portalUrl });
});

// GET /api/billing/status — unified billing state for the BillingPage
billing.get('/status', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();

  const { data: user } = await supabase
    .from('users')
    .select('plan, subscription_status, subscription_current_period_end, trial_ends_at, cloud_trial_ends_at, is_comped, comp_reason, stripe_customer_id')
    .eq('id', userId)
    .single();

  if (!user) return c.json({ error: 'User not found' }, 404);

  // Card info (best-effort, don't fail status if Stripe is down)
  let cardLast4: string | null = null;
  let cardBrand: string | null = null;
  if (user.stripe_customer_id) {
    try {
      const stripe = getStripe();
      const customer = await stripe.customers.retrieve(user.stripe_customer_id, {
        expand: ['invoice_settings.default_payment_method'],
      }) as Stripe.Customer;
      const pm = customer.invoice_settings?.default_payment_method as Stripe.PaymentMethod | null;
      if (pm?.card) {
        cardLast4 = pm.card.last4;
        cardBrand = pm.card.brand;
      }
    } catch { /* silent */ }
  }

  return c.json({
    plan: user.plan,
    status: user.subscription_status ?? null,
    trialEndsAt: user.cloud_trial_ends_at ?? user.trial_ends_at ?? null,
    currentPeriodEnd: user.subscription_current_period_end ?? null,
    cardLast4,
    cardBrand,
    isComped: !!user.is_comped,
    compReason: user.comp_reason ?? null,
  });
});

// GET /api/billing/invoices — last 12 Stripe invoices
billing.get('/invoices', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();
  const stripe = getStripe();

  const { data: user } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  if (!user?.stripe_customer_id) {
    return c.json({ invoices: [] });
  }

  try {
    const cursor = c.req.query('cursor') || undefined;
    const invoices = await stripe.invoices.list({
      customer: user.stripe_customer_id,
      limit: 12,
      ...(cursor ? { starting_after: cursor } : {}),
    });

    const formatted = invoices.data.map(inv => ({
      id: inv.id,
      date: new Date(inv.created * 1000).toISOString(),
      amount: inv.amount_paid / 100,
      currency: inv.currency,
      status: inv.status,
      pdf_url: inv.invoice_pdf,
      hosted_url: inv.hosted_invoice_url,
    }));

    return c.json({
      invoices: formatted,
      has_more: invoices.has_more,
      next_cursor: invoices.has_more && formatted.length > 0 ? (formatted.at(-1)?.id ?? null) : null,
    });
  } catch {
    return c.json({ invoices: [], has_more: false, next_cursor: null });
  }
});

// GET /api/billing/payment-method — current card info
billing.get('/payment-method', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();
  const stripe = getStripe();

  const { data: user } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  if (!user?.stripe_customer_id) {
    return c.json({ payment_method: null });
  }

  try {
    const customer = await stripe.customers.retrieve(user.stripe_customer_id, {
      expand: ['invoice_settings.default_payment_method'],
    }) as Stripe.Customer;

    const pm = customer.invoice_settings?.default_payment_method as Stripe.PaymentMethod | null;
    if (!pm || !pm.card) {
      return c.json({ payment_method: null });
    }

    return c.json({
      payment_method: {
        brand: pm.card.brand,
        last4: pm.card.last4,
        exp_month: pm.card.exp_month,
        exp_year: pm.card.exp_year,
      }
    });
  } catch {
    return c.json({ payment_method: null });
  }
});

// GET /api/billing/usage — activity breakdown for the current calendar month.
// DD §A: reads the canonical `agent_runs` table (the same source the usage screen
// uses), NOT the retired `monthly_requests_used` counter. `used` is the real BUILD
// count this month; there is no legacy request `limit` (the only limit is the
// weighted Goblin allowance surfaced on the usage screen / GoblinUsageBar).
billing.get('/usage', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();

  const { data: user } = await supabase
    .from('users')
    .select('plan, subscription_current_period_end')
    .eq('id', userId)
    .single();

  if (!user) return c.json({ error: 'User not found' }, 404);

  // Build count by source tier for the current calendar month.
  let byok_count = 0;
  let free_count = 0;
  let hosted_count = 0;

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: runs } = await supabase
      .from('agent_runs')
      .select('source_tier')
      .eq('user_id', userId)
      .eq('status', 'success')
      .gte('created_at', startOfMonth);

    for (const r of runs ?? []) {
      const t = (r as { source_tier?: string }).source_tier;
      if (t === 'byok') byok_count++;
      else if (t === 'free_api') free_count++;
      else if (t === 'goblin_hosted') hosted_count++;
    }
  } catch {
    // Best-effort breakdown — on any read failure show zero, never a frozen counter.
  }

  return c.json({
    plan: user.plan,
    used: byok_count + free_count + hosted_count,
    reset_date: user.subscription_current_period_end,
    breakdown: {
      byok: byok_count,
      free_api: free_count,
      goblin_hosted: hosted_count,
    },
  });
});

billing.post('/webhook', async (c) => {
  const signature = c.req.header('stripe-signature')!;
  const body = await c.req.text();

  try {
    const event = Stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    // Idempotency: skip if we've already processed this event id.
    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from('stripe_processed_events')
      .select('event_id')
      .eq('event_id', event.id)
      .maybeSingle();
    if (existing) {
      return c.json({ received: true, duplicate: true });
    }
    // Mark as processed before applying side effects. If the insert races
    // (rare), the unique-pk constraint will reject the second attempt.
    await supabase
      .from('stripe_processed_events')
      .insert({ event_id: event.id, event_type: event.type });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subscription = await getStripe().subscriptions.retrieve(session.subscription as string);
          await handleSubscriptionCreated(subscription);
        }
        break;
      }
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      // invoice.paid previously reset the legacy monthly_requests_used counter.
      // That counter is retired (DD §A) and the weighted Goblin allowance resets
      // automatically at the start of each calendar month (lib/goblin-cap.ts), so
      // there is nothing to reset here.
    }

    return c.json({ received: true });
  } catch {
    return c.json({ error: 'Invalid signature' }, 400);
  }
});

export { billing };
