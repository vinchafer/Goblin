// AKT 2 · PHASE 2.5 · U-C1 — the SECOND authorization path on the operator surface.
//
// Rule 6 scopes this precisely, and each clause is a test below:
//   • the x-admin-key path stays intact and unchanged  → "regression" block
//   • a founder session may call these routes with its bearer  → "founder session"
//   • every action writes an audit row with the ACTOR'S EMAIL  → "the audit row"
//   • the allowlist is server-side only                → "nothing leaks"
//   • unset env = nobody                               → "unset means nobody"
//   • independent of OPS_BETA_ACCOUNTS / OPS_HOSTING_ENABLED → "independence"
//
// The operator service is mocked: this file is about WHO may call and WHAT gets
// recorded, not about whether suspension works (ops-operator has its own tests).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const getUser = vi.fn();
vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({ auth: { getUser: (...a: unknown[]) => getUser(...a) } }),
}));

const suspendApp = vi.fn();
const unsuspendApp = vi.fn();
const teardownApp = vi.fn();
const purgeOrphans = vi.fn();
const findApp = vi.fn();
vi.mock('../services/ops-operator', () => ({
  findApp: (...a: unknown[]) => findApp(...a),
  suspendApp: (...a: unknown[]) => suspendApp(...a),
  unsuspendApp: (...a: unknown[]) => unsuspendApp(...a),
  teardownApp: (...a: unknown[]) => teardownApp(...a),
  purgeOrphans: (...a: unknown[]) => purgeOrphans(...a),
  findOrphanedApps: async () => ({ orphans: [], checked: 0 }),
}));

vi.mock('../services/ops-audit', () => ({ readOpsAudit: async () => [] }));
vi.mock('../services/cf-deploy', () => ({ opsAppsDomain: () => 'justgoblin.app' }));

const { opsAdmin } = await import('./ops-admin');

const FOUNDER = 'vinc.hafner3@gmail.com';
const BETA_NOT_FOUNDER = 'beta.tester@example.com';
const COHORT = 'real.user@example.com';
const ADMIN_KEY = 'test-admin-key';

const APP = { appId: 'app-1', appName: 'demo', userId: 'owner-1', status: 'live' };

function req(path: string, init: RequestInit = {}) {
  return opsAdmin.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    body: init.body ?? JSON.stringify({ reason: 'Testgrund' }),
    ...init,
  });
}

/** The founder's browser session: a normal bearer token, nothing else. */
function founderSession() {
  getUser.mockResolvedValue({ data: { user: { id: 'u-founder', email: FOUNDER } }, error: null });
  return { Authorization: 'Bearer founder-token' };
}

function sessionFor(email: string, id = 'u-other') {
  getUser.mockResolvedValue({ data: { user: { id, email } }, error: null });
  return { Authorization: 'Bearer some-token' };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_API_KEY = ADMIN_KEY;
  process.env.OPS_FOUNDER_ACCOUNTS = FOUNDER;
  process.env.OPS_BETA_ACCOUNTS = BETA_NOT_FOUNDER;
  delete process.env.OPS_HOSTING_ENABLED;
  findApp.mockResolvedValue(APP);
  suspendApp.mockResolvedValue({ ok: true, route: 'ok', registry: 'ok', audit: 'written' });
  unsuspendApp.mockResolvedValue({ ok: true, route: 'ok', registry: 'ok', audit: 'written' });
  teardownApp.mockResolvedValue({ ok: true, filesDeleted: 3, batches: 1, orphansRemaining: 0, routeGone: true, audit: 'written' });
  purgeOrphans.mockResolvedValue({ ok: true, deleted: [] });
});

afterEach(() => {
  delete process.env.ADMIN_API_KEY;
  delete process.env.OPS_FOUNDER_ACCOUNTS;
  delete process.env.OPS_BETA_ACCOUNTS;
  delete process.env.OPS_HOSTING_ENABLED;
});

