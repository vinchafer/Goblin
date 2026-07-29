// AKT 2 · PHASE 2.5 · U-C1 — the four gate cases, driven through a real Hono app.
//
// The invariant under test is not "unauthorized users get an error" — it is "the
// console does not appear to exist, and every refusal is byte-identical", so a
// live Act-1 user cannot detect it by comparing responses.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';

const getUser = vi.fn();
vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({ auth: { getUser: (...a: unknown[]) => getUser(...a) } }),
}));

const { opsFounderGate, resolveFounder } = await import('./ops-founder-gate');

const FOUNDER = 'vinc.hafner3@gmail.com';
const BETA_NOT_FOUNDER = 'beta.tester@example.com';
const COHORT = 'real.user@example.com';

function makeApp() {
  const app = new Hono();
  app.use('*', opsFounderGate);
  app.get('/console', (c) => c.json({ reached: true }));
  return app;
}

function call(headers: Record<string, string> = {}) {
  return makeApp().request('/console', { headers });
}

/** Bearer for whoever `getUser` is currently mocked to return. */
function asUser(email: string | null, id = 'u1') {
  getUser.mockResolvedValue({ data: { user: { id, email } }, error: null });
  return { Authorization: 'Bearer token' };
}

beforeEach(() => {
  getUser.mockReset();
  process.env.OPS_FOUNDER_ACCOUNTS = FOUNDER;
  // Both Act-2 switches are ON throughout, so nothing below can pass or fail
  // because of them — this gate must be independent of both.
  process.env.OPS_HOSTING_ENABLED = 'true';
  process.env.OPS_BETA_ACCOUNTS = `${FOUNDER},${BETA_NOT_FOUNDER}`;
});

afterEach(() => {
  delete process.env.OPS_FOUNDER_ACCOUNTS;
  delete process.env.OPS_HOSTING_ENABLED;
  delete process.env.OPS_BETA_ACCOUNTS;
});

describe('the four gate cases', () => {
  it('CASE 1 — founder in: allowed', async () => {
    const res = await call(asUser(FOUNDER));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reached: true });
  });

  it('CASE 2 — beta but NOT founder: 404', async () => {
    const res = await call(asUser(BETA_NOT_FOUNDER, 'u2'));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('404 Not Found');
  });

  it('CASE 3 — normal Act-1 user: 404', async () => {
    const res = await call(asUser(COHORT, 'u3'));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('404 Not Found');
  });

  it('CASE 4 — env unset: nobody, the founder included', async () => {
    delete process.env.OPS_FOUNDER_ACCOUNTS;
    const res = await call(asUser(FOUNDER));
    expect(res.status).toBe(404);
    // Cheapest check first: with no allowlist we never even ask Supabase who this is.
    expect(getUser).not.toHaveBeenCalled();
  });
});

