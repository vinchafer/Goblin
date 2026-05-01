import { Hono } from 'hono';
import Stripe from 'stripe';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import {
  createCheckoutSession,
  createPortalSession,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  resetMonthlyUsage
} from '../services/billing-service';
import { getSupabaseAdmin } from '../lib/supabase';

type Variables = { userId: string }
const billing = new Hono<{ Variables: Variables }>();

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });
}

billing.post('/create-checkout-session', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const schema = z.object({ targetPlan: z.enum(['seed', 'craft', 'forge']) });
  const result = schema.safeParse(body);
  if (!result.success) return c.json({ error: 'Invalid plan' }, 400);

  const checkoutUrl = await createCheckoutSession(userId, result.data.targetPlan);
  return c.json({ checkoutUrl });
});

billing.post('/create-portal-session', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const portalUrl = await createPortalSession(userId);
  return c.json({ portalUrl });
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
    const invoices = await stripe.invoices.list({
      customer: user.stripe_customer_id,
      limit: 12,
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

    return c.json({ invoices: formatted });
  } catch {
    return c.json({ invoices: [] });
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

// GET /api/billing/usage — usage breakdown for current user
billing.get('/usage', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();

  const { data: user } = await supabase
    .from('users')
    .select('plan, monthly_requests_used, monthly_limit, subscription_current_period_end')
    .eq('id', userId)
    .single();

  if (!user) return c.json({ error: 'User not found' }, 404);

  // Breakdown by source tier from chat_logs if available
  let byok_count = 0;
  let free_count = 0;
  let hosted_count = 0;

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: logs } = await supabase
      .from('chat_logs')
      .select('source_tier')
      .eq('user_id', userId)
      .gte('created_at', startOfMonth);

    if (logs) {
      for (const log of logs) {
        if (log.source_tier === 'byok') byok_count++;
        else if (log.source_tier === 'free_api') free_count++;
        else if (log.source_tier === 'goblin_hosted') hosted_count++;
      }
    }
  } catch {
    // chat_logs may not exist — use total as byok estimate
    byok_count = user.monthly_requests_used;
  }

  return c.json({
    plan: user.plan,
    used: user.monthly_requests_used,
    limit: user.monthly_limit,
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

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const sub = await getStripe().subscriptions.retrieve(invoice.subscription as string);
          const userId = sub.metadata.userId;
          if (userId) await resetMonthlyUsage(userId);
        }
        break;
      }
    }

    return c.json({ received: true });
  } catch {
    return c.json({ error: 'Invalid signature' }, 400);
  }
});

export { billing };
