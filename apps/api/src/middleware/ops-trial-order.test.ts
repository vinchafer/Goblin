// AKT 2 · PHASE 1.5 · U1.5c — the trial-gate MUST NOT sit in front of the ops plane.
//
// The finding that blocked the founder: /api/ops/* was mounted behind the
// subscription/trial paywall, so an allowlisted ops-beta account with no paid plan
// got a 402 from trialGate and never reached opsGate. The paywall is the wrong
// access control for an internal beta endpoint — the allowlist is. This suite wires
// the REAL middleware in the REAL index.ts order (trialGate on /api/*, then the
// route mounts) and proves the three ordering invariants behaviorally.
//
// Order under test:  trialGate (skips /api/ops)  →  opsGate (auth → allowlist)  →  handler
// Non-ops routes are unaffected: they still hit the paywall.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';

const getUser = vi.fn();
const single = vi.fn();

// One admin client backs both middlewares: trialGate uses auth.getUser + from('users'),
// opsGate uses auth.getUser. The from() chain mirrors .select().eq().single().
vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    auth: { getUser: (...a: unknown[]) => getUser(...a) },
    from: () => ({ select: () => ({ eq: () => ({ single: () => single() }) }) }),
  }),
}));

const { trialGate } = await import('./trial-gate');
const { opsGate } = await import('./ops-gate');

const BETA = 'founder.beta@example.com';
const COHORT = 'real.user@example.com';

/** A user with NO entitlement: not comped, no sub, no active trial, trial never started. */
const NO_ACCESS_ROW = {
  plan: 'none',
  stripe_subscription_id: null,
  cloud_trial_started_at: null,
  cloud_trial_ends_at: null,
  trial_extension_used: false,
  is_comped: false,
  preferred_lang: 'en',
};

// The app, wired exactly like index.ts: the trial gate spans /api/*, THEN the routes
// mount. The ops sub-app carries opsGate; a normal sub-app stands in for any paid route.
function makeApp() {
  const app = new Hono();
  app.use('/api/*', trialGate);

  const ops = new Hono();
  ops.use('*', opsGate);
  ops.get('/probe', (c) => c.json({ reached: true }));
  app.route('/api/ops', ops);

  const chat = new Hono();
  chat.post('/message', (c) => c.json({ reached: true }));
  app.route('/api/chat', chat);

  return app;
}

beforeEach(() => {
  getUser.mockReset();
  single.mockReset();
  process.env.OPS_HOSTING_ENABLED = 'true';
  process.env.OPS_BETA_ACCOUNTS = BETA;
});

afterEach(() => {
  delete process.env.OPS_HOSTING_ENABLED;
  delete process.env.OPS_BETA_ACCOUNTS;
});

describe('U1.5c — ops routes are gated by the allowlist, not the paywall', () => {
  it('(a) an allowlisted user WITHOUT trial/subscription reaches an ops route', async () => {
    // Identity resolves to the allowlisted beta account; the user has NO entitlement.
    getUser.mockResolvedValue({ data: { user: { id: 'u-beta', email: BETA } }, error: null });
    single.mockResolvedValue({ data: NO_ACCESS_ROW }); // would 402 anywhere the paywall applies

    const res = await makeApp().request('/api/ops/probe', { headers: { Authorization: 'Bearer valid-beta' } });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reached: true });
  });

  it('(b) a non-allowlisted user gets the framework-default 404 (byte-identical refusal)', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u-cohort', email: COHORT } }, error: null });
    single.mockResolvedValue({ data: NO_ACCESS_ROW });

    const res = await makeApp().request('/api/ops/probe', { headers: { Authorization: 'Bearer valid-cohort' } });

    expect(res.status).toBe(404);
    expect(await res.text()).toBe('404 Not Found');

    // …and indistinguishable from a route that was never mounted (no 402 leak either).
    const bare = new Hono();
    const unmounted = await bare.request('/nope');
    expect(res.status).toBe(unmounted.status);
    expect(res.headers.get('content-type')).toBe(unmounted.headers.get('content-type'));
  });

  it('(c) REGRESSION: an existing non-ops route still returns trial_required for a user without entitlement', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u-nopaid', email: COHORT } }, error: null });
    single.mockResolvedValue({ data: NO_ACCESS_ROW });

    const res = await makeApp().request('/api/chat/message', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-nopaid' },
    });

    expect(res.status).toBe(402);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe('trial_required');
  });
});
