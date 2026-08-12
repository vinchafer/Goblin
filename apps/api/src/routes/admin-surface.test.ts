// AKT 2 · PHASE 2.5 — the mount order of /api/admin, held in place.
//
// ops-admin-founder.test.ts proves the operator surface's own gate by calling
// `opsAdmin.request()` — the router in isolation. That test passed while the
// console's suspend and teardown buttons answered 401, because the defect was not
// IN the router: `/api/admin` was mounted first, its `use('*')` admin-key gate
// matched `/api/admin/ops/*` too, and Hono runs matching handlers in registration
// order. So this file asserts against the PRODUCTION composition —
// `mountAdminSurface()`, the same function index.ts calls — and would have failed.
//
// Two properties, and they are the whole point:
//   1. a founder session reaches the operator routes THROUGH the real mount
//   2. it reaches NOTHING ELSE under /api/admin — the rest still wants the key
//
// The operator service is mocked (ops-operator has its own tests); this file is
// about which requests arrive at which handler.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';

const getUser = vi.fn();
vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({ auth: { getUser: (...a: unknown[]) => getUser(...a) } }),
}));

const suspendApp = vi.fn();
const teardownApp = vi.fn();
vi.mock('../services/ops-operator', () => ({
  findApp: async () => ({ appId: 'app-1', appName: 'demo', userId: 'owner-1', status: 'live' }),
  suspendApp: (...a: unknown[]) => suspendApp(...a),
  unsuspendApp: async () => ({ ok: true }),
  teardownApp: (...a: unknown[]) => teardownApp(...a),
  purgeOrphans: async () => ({ ok: true, deleted: [] }),
  findOrphanedApps: async () => ({ orphans: [], checked: 0 }),
}));
vi.mock('../services/ops-audit', () => ({ readOpsAudit: async () => [] }));
vi.mock('../services/cf-deploy', () => ({ opsAppsDomain: () => 'justgoblin.app' }));

const { mountAdminSurface } = await import('./admin-surface');

const FOUNDER = 'vinc.hafner3@gmail.com';
const COHORT = 'real.user@example.com';
const ADMIN_KEY = 'test-admin-key';

/** The app exactly as index.ts builds it, via the one function that owns the order. */
function app() {
  const a = new Hono<{ Variables: { requestId: string } }>();
  mountAdminSurface(a);
  return a;
}

function session(email: string) {
  getUser.mockResolvedValue({ data: { user: { id: 'u-1', email } }, error: null });
  return { Authorization: 'Bearer a-real-supabase-token' };
}

function suspend(headers: Record<string, string>) {
  return app().request('/api/admin/ops/apps/app-1/suspend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ reason: 'Testgrund' }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_API_KEY = ADMIN_KEY;
  process.env.OPS_FOUNDER_ACCOUNTS = FOUNDER;
  delete process.env.OPS_HOSTING_ENABLED;
  suspendApp.mockResolvedValue({ ok: true, route: 'ok', registry: 'ok', audit: 'written' });
  teardownApp.mockResolvedValue({ ok: true, filesDeleted: 3, batches: 1, orphansRemaining: 0, routeGone: true, audit: 'written' });
});

afterEach(() => {
  delete process.env.ADMIN_API_KEY;
  delete process.env.OPS_FOUNDER_ACCOUNTS;
  delete process.env.OPS_HOSTING_ENABLED;
});

describe('the founder session reaches the operator routes through the real mount', () => {
  it('POST /api/admin/ops/apps/:id/suspend — 200, not the admin surface 401', async () => {
    const res = await suspend(session(FOUNDER));
    expect(res.status).toBe(200);
    expect(suspendApp).toHaveBeenCalledOnce();
  });

  it('DELETE /api/admin/ops/apps/:id — 200, with the VERIFIED email as actor', async () => {
    const res = await app().request('/api/admin/ops/apps/app-1', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...session(FOUNDER) },
      body: JSON.stringify({ reason: 'Aufräumen' }),
    });
    expect(res.status).toBe(200);
    expect(teardownApp).toHaveBeenLastCalledWith(expect.objectContaining({ appId: 'app-1' }), FOUNDER, 'Aufräumen');
  });

  it('writes the audit row against the verified email even when the body claims otherwise', async () => {
    await app().request('/api/admin/ops/apps/app-1/suspend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...session(FOUNDER) },
      body: JSON.stringify({ reason: 'r', actor: 'somebody.else@example.com' }),
    });
    expect(suspendApp).toHaveBeenLastCalledWith(expect.objectContaining({ appId: 'app-1' }), FOUNDER, 'r');
  });

  it('is not disarmed by OPS_HOSTING_ENABLED — the kill switch cannot turn off the kill switch', async () => {
    for (const v of [undefined, 'false', '', '0']) {
      if (v === undefined) delete process.env.OPS_HOSTING_ENABLED;
      else process.env.OPS_HOSTING_ENABLED = v;
      expect((await suspend(session(FOUNDER))).status, `hosting=${String(v)}`).toBe(200);
    }
  });
});

describe('the x-admin-key path is unchanged by the reorder', () => {
  it('still admits a correct key on the operator routes', async () => {
    expect((await suspend({ 'x-admin-key': ADMIN_KEY })).status).toBe(200);
    expect(getUser).not.toHaveBeenCalled(); // the key path still never touches auth
  });

  it('still reaches the ordinary admin surface with a correct key', async () => {
    const res = await app().request('/api/admin/metrics', { headers: { 'x-admin-key': ADMIN_KEY } });
    expect(res.status).toBe(200);
  });
});

describe('cohort protection — the founder bearer opens the operator routes and nothing else', () => {
  it('does NOT open the rest of /api/admin', async () => {
    for (const path of ['/api/admin/metrics', '/api/admin/users', '/api/admin/stats', '/api/admin/rankings/sources']) {
      const res = await app().request(path, { headers: session(FOUNDER) });
      expect(res.status, `founder bearer must not open ${path}`).toBe(401);
      expect(await res.json()).toEqual({ error: 'Unauthorized' });
    }
  });

  it('refuses an Act-1 cohort session on the operator routes, with the surface 401', async () => {
    const res = await suspend(session(COHORT));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    expect(suspendApp).not.toHaveBeenCalled();
  });

  it('refuses a request with no credentials at all', async () => {
    const res = await suspend({});
    expect(res.status).toBe(401);
    expect(suspendApp).not.toHaveBeenCalled();
  });

  it('admits nobody through the second path when OPS_FOUNDER_ACCOUNTS is unset', async () => {
    delete process.env.OPS_FOUNDER_ACCOUNTS;
    const res = await suspend(session(FOUNDER));
    expect(res.status).toBe(401);
    expect(getUser).not.toHaveBeenCalled(); // never even asks who this is
    expect(suspendApp).not.toHaveBeenCalled();
  });

  it('leaks no address and no allowlist in a refusal', async () => {
    process.env.OPS_FOUNDER_ACCOUNTS = `${FOUNDER},someone.private@example.com`;
    const body = await (await suspend(session(COHORT))).text();
    expect(body).toBe(JSON.stringify({ error: 'Unauthorized' }));
    expect(body).not.toContain('@');
  });

  it('keeps the ordinary admin surface gated for everyone without the key', async () => {
    const res = await app().request('/api/admin/metrics');
    expect(res.status).toBe(401);
    const rankings = await app().request('/api/admin/rankings/sources');
    expect(rankings.status).toBe(401);
  });
});
