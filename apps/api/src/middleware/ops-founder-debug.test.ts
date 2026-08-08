/**
 * AKT 2 · PHASE 2.5 — the OPS_FOUNDER_DEBUG window.
 *
 * Two properties carry this unit and both are tested against, not for:
 *
 *   1. OFF IS TODAY, EXACTLY. With the flag unset, every refusal is byte-for-byte
 *      what it was before this feature existed — status, body, content-type, and
 *      the ABSENCE of the header. `ops-cohort-protection.test.ts` and
 *      `ops-founder-gate.test.ts` are the load-bearing proof of this and were not
 *      touched; the assertions here are the belt to that braces, stated on the
 *      response object so a future change to `notFound()` cannot pass silently.
 *
 *   2. ON DISCLOSES TO A KNOWN HUMAN AND NOBODY ELSE. The reason rides out only
 *      when the bearer resolved to a real Supabase user. No token, a malformed
 *      token, an invalid token, or a Supabase that could not answer → mute, the
 *      same as today. "We could not tell" must never be rendered as "you are
 *      known", which is why `auth_error` gets its own case below.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';

const getUser = vi.fn();
vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({ auth: { getUser: (...a: unknown[]) => getUser(...a) } }),
}));

const { opsFounderGate, OPS_DEBUG_REASON_HEADER, OPS_FOUNDER_DEBUG_ENV } = await import('./ops-founder-gate');

const FOUNDER = 'vinc.hafner3@gmail.com';
const COHORT = 'real.user@example.com';

function call(headers: Record<string, string> = {}) {
  const app = new Hono();
  app.use('*', opsFounderGate);
  app.get('/console', (c) => c.json({ reached: true }));
  return app.request('/console', { headers });
}

function asUser(email: string | null, id = 'u1') {
  getUser.mockResolvedValue({ data: { user: { id, email } }, error: null });
  return { Authorization: 'Bearer token' };
}

/** The refusal as it has always looked. Anything else is a regression. */
async function expectMuteRefusal(res: Response) {
  expect(res.status).toBe(404);
  expect(await res.text()).toBe('404 Not Found');
  expect(res.headers.get('content-type')).toBe('text/plain; charset=UTF-8');
  expect(res.headers.get(OPS_DEBUG_REASON_HEADER)).toBeNull();
}

beforeEach(() => {
  getUser.mockReset();
  process.env.OPS_FOUNDER_ACCOUNTS = FOUNDER;
  process.env.OPS_HOSTING_ENABLED = 'true';
  delete process.env[OPS_FOUNDER_DEBUG_ENV];
});

afterEach(() => {
  delete process.env.OPS_FOUNDER_ACCOUNTS;
  delete process.env.OPS_HOSTING_ENABLED;
  delete process.env[OPS_FOUNDER_DEBUG_ENV];
});

describe('window CLOSED (the default, and production)', () => {
  it('a real user who is not allowlisted gets the mute 404', async () => {
    await expectMuteRefusal(await call(asUser(COHORT)));
  });

  it('an unconfigured allowlist gets the mute 404 — and never touches Supabase', async () => {
    delete process.env.OPS_FOUNDER_ACCOUNTS;
    await expectMuteRefusal(await call(asUser(FOUNDER)));
    // The fast path is the reason the window costs nothing when closed.
    expect(getUser).not.toHaveBeenCalled();
  });

  it('no bearer, malformed bearer and an invalid token all get the mute 404', async () => {
    await expectMuteRefusal(await call());
    await expectMuteRefusal(await call({ Authorization: 'NotBearer x' }));
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad jwt' } });
    await expectMuteRefusal(await call({ Authorization: 'Bearer token' }));
  });

  it('a user with no email gets the mute 404', async () => {
    await expectMuteRefusal(await call(asUser(null)));
  });

  it('an unreachable Supabase gets the mute 404', async () => {
    getUser.mockRejectedValue(new Error('ECONNRESET'));
    await expectMuteRefusal(await call({ Authorization: 'Bearer token' }));
  });

  it('the founder is still let in — the flag changes nothing about who passes', async () => {
    const res = await call(asUser(FOUNDER));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reached: true });
  });
});

