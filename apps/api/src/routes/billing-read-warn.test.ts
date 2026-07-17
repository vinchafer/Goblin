// E-7 (DD U6): non-money read paths must not swallow errors silently — a Stripe/DB
// outage should be operator-visible at `warn`. Drives the real /billing/usage route
// with an agent_runs read that throws, and asserts the response still degrades to a
// zero breakdown (unchanged behavior) AND a warn line is emitted.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const H = vi.hoisted(() => ({ warn: vi.fn() }));

function usersBuilder() {
  return {
    select: () => ({ eq: () => ({ single: async () => ({ data: { plan: 'build', subscription_current_period_end: null }, error: null }) }) }),
  };
}
function agentRunsBuilder() {
  const b: Record<string, unknown> = {};
  b.select = () => b; b.eq = () => b; b.gte = () => b;
  (b as { then: unknown }).then = (res: (v: unknown) => void, rej: (e: unknown) => void) =>
    Promise.reject(new Error('db down')).then(res, rej);
  return b;
}

vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({ from: (t: string) => (t === 'agent_runs' ? agentRunsBuilder() : usersBuilder()) }),
}));
vi.mock('../middleware/auth', () => ({
  authMiddleware: async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
    c.set('userId', 'user-1'); await next();
  },
}));
vi.mock('../lib/logger', () => ({ default: { info() {}, warn: H.warn, error() {} } }));

import { billing } from './billing';

beforeEach(() => { H.warn.mockClear(); });

describe('billing read-path warn logs — E-7', () => {
  it('/usage: an agent_runs read failure degrades to zeros AND logs at warn', async () => {
    const res = await billing.request('/usage', { method: 'GET' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.used).toBe(0);
    expect(body.breakdown).toEqual({ byok: 0, free_api: 0, goblin_hosted: 0 });
    expect(H.warn).toHaveBeenCalledTimes(1);
  });
});
