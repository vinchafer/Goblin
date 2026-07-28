/**
 * AKT 2 · PHASE 2 · U2.7 — COHORT-PROTECTION EVIDENCE.
 *
 * Real Act-1 test users have been live on production since 2026-07-26. Nothing
 * this phase adds may be visible, reachable, or even DETECTABLE for them. This file
 * is the evidence for that claim, and it is deliberately exhaustive rather than
 * representative: it enumerates EVERY route Phase 2 mounts and drives each one
 * through both exclusion dimensions.
 *
 * The enumeration is the point. A single spot-checked endpoint proves nothing about
 * the one somebody adds next month, so ROUTES below is the checklist, and a route
 * missing from it is a route nobody proved anything about.
 *
 *   Dimension 1 — the account: vinc.hafner4@ is NOT on the allowlist
 *   Dimension 2 — the switch:  OPS_HOSTING_ENABLED=false, even for the beta account
 *
 * Both must answer with Hono's byte-identical default 404, so `/api/ops/*` cannot
 * be distinguished from a path that was never mounted.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const getUser = vi.fn();
vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    auth: { getUser: (...a: unknown[]) => getUser(...a) },
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ single: async () => ({ data: null }) }), limit: async () => ({ data: [] }) }),
        limit: async () => ({ data: [] }),
      }),
    }),
  }),
}));

/**
 * Every Cloudflare and storage call is stubbed to THROW. Nothing in this file is
 * supposed to reach them: if a gate ever leaks, the test fails loudly on a real
 * call rather than quietly passing because the mock happened to answer.
 */
const boom = () => { throw new Error('a gated route reached the substrate'); };
vi.mock('../services/cf-deploy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/cf-deploy')>();
  return {
    ...actual,
    checkR2: boom, checkKvNamespace: boom, listWorkers: boom, getWorker: boom,
    findZoneId: boom, listDnsRecords: boom, listWorkerRoutes: boom,
    ensureWildcardDns: boom, ensureWorkerRoute: boom, deployWorker: boom,
    putAppFiles: boom, setRoute: boom, getRoute: boom, deleteRoute: boom,
    listAppFiles: boom, deleteAppFiles: boom, listAppPrefixes: boom,
  };
});

const { ops } = await import('./ops');
const { opsAdmin } = await import('./ops-admin');

const BETA = 'vinc.hafner3@gmail.com';
/** The founder's SECOND account — deliberately not allowlisted (prompt U2.7). */
const NOT_ALLOWLISTED = 'vinc.hafner4@gmail.com';
/** A real Act-1 cohort user. */
const COHORT = 'real.user@example.com';

/** EVERY route Phase 2 mounts under /api/ops. A route missing here is unproven. */
const ROUTES: Array<{ method: string; path: string; body?: unknown }> = [
  { method: 'GET', path: '/health' },
  { method: 'POST', path: '/selftest' },
  { method: 'GET', path: '/router' },
  { method: 'POST', path: '/router/provision' },
  { method: 'GET', path: '/apps' },
  { method: 'GET', path: '/apps/name-check?name=meinladen' },
  { method: 'POST', path: '/apps/publish', body: { projectId: 'proj-1', name: 'meinladen' } },
  { method: 'POST', path: '/apps/app-1/rename', body: { name: 'neuername' } },
  { method: 'POST', path: '/e2e?confirm=RUN-E2E' },
];

function call(route: { method: string; path: string; body?: unknown }, headers: Record<string, string> = {}) {
  return ops.request(route.path, {
    method: route.method,
    headers: { ...(route.body ? { 'content-type': 'application/json' } : {}), ...headers },
    ...(route.body ? { body: JSON.stringify(route.body) } : {}),
  });
}

beforeEach(() => {
  getUser.mockReset();
  process.env.OPS_HOSTING_ENABLED = 'true';
  process.env.OPS_BETA_ACCOUNTS = BETA;
  process.env.OPS_APPS_DOMAIN = 'justgoblin.app';
  process.env.ADMIN_API_KEY = 'admin-key-for-tests';
});

afterEach(() => {
  delete process.env.OPS_HOSTING_ENABLED;
  delete process.env.OPS_BETA_ACCOUNTS;
  delete process.env.OPS_APPS_DOMAIN;
  delete process.env.ADMIN_API_KEY;
});

// ── Dimension 1: the account ────────────────────────────────────────────────