describe('every other refusal path, and all of them identical', () => {
  it('404s for an anonymous request', async () => {
    expect((await call()).status).toBe(404);
  });

  it('404s for a malformed Authorization header, without an auth round-trip', async () => {
    for (const h of ['', 'Bearer', 'Basic abc', 'bearer token', 'Token token']) {
      expect((await call({ Authorization: h })).status).toBe(404);
    }
    expect(getUser).not.toHaveBeenCalled();
  });

  it('404s for an invalid token', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad jwt' } });
    expect((await call({ Authorization: 'Bearer nope' })).status).toBe(404);
  });

  it('404s for a valid session with no email', async () => {
    expect((await call(asUser(null))).status).toBe(404);
  });

  it('fails CLOSED when Supabase is unreachable', async () => {
    getUser.mockRejectedValue(new Error('ECONNREFUSED'));
    expect((await call({ Authorization: 'Bearer token' })).status).toBe(404);
  });

  it('answers every refusal with the SAME bytes, status and content type', async () => {
    const refusals = [
      await call(), // anonymous
      await call({ Authorization: 'Basic abc' }), // malformed
      await (async () => {
        getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad' } });
        return call({ Authorization: 'Bearer nope' });
      })(), // invalid token
      await call(asUser(COHORT, 'u3')), // valid token, wrong human
      await (async () => {
        delete process.env.OPS_FOUNDER_ACCOUNTS;
        return call(asUser(FOUNDER));
      })(), // allowlist unset
    ];

    const shapes = await Promise.all(
      refusals.map(async (r) => `${r.status}|${r.headers.get('content-type')}|${await r.text()}`),
    );
    expect(new Set(shapes).size, `refusals differ: ${JSON.stringify(shapes, null, 2)}`).toBe(1);
    expect(shapes[0]).toBe('404|text/plain; charset=UTF-8|404 Not Found');
  });

  it('is byte-identical to an unrouted path on the same app', async () => {
    const app = makeApp();
    const unrouted = await app.request('/no-such-route-at-all');
    const refused = await app.request('/console');
    expect(refused.status).toBe(unrouted.status);
    expect(refused.headers.get('content-type')).toBe(unrouted.headers.get('content-type'));
    expect(await refused.text()).toBe(await unrouted.text());
  });
});

describe('the server-side reason is TRUE, while the wire answer stays uniform', () => {
  it('distinguishes every refusal path for the log', async () => {
    delete process.env.OPS_FOUNDER_ACCOUNTS;
    expect((await resolveFounder('Bearer t')).ok).toBe(false);
    expect(await resolveFounder('Bearer t')).toEqual({ ok: false, reason: 'not_configured' });

    process.env.OPS_FOUNDER_ACCOUNTS = FOUNDER;
    expect(await resolveFounder(undefined)).toEqual({ ok: false, reason: 'no_bearer' });
    expect(await resolveFounder('Basic abc')).toEqual({ ok: false, reason: 'no_bearer' });

    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad jwt' } });
    expect(await resolveFounder('Bearer t')).toEqual({ ok: false, reason: 'invalid_token' });

    getUser.mockResolvedValue({ data: { user: { id: 'u', email: null } }, error: null });
    expect(await resolveFounder('Bearer t')).toEqual({ ok: false, reason: 'no_email' });

    getUser.mockResolvedValue({ data: { user: { id: 'u', email: COHORT } }, error: null });
    expect(await resolveFounder('Bearer t')).toEqual({ ok: false, reason: 'not_allowlisted' });

    getUser.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await resolveFounder('Bearer t')).toEqual({ ok: false, reason: 'auth_error' });
  });

  it('returns the principal, and only the principal, on success', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u9', email: FOUNDER.toUpperCase() } }, error: null });
    expect(await resolveFounder('Bearer t')).toEqual({
      ok: true,
      principal: { userId: 'u9', email: FOUNDER.toUpperCase() },
    });
  });
});

describe('independence from the Act-2 switches', () => {
  it('admits the founder with OPS_HOSTING_ENABLED off — going dark must not disarm the operator', async () => {
    process.env.OPS_HOSTING_ENABLED = 'false';
    expect((await call(asUser(FOUNDER))).status).toBe(200);
  });

  it('admits the founder with OPS_HOSTING_ENABLED unset', async () => {
    delete process.env.OPS_HOSTING_ENABLED;
    expect((await call(asUser(FOUNDER))).status).toBe(200);
  });

  it('admits the founder who is NOT on the beta allowlist', async () => {
    process.env.OPS_BETA_ACCOUNTS = BETA_NOT_FOUNDER;
    expect((await call(asUser(FOUNDER))).status).toBe(200);
  });

  it('refuses a beta account even with both Act-2 switches wide open', async () => {
    process.env.OPS_HOSTING_ENABLED = 'true';
    process.env.OPS_BETA_ACCOUNTS = BETA_NOT_FOUNDER;
    expect((await call(asUser(BETA_NOT_FOUNDER, 'u2'))).status).toBe(404);
  });
});
