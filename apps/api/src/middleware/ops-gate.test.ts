// ACT 2 · PHASE 1 · U1.1 — cohort-invisibility probe for the Act-2 gate.
//
// This is the gate's evidence: a real Hono app with a real handler behind
// opsGate, driven through every refusal path. The invariant under test is not
// "unauthorized users get an error" — it is "the route does not appear to exist,
// and every refusal is byte-identical", so a live Act-1 user cannot detect the
// ops plane by comparing responses.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';

const getUser = vi.fn();
vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({ auth: { getUser: (...a: unknown[]) => getUser(...a) } }),
}));

const { opsGate } = await import('./ops-gate');

const BETA = 'vinc.hafner3@gmail.com';
const COHORT = 'real.user@example.com';

function makeApp() {
  const app = new Hono();
  app.use('*', opsGate);
  app.get('/secret', (c) => c.json({ reached: true }));
  return app;
}

function call(app: Hono, headers: Record<string, string> = {}) {
  return app.request('/secret', { headers });
}

beforeEach(() => {
  getUser.mockReset();
  process.env.OPS_HOSTING_ENABLED = 'true';
  process.env.OPS_BETA_ACCOUNTS = BETA;
});

afterEach(() => {
  delete process.env.OPS_HOSTING_ENABLED;
  delete process.env.OPS_BETA_ACCOUNTS;
});

describe('the route is invisible to everyone but the allowlist', () => {
  it('404s with the kill switch off, even for the allowlisted account', async () => {
    process.env.OPS_HOSTING_ENABLED = 'false';
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: BETA } }, error: null });
    const res = await call(makeApp(), { Authorization: 'Bearer valid' });
    expect(res.status).toBe(404);
    expect(getUser).not.toHaveBeenCalled(); // switch checked first — no auth work at all
  });

  it('404s for an anonymous request', async () => {
    expect((await call(makeApp())).status).toBe(404);
  });

  it('404s for a malformed Authorization header', async () => {
    for (const h of ['', 'Bearer', 'Basic abc', 'bearer valid', 'Token valid']) {
      expect((await call(makeApp(), { Authorization: h })).status).toBe(404);
    }
    expect(getUser).not.toHaveBeenCalled();
  });

  it('404s for an invalid token', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad jwt' } });
    expect((await call(makeApp(), { Authorization: 'Bearer nope' })).status).toBe(404);
  });

  it('404s for a VALID token belonging to a live Act-1 cohort user', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u2', email: COHORT } }, error: null });
    const res = await call(makeApp(), { Authorization: 'Bearer valid-cohort' });
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('404 Not Found');
  });

  it('fails CLOSED when the auth backend throws', async () => {
    getUser.mockRejectedValue(new Error('supabase down'));
    expect((await call(makeApp(), { Authorization: 'Bearer valid' })).status).toBe(404);
  });

  it('admits the allowlisted account and exposes the principal', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u3', email: BETA } }, error: null });
    const app = new Hono<{ Variables: { opsPrincipal: { userId: string; email: string } } }>();
    app.use('*', opsGate);
    app.get('/secret', (c) => c.json({ reached: true, principal: c.get('opsPrincipal') }));
    const res = await app.request('/secret', { headers: { Authorization: 'Bearer valid' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reached: true, principal: { userId: 'u3', email: BETA } });
  });
});

describe('refusals are indistinguishable — from each other AND from an unmounted route', () => {
  it('returns the same status, body and content-type on every deny path', async () => {
    const bodies: string[] = [];
    const statuses: number[] = [];

    const types: (string | null)[] = [];
    const capture = async (res: Response) => {
      statuses.push(res.status);
      types.push(res.headers.get('content-type'));
      bodies.push(await res.text());
    };

    // 1. kill switch off
    process.env.OPS_HOSTING_ENABLED = 'false';
    await capture(await call(makeApp(), { Authorization: 'Bearer valid' }));

    process.env.OPS_HOSTING_ENABLED = 'true';
    // 2. anonymous
    await capture(await call(makeApp()));
    // 3. invalid token
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad jwt' } });
    await capture(await call(makeApp(), { Authorization: 'Bearer nope' }));
    // 4. valid token, not allowlisted
    getUser.mockResolvedValue({ data: { user: { id: 'u2', email: COHORT } }, error: null });
    await capture(await call(makeApp(), { Authorization: 'Bearer valid-cohort' }));
    // 5. auth backend down
    getUser.mockRejectedValue(new Error('supabase down'));
    await capture(await call(makeApp(), { Authorization: 'Bearer valid' }));

    expect(statuses).toEqual([404, 404, 404, 404, 404]);
    expect(new Set(bodies).size).toBe(1);
    expect(new Set(types).size).toBe(1);

    // …and identical to what a route that was never mounted returns. A distinctive
    // refusal body would itself disclose that an /api/ops mount exists — measured
    // against the live API on 2026-07-28, an unrouted path answers exactly this.
    const bare = new Hono();
    const unmounted = await bare.request('/no-such-route');
    expect(bodies[0]).toBe(await unmounted.text());
    expect(types[0]).toBe(unmounted.headers.get('content-type'));
    expect(statuses[0]).toBe(unmounted.status);
  });
});
