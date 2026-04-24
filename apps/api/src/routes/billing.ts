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

const billing = new Hono();

billing.post('/create-checkout-session', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const schema = z.object({
    targetPlan: z.enum(['seed', 'craft', 'forge'])
  });

  const result = schema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid plan' }, 400);
  }

  const checkoutUrl = await createCheckoutSession(userId, result.data.targetPlan);
  return c.json({ checkoutUrl });
});

billing.post('/create-portal-session', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const portalUrl = await createPortalSession(userId);
  return c.json({ portalUrl });
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
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subscription = await new Stripe(process.env.STRIPE_SECRET_KEY!).subscriptions.retrieve(session.subscription as string);
          await handleSubscriptionCreated(subscription);
        }
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
    }

    return c.json({ received: true });
  } catch {
    return c.json({ error: 'Invalid signature' }, 400);
  }
});

export { billing };