describe('dimension 1 — an account that is not on the allowlist', () => {
  for (const route of ROUTES) {
    it(`${route.method} ${route.path} → 404 for vinc.hafner4@ (a valid login, not allowlisted)`, async () => {
      getUser.mockResolvedValue({ data: { user: { id: 'u-4', email: NOT_ALLOWLISTED } }, error: null });
      const res = await call(route, { Authorization: 'Bearer valid-token-for-account-4' });
      expect(res.status).toBe(404);
      // Byte-identical to Hono's built-in notFound — no distinctive body, so
      // /api/ops/* cannot be told apart from a path that was never mounted.
      expect(await res.text()).toBe('404 Not Found');
      expect(res.headers.get('content-type')).toContain('text/plain');
    });
  }

  for (const route of ROUTES) {
    it(`${route.method} ${route.path} → 404 for a live Act-1 cohort user`, async () => {
      getUser.mockResolvedValue({ data: { user: { id: 'u-cohort', email: COHORT } }, error: null });
      const res = await call(route, { Authorization: 'Bearer valid-cohort-token' });
      expect(res.status).toBe(404);
      expect(await res.text()).toBe('404 Not Found');
    });
  }

  it('answers identically to an anonymous request — nothing can be inferred by comparing', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u-4', email: NOT_ALLOWLISTED } }, error: null });
    const denied = await call(ROUTES[0]!, { Authorization: 'Bearer valid' });
    const anonymous = await call(ROUTES[0]!);
    const unmounted = await ops.request('/gibt-es-nicht');
    const bodies = [await denied.text(), await anonymous.text(), await unmounted.text()];
    expect(new Set(bodies).size).toBe(1);
    expect(new Set([denied.status, anonymous.status, unmounted.status]).size).toBe(1);
  });
});

// ── Dimension 2: the kill switch ────────────────────────────────────────────

describe('dimension 2 — OPS_HOSTING_ENABLED=false, for the ALLOWLISTED account', () => {
  for (const route of ROUTES) {
    it(`${route.method} ${route.path} → 404 even for vinc.hafner3@`, async () => {
      process.env.OPS_HOSTING_ENABLED = 'false';
      getUser.mockResolvedValue({ data: { user: { id: 'u-beta', email: BETA } }, error: null });
      const res = await call(route, { Authorization: 'Bearer valid-beta-token' });
      expect(res.status).toBe(404);
      expect(await res.text()).toBe('404 Not Found');
    });
  }

  it('never even asks Supabase who the caller is — the switch is checked first', async () => {
    process.env.OPS_HOSTING_ENABLED = 'false';
    getUser.mockResolvedValue({ data: { user: { id: 'u-beta', email: BETA } }, error: null });
    for (const route of ROUTES) await call(route, { Authorization: 'Bearer valid-beta-token' });
    expect(getUser).not.toHaveBeenCalled();
  });

  it('treats every not-"true" value as OFF, including the plausible-looking ones', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u-beta', email: BETA } }, error: null });
    for (const value of ['', ' ', 'false', 'FALSE', '0', '1', 'yes', 'on', 'enabled', 'ture']) {
      process.env.OPS_HOSTING_ENABLED = value;
      const res = await call(ROUTES[0]!, { Authorization: 'Bearer valid' });
      expect(res.status, `OPS_HOSTING_ENABLED=${JSON.stringify(value)} must be OFF`).toBe(404);
    }
  });

  it('is off when the variable is missing entirely', async () => {
    delete process.env.OPS_HOSTING_ENABLED;
    getUser.mockResolvedValue({ data: { user: { id: 'u-beta', email: BETA } }, error: null });
    expect((await call(ROUTES[0]!, { Authorization: 'Bearer valid' })).status).toBe(404);
  });

  it('is off when the allowlist is empty, even with the switch on', async () => {
    process.env.OPS_BETA_ACCOUNTS = '';
    getUser.mockResolvedValue({ data: { user: { id: 'u-beta', email: BETA } }, error: null });
    expect((await call(ROUTES[0]!, { Authorization: 'Bearer valid' })).status).toBe(404);
  });
});

// ── The operator surface ────────────────────────────────────────────────────