describe('regression — the x-admin-key path is unchanged', () => {
  it('still admits a correct key on every write route', async () => {
    const h = { 'x-admin-key': ADMIN_KEY };
    expect((await req('/apps/demo/suspend', { headers: h })).status).toBe(200);
    expect((await req('/apps/demo/unsuspend', { headers: h })).status).toBe(200);
    expect((await req('/apps/demo', { method: 'DELETE', headers: h })).status).toBe(200);
    expect(getUser).not.toHaveBeenCalled(); // the key path never touches auth
  });

  it('still refuses a wrong, empty or absent key with 401 {"error":"Unauthorized"}', async () => {
    const cases: Record<string, string>[] = [{}, { 'x-admin-key': '' }, { 'x-admin-key': 'wrong' }];
    for (const h of cases) {
      const res = await req('/apps/demo/suspend', { headers: h });
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'Unauthorized' });
    }
  });

  it('still refuses everyone when ADMIN_API_KEY itself is unset', async () => {
    delete process.env.ADMIN_API_KEY;
    const res = await req('/apps/demo/suspend', { headers: { 'x-admin-key': '' } });
    expect(res.status).toBe(401);
  });

  it('still records the self-declared actor on the key path, and its honest fallback', async () => {
    await req('/apps/demo/suspend', {
      headers: { 'x-admin-key': ADMIN_KEY },
      body: JSON.stringify({ reason: 'r', actor: 'steven@example.com' }),
    });
    expect(suspendApp).toHaveBeenLastCalledWith(APP, 'steven@example.com', 'r');

    await req('/apps/demo/suspend', { headers: { 'x-admin-key': ADMIN_KEY } });
    expect(suspendApp).toHaveBeenLastCalledWith(APP, 'admin-key-holder', 'Testgrund');
  });

  it('still demands a reason on every write', async () => {
    const h = { 'x-admin-key': ADMIN_KEY };
    for (const path of ['/apps/demo/suspend', '/apps/demo/unsuspend']) {
      const res = await req(path, { headers: h, body: JSON.stringify({}) });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('missing_reason');
    }
    expect(suspendApp).not.toHaveBeenCalled();
  });
});

describe('founder session — the new path', () => {
  it('admits a founder bearer token with NO admin key at all', async () => {
    const res = await req('/apps/demo/suspend', { headers: founderSession() });
    expect(res.status).toBe(200);
    expect(suspendApp).toHaveBeenCalledOnce();
  });

  it('admits the founder on unsuspend, teardown and orphan purge', async () => {
    expect((await req('/apps/demo/unsuspend', { headers: founderSession() })).status).toBe(200);
    expect((await req('/apps/demo', { method: 'DELETE', headers: founderSession() })).status).toBe(200);
    const purge = await req('/orphans/purge', {
      headers: founderSession(),
      body: JSON.stringify({ reason: 'Aufräumen', appIds: ['x'] }),
    });
    expect(purge.status).toBe(200);
  });

  it('still demands a reason — the new path is not a shortcut past §8.4', async () => {
    const res = await req('/apps/demo/suspend', { headers: founderSession(), body: JSON.stringify({}) });
    expect(res.status).toBe(400);
    expect(suspendApp).not.toHaveBeenCalled();
  });
});

describe('the audit row carries the ACTOR', () => {
  it('records the verified founder email on suspend, unsuspend, teardown and purge', async () => {
    await req('/apps/demo/suspend', { headers: founderSession() });
    expect(suspendApp).toHaveBeenLastCalledWith(APP, FOUNDER, 'Testgrund');

    await req('/apps/demo/unsuspend', { headers: founderSession() });
    expect(unsuspendApp).toHaveBeenLastCalledWith(APP, FOUNDER, 'Testgrund');

    await req('/apps/demo', { method: 'DELETE', headers: founderSession() });
    expect(teardownApp).toHaveBeenLastCalledWith(APP, FOUNDER, 'Testgrund');

    await req('/orphans/purge', {
      headers: founderSession(),
      body: JSON.stringify({ reason: 'Aufräumen', appIds: ['x'] }),
    });
    expect(purgeOrphans).toHaveBeenLastCalledWith(['x'], FOUNDER, 'Aufräumen');
  });

  it('does NOT let the body forge the actor on the founder path', async () => {
    await req('/apps/demo/suspend', {
      headers: founderSession(),
      body: JSON.stringify({ reason: 'r', actor: 'somebody.else@example.com' }),
    });
    expect(suspendApp).toHaveBeenLastCalledWith(APP, FOUNDER, 'r');
  });

  it('does NOT let the x-admin-actor header forge the actor on the founder path', async () => {
    await req('/apps/demo/suspend', {
      headers: { ...founderSession(), 'x-admin-actor': 'somebody.else@example.com' },
    });
    expect(suspendApp).toHaveBeenLastCalledWith(APP, FOUNDER, 'Testgrund');
  });

  it('passes the outcome through verbatim, including "unavailable" pre-0100', async () => {
    suspendApp.mockResolvedValue({ ok: true, route: 'ok', registry: 'ok', audit: 'unavailable' });
    const res = await req('/apps/demo/suspend', { headers: founderSession() });
    expect((await res.json()).audit).toBe('unavailable');
  });
});

