/**
 * E-6 (DD U6): the synchronous, user-facing money calls are wrapped in `withTimeout`
 * so a stalled Stripe upstream returns an honest timeout error instead of hanging the
 * request forever. Drives `createCheckoutSession` against a Stripe stub whose
 * `checkout.sessions.create` never resolves, with a tiny budget, and asserts the call
 * rejects with a TimeoutError (not an infinite await).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// A Stripe stub whose money call hangs forever (a wedged upstream).
vi.mock('stripe', () => {
  class FakeStripe {
    constructor(_k: string, _o: unknown) {}
    checkout = { sessions: { create: () => new Promise<never>(() => { /* never settles */ }) } };
    customers = { retrieve: async () => ({}) };
  }
  return { default: FakeStripe };
});
// A user with no stripe_customer_id → the checkout path skips customer retrieval and
// goes straight to the (hanging) session create.
vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { email: 'x@y.z', stripe_customer_id: null }, error: null }) }) }),
    }),
  }),
}));
vi.mock('../lib/logger', () => ({ default: { info() {}, warn() {}, error() {} } }));

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_PRICE_BUILD_TIER1 ||= 'price_dummy_build';
process.env.NEXT_PUBLIC_APP_URL ||= 'https://example.test';

import { createCheckoutSession } from './billing-service';
import { isTimeoutError } from '../lib/with-timeout';

beforeEach(() => { process.env.STRIPE_MONEY_TIMEOUT_MS = '30'; });

describe('money-call timeout budgets (E-6)', () => {
  it('a wedged checkout.sessions.create rejects with a TimeoutError, not an infinite await', async () => {
    const err = await createCheckoutSession('user-1', 'build', null).then(
      () => { throw new Error('expected a timeout rejection'); },
      (e) => e,
    );
    expect(isTimeoutError(err)).toBe(true);
    expect((err as Error).message).toContain('checkout.sessions.create');
  });
});