describe('the operator surface is admin-gated, and adds no new signal', () => {
  const ADMIN_ROUTES: Array<{ method: string; path: string; body?: unknown }> = [
    { method: 'GET', path: '/apps/meinladen' },
    { method: 'POST', path: '/apps/meinladen/suspend', body: { reason: 'test' } },
    { method: 'POST', path: '/apps/meinladen/unsuspend', body: { reason: 'test' } },
    { method: 'DELETE', path: '/apps/meinladen', body: { reason: 'test' } },
    { method: 'GET', path: '/orphans' },
    { method: 'POST', path: '/orphans/purge', body: { reason: 'test', appIds: ['x'] } },
  ];

  for (const route of ADMIN_ROUTES) {
    it(`${route.method} ${route.path} → 401 without the admin key`, async () => {
      const res = await opsAdmin.request(route.path, {
        method: route.method,
        headers: route.body ? { 'content-type': 'application/json' } : {},
        ...(route.body ? { body: JSON.stringify(route.body) } : {}),
      });
      expect(res.status).toBe(401);
      // Identical to every other /api/admin route — the refusal reveals nothing
      // new about Act 2 to anyone probing it.
      expect(await res.json()).toEqual({ error: 'Unauthorized' });
    });
  }

  it('refuses a cohort user`s bearer token — an admin route is not a user route', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u-cohort', email: COHORT } }, error: null });
    const res = await opsAdmin.request('/orphans', { headers: { Authorization: 'Bearer valid-cohort-token' } });
    expect(res.status).toBe(401);
  });

  it('refuses a WRONG admin key', async () => {
    const res = await opsAdmin.request('/orphans', { headers: { 'x-admin-key': 'nicht-der-schlüssel' } });
    expect(res.status).toBe(401);
  });

  it('refuses everything when ADMIN_API_KEY is unset — no empty-key bypass', async () => {
    delete process.env.ADMIN_API_KEY;
    expect((await opsAdmin.request('/orphans', { headers: { 'x-admin-key': '' } })).status).toBe(401);
    expect((await opsAdmin.request('/orphans')).status).toBe(401);
  });

  it('stays reachable with OPS_HOSTING_ENABLED=false — the emergency stop is not gated by the kill switch', async () => {
    // Deliberate and load-bearing: the router serves from KV and never asks the
    // API anything, so turning Act 2 dark must NOT also disarm the per-app stop.
    // (It still needs the admin key; this asserts the switch is not an extra gate.)
    process.env.OPS_HOSTING_ENABLED = 'false';
    const res = await opsAdmin.request('/orphans', { headers: { 'x-admin-key': 'admin-key-for-tests' } });
    expect(res.status).not.toBe(404);
  });
});

// ── The router itself ───────────────────────────────────────────────────────

describe('the router serves only 404s while nothing is published', () => {
  let worker: { fetch: (r: Request, e: Record<string, unknown>) => Promise<Response> };

  beforeEach(async () => {
    const { ROUTER_WORKER_SOURCE } = await import('../services/ops-router/worker-source.generated');
    const dataUrl = `data:text/javascript;base64,${Buffer.from(ROUTER_WORKER_SOURCE, 'utf8').toString('base64')}`;
    worker = ((await import(/* @vite-ignore */ dataUrl)) as { default: typeof worker }).default;
  });

  /** An EMPTY KV namespace and an EMPTY bucket — the state before the first publish. */
  const emptyPlane = () => ({
    ROUTES: { get: async () => null },
    APPS: { get: async () => null },
    APPS_DOMAIN: 'justgoblin.app',
    SITE_URL: 'https://justgoblin.com',
  });

  it('404s every hostname anyone could try', async () => {
    for (const host of ['meinladen', 'test', 'goblin', 'irgendwas', 'a-b-c']) {
      const res = await worker.fetch(new Request(`https://${host}.justgoblin.app/`), emptyPlane());
      expect(res.status).toBe(404);
    }
  });

  it('404s every path, not just the root', async () => {
    for (const path of ['/', '/index.html', '/assets/app.js', '/admin', '/.env', '/api/users']) {
      const res = await worker.fetch(new Request(`https://meinladen.justgoblin.app${path}`), emptyPlane());
      expect(res.status).toBe(404);
    }
  });

  it('leaks nothing about Goblin`s internals on the way', async () => {
    const html = await (await worker.fetch(new Request('https://meinladen.justgoblin.app/'), emptyPlane())).text();
    for (const secret of ['R2', 'KV', 'Cloudflare', 'apps/', 'route:', 'worker']) {
      expect(html).not.toContain(secret);
    }
  });

  it('still sends the apex to the marketing site — that is the one thing that answers', async () => {
    const res = await worker.fetch(new Request('https://justgoblin.app/'), emptyPlane());
    expect(res.status).toBe(302);
  });
});