describe('window OPEN — discloses to a known human', () => {
  beforeEach(() => { process.env[OPS_FOUNDER_DEBUG_ENV] = 'true'; });

  it('not_allowlisted: a real user learns WHY, and the body is still the same 404', async () => {
    const res = await call(asUser(COHORT));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('404 Not Found');
    expect(res.headers.get(OPS_DEBUG_REASON_HEADER)).toBe('not_allowlisted');
  });

  it('not_configured: the answer the founder most needs, paid for with one extra lookup', async () => {
    delete process.env.OPS_FOUNDER_ACCOUNTS;
    const res = await call(asUser(FOUNDER));
    expect(res.status).toBe(404);
    expect(res.headers.get(OPS_DEBUG_REASON_HEADER)).toBe('not_configured');
    // resolveFounder() short-circuits before Supabase on this path, so the window
    // has to establish realness itself. Exactly one call, and only while open.
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it('no_email: a real user with no address still learns why', async () => {
    const res = await call(asUser(null));
    expect(res.headers.get(OPS_DEBUG_REASON_HEADER)).toBe('no_email');
  });

  it('the founder is still let in, with no header on the success path', async () => {
    const res = await call(asUser(FOUNDER));
    expect(res.status).toBe(200);
    expect(res.headers.get(OPS_DEBUG_REASON_HEADER)).toBeNull();
  });
});

describe('window OPEN — still mute for anyone not established as a real user', () => {
  beforeEach(() => { process.env[OPS_FOUNDER_DEBUG_ENV] = 'true'; });

  it('no bearer learns nothing', async () => {
    await expectMuteRefusal(await call());
  });

  it('a malformed Authorization header learns nothing', async () => {
    await expectMuteRefusal(await call({ Authorization: 'NotBearer x' }));
    await expectMuteRefusal(await call({ Authorization: 'Bearer' }));
  });

  it('an invalid token learns nothing', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad jwt' } });
    await expectMuteRefusal(await call({ Authorization: 'Bearer token' }));
  });

  it('an unreachable Supabase learns nothing — UNKNOWN is never rendered as KNOWN', async () => {
    getUser.mockRejectedValue(new Error('ECONNRESET'));
    await expectMuteRefusal(await call({ Authorization: 'Bearer token' }));
  });

  it('not_configured plus an invalid token learns nothing', async () => {
    delete process.env.OPS_FOUNDER_ACCOUNTS;
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad jwt' } });
    await expectMuteRefusal(await call({ Authorization: 'Bearer token' }));
  });

  it('not_configured plus NO bearer learns nothing, and costs no lookup', async () => {
    delete process.env.OPS_FOUNDER_ACCOUNTS;
    await expectMuteRefusal(await call());
    expect(getUser).not.toHaveBeenCalled();
  });
});

describe('the flag is itself a pasted Railway value', () => {
  const ON = ['true', '"true"', "'true'", '  true  ', 'TRUE', '"TRUE"', '\ntrue\n'];

  it.each(ON)('%j opens the window', async (raw) => {
    process.env[OPS_FOUNDER_DEBUG_ENV] = raw;
    const res = await call(asUser(COHORT));
    expect(res.headers.get(OPS_DEBUG_REASON_HEADER)).toBe('not_allowlisted');
  });

  it('every non-true value leaves it closed — the safe direction', async () => {
    for (const raw of ['', '   ', 'false', '"false"', '1', '"1"', 'yes', '""', 'truthy']) {
      process.env[OPS_FOUNDER_DEBUG_ENV] = raw;
      await expectMuteRefusal(await call(asUser(COHORT)));
    }
  });
});
