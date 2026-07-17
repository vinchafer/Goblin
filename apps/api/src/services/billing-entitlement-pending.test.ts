/**
 * E-4 (DD U4): charged-but-told-failed. When the Stripe charge succeeds but the
 * immediate entitlement write throws, the user's card WAS charged — so the call must
 * return an honest pending-success (with a DE+EN note), never an error. The webhook
 * (customer.subscription.created / updated) reconciles the plan afterwards.
 *
 * Drives the real createSubscriptionAtTier + changePlan against a fake Stripe (money
 * calls succeed) and a fake Supabase whose `users` UPDATE — the entitlement write
 * inside handleSubscription* — throws.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Toggles whether getActiveSubscription sees an existing sub: null for the create
// path (must find none), 'sub_1' for the change path (must find one).
const State = vi.hoisted(() => ({ existingSubId: null as string | null }));

// All BUILD/PRO/POWER tiers resolve to a single dummy price id each, so the
// confirmed-price match is deterministic regardless of the resolved geo tier.
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_PRICE_BUILD_TIER1 = 'price_build';
process.env.STRIPE_PRICE_BUILD_TIER2 = 'price_build';
process.env.STRIPE_PRICE_BUILD_TIER3 = 'price_build';
process.env.STRIPE_PRICE_PRO_TIER1 = 'price_pro';
process.env.STRIPE_PRICE_PRO_TIER2 = 'price_pro';
process.env.STRIPE_PRICE_PRO_TIER3 = 'price_pro';
process.env.STRIPE_PRICE_POWER_TIER1 = 'price_power';
process.env.STRIPE_PRICE_POWER_TIER2 = 'price_power';
process.env.STRIPE_PRICE_POWER_TIER3 = 'price_power';

const createdSub = {
  id: 'sub_new', status: 'active', customer: 'cus_1', cancel_at_period_end: false,
  metadata: { userId: 'user-1' }, items: { data: [{ id: 'si_1', price: { id: 'price_build' } }] },
};
const existingSub = {
  id: 'sub_1', status: 'active', customer: 'cus_1', cancel_at_period_end: false,
  metadata: { userId: 'user-1' }, items: { data: [{ id: 'si_1', price: { id: 'price_build' } }] },
};
const updatedSub = {
  id: 'sub_1', status: 'active', customer: 'cus_1', cancel_at_period_end: false,
  metadata: { userId: 'user-1' }, items: { data: [{ id: 'si_1', price: { id: 'price_pro' } }] },
};

vi.mock('stripe', () => {
  class FakeStripe {
    constructor(_k: string, _o: unknown) {}
    paymentMethods = { retrieve: async () => ({ card: { country: 'US' } }), attach: async () => ({}) };
    customers = { update: async () => ({}), create: async () => ({ id: 'cus_1' }) };
    subscriptions = {
      create: async () => createdSub,
      update: async () => updatedSub,
      retrieve: async () => existingSub,
    };
  }
  return { default: FakeStripe };
});

// `users` SELECT/maybeSingle feed the customer + active-sub lookups; the UPDATE (the
// entitlement write inside handleSubscription*) rejects — the fault we're testing.
vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: () => {
      const b: Record<string, unknown> = {};
      let isUpdate = false;
      b.select = () => b;
      b.update = () => { isUpdate = true; return b; };
      b.eq = () => b;
      b.single = async () => ({ data: { email: 'x@y.z', stripe_customer_id: 'cus_1' }, error: null });
      b.maybeSingle = async () => ({ data: { stripe_subscription_id: State.existingSubId }, error: null });
      (b as { then: unknown }).then = (res: (v: unknown) => void, rej: (e: unknown) => void) =>
        (isUpdate ? Promise.reject(new Error('users update blew up')) : Promise.resolve({ data: null, error: null })).then(res, rej);
      return b;
    },
  }),
}));
vi.mock('../lib/logger', () => ({ default: { info() {}, warn() {}, error() {} } }));
vi.mock('../lib/platform-events', () => ({ trackEvent: () => {} }));

import { createSubscriptionAtTier, changePlan } from './billing-service';

const PENDING_NOTE = {
  de: 'Zahlung erhalten — dein Plan wird gerade aktiviert.',
  en: 'Payment received — your plan is being activated.',
};

beforeEach(() => { State.existingSubId = null; });

describe('post-charge entitlement failure → honest pending-success (E-4)', () => {
  it('createSubscriptionAtTier: charge ok, entitlement throws → ok:true pending, not an error', async () => {
    const r = await createSubscriptionAtTier('user-1', 'build', 'pm_1', null, 'price_build');
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.subscriptionId).toBe('sub_new');
    expect(r.entitlementPending).toBe(true);
    expect(r.note).toEqual(PENDING_NOTE);
  });

  it('changePlan: charge ok, entitlement throws → ok:true pending, not an error', async () => {
    State.existingSubId = 'sub_1';
    const r = await changePlan('user-1', 'pro', 'price_pro');
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.samePlan).toBe(false);
    expect(r.subscriptionId).toBe('sub_1');
    expect(r.entitlementPending).toBe(true);
    expect(r.note).toEqual(PENDING_NOTE);
  });
});