describe('unset means nobody', () => {
  it('refuses the founder when OPS_FOUNDER_ACCOUNTS is unset', async () => {
    delete process.env.OPS_FOUNDER_ACCOUNTS;
    const res = await req('/apps/demo/suspend', { headers: founderSession() });
    expect(res.status).toBe(401);
    expect(getUser).not.toHaveBeenCalled(); // never even asks who this is
    expect(suspendApp).not.toHaveBeenCalled();
  });

  it('refuses the founder for every empty-ish value of the allowlist', async () => {
    for (const v of ['', '  ', ',', ' , ']) {
      process.env.OPS_FOUNDER_ACCOUNTS = v;
      const res = await req('/apps/demo/suspend', { headers: founderSession() });
      expect(res.status, `value ${JSON.stringify(v)} must admit nobody`).toBe(401);
    }
  });

  it('leaves the x-admin-key path working when the allowlist is unset', async () => {
    delete process.env.OPS_FOUNDER_ACCOUNTS;
    expect((await req('/apps/demo/suspend', { headers: { 'x-admin-key': ADMIN_KEY } })).status).toBe(200);
  });
});

describe('independence — going dark does not disarm the kill switch', () => {
  it('admits the founder with OPS_HOSTING_ENABLED off, unset and malformed', async () => {
    for (const v of [undefined, 'false', '', '0']) {
      if (v === undefined) delete process.env.OPS_HOSTING_ENABLED;
      else process.env.OPS_HOSTING_ENABLED = v;
      const res = await req('/apps/demo/suspend', { headers: founderSession() });
      expect(res.status, `hosting=${String(v)} must not disarm the stop`).toBe(200);
    }
  });

  it('refuses a beta-but-not-founder account even with hosting fully on', async () => {
    process.env.OPS_HOSTING_ENABLED = 'true';
    const res = await req('/apps/demo/suspend', { headers: sessionFor(BETA_NOT_FOUNDER) });
    expect(res.status).toBe(401);
    expect(suspendApp).not.toHaveBeenCalled();
  });

  it('refuses a normal Act-1 cohort user', async () => {
    const res = await req('/apps/demo/suspend', { headers: sessionFor(COHORT) });
    expect(res.status).toBe(401);
  });

  it('admits the founder who is NOT on the beta allowlist', async () => {
    process.env.OPS_BETA_ACCOUNTS = BETA_NOT_FOUNDER;
    expect((await req('/apps/demo/suspend', { headers: founderSession() })).status).toBe(200);
  });
});

describe('nothing leaks', () => {
  it('never puts an allowlisted address, or the allowlist, in a response body', async () => {
    process.env.OPS_FOUNDER_ACCOUNTS = `${FOUNDER},someone.private@example.com`;
    const refused = await req('/apps/demo/suspend', { headers: sessionFor(COHORT) });
    const body = await refused.text();
    expect(body).toBe(JSON.stringify({ error: 'Unauthorized' }));
    expect(body).not.toContain('@');
  });

  it('refuses an invalid token and an unreachable Supabase alike, with 401', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad jwt' } });
    expect((await req('/apps/demo/suspend', { headers: { Authorization: 'Bearer x' } })).status).toBe(401);

    getUser.mockRejectedValue(new Error('ECONNREFUSED'));
    expect((await req('/apps/demo/suspend', { headers: { Authorization: 'Bearer x' } })).status).toBe(401);
    expect(suspendApp).not.toHaveBeenCalled();
  });
});
