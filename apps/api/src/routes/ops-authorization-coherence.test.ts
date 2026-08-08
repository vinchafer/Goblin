/**
 * AKT 2 · PHASE 2.5 · U-A1 — AUTHORIZATION COHERENCE.
 *
 * The bug this file is the evidence against: the founder console
 * (/dashboard/konsole) is gated on `OPS_FOUNDER_ACCOUNTS`, while the endpoints its
 * buttons drive sat behind `OPS_BETA_ACCOUNTS`. A founder who was not also on the
 * beta list therefore got a console that rendered, showed status, and answered 404
 * to every action — "Router ausrollen" included. Two allowlists disagreeing about
 * the same human.
 *
 * The principle under test, founder-approved: WHOEVER MAY OPERATE THE CONSOLE MAY
 * EXECUTE ITS ACTIONS. So the checklist below is not "some endpoints" — it is EVERY
 * endpoint the console calls, on both mounts, driven by three cohorts:
 *
 *   founder-only  vinc.hafner2@ — on OPS_FOUNDER_ACCOUNTS, NOT on OPS_BETA_ACCOUNTS
 *   beta-only     vinc.hafner3@ — on OPS_BETA_ACCOUNTS, NOT on OPS_FOUNDER_ACCOUNTS
 *   normal user   real.user@    — on neither, a live Act-1 account
 *
 * …and by the kill switch, which is NOT relaxed for the founder: the hosting plane
 * still goes dark for everyone when `OPS_HOSTING_ENABLED` is off.
 *
 * "Reached" is measured, not assumed: a refusal is the byte-identical plain-text
 * `404 Not Found`, and anything else — including a JSON 404 from a handler that ran
 * — means the gate admitted the caller. That is the same discriminator the console
 * uses to tell "refused" from "the API answered" (console-client.tsx).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── the world outside this process, stubbed ─────────────────────────────────

const getUser = vi.fn();
const from = vi.fn();
vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({ auth: { getUser: (...a: unknown[]) => getUser(...a) }, from: (...a: unknown[]) => from(...a) }),
}));

const provisionRouter = vi.fn();
const routerStatus = vi.fn();
vi.mock('../services/ops-router-deploy', () => ({
  provisionRouter: () => provisionRouter(),
  routerStatus: () => routerStatus(),
}));

const checkNameAvailable = vi.fn();
const publishHostedApp = vi.fn();
const renameHostedApp = vi.fn();
vi.mock('../services/ops-publish', () => ({
  checkNameAvailable: (...a: unknown[]) => checkNameAvailable(...a),
  publishHostedApp: (...a: unknown[]) => publishHostedApp(...a),
  renameHostedApp: (...a: unknown[]) => renameHostedApp(...a),
}));

const listUserOpsApps = vi.fn();
const listAllOpsApps = vi.fn();
const findOpsAppById = vi.fn();
const opsAppsTableAvailable = vi.fn();
vi.mock('../services/ops-apps-store', () => ({
  listUserOpsApps: (...a: unknown[]) => listUserOpsApps(...a),
  listAllOpsApps: () => listAllOpsApps(),
  findOpsAppById: (...a: unknown[]) => findOpsAppById(...a),
  opsAppsTableAvailable: () => opsAppsTableAvailable(),
}));

const opsAuditTableAvailable = vi.fn();
vi.mock('../services/ops-audit', () => ({ opsAuditTableAvailable: () => opsAuditTableAvailable() }));

const runOpsE2E = vi.fn();
vi.mock('../services/ops-e2e', () => ({ E2E_CONFIRM: 'RUN-E2E', runOpsE2E: (...a: unknown[]) => runOpsE2E(...a) }));

/** Nothing here may touch Cloudflare. A leak fails loudly rather than passing quietly. */
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
const { opsConsole } = await import('./ops-console');
const { __clearE2EJobsForTest } = await import('../services/ops-e2e-jobs');

/** The operator account (PR #79). On the founder list, deliberately not on beta. */
const FOUNDER = 'vinc.hafner2@gmail.com';
/** CC's test account. On the beta list, deliberately not a founder. */
const BETA = 'vinc.hafner3@gmail.com';
/** A live Act-1 user. On neither list, and must stay unable to tell either exists. */
const NORMAL = 'real.user@example.com';

// ── the checklist: every endpoint the console drives ────────────────────────

type Mount = 'ops' | 'console';
interface Action {
  /** What the founder is doing when this fires, in the console's own words. */
  label: string;
  mount: Mount;
  method: string;
  path: string;
  body?: unknown;
}

/**
 * Read straight off console-client.tsx. A console action missing from this list is
 * an action nobody proved anything about.
 */
const CONSOLE_ACTIONS: Action[] = [
  { label: 'Router ausrollen', mount: 'ops', method: 'POST', path: '/router/provision' },
  { label: 'Router-Status', mount: 'ops', method: 'GET', path: '/router' },
  { label: 'Namensprüfung', mount: 'ops', method: 'GET', path: '/apps/name-check?name=meinladen' },
  { label: 'Veröffentlichen', mount: 'ops', method: 'POST', path: '/apps/publish', body: { projectId: 'proj-1', name: 'meinladen' } },
  { label: 'Eigene Apps', mount: 'ops', method: 'GET', path: '/apps' },
  { label: 'Status-Kopf', mount: 'console', method: 'GET', path: '/status' },
  { label: 'App-Liste (Betreiber)', mount: 'console', method: 'GET', path: '/apps' },
  { label: 'Projektliste', mount: 'console', method: 'GET', path: '/projects' },
  { label: 'E2E starten', mount: 'console', method: 'POST', path: '/e2e/start?confirm=RUN-E2E' },
  { label: 'E2E-Fortschritt', mount: 'console', method: 'GET', path: '/e2e/status/kein-solcher-lauf' },
];

function call(action: Action, headers: Record<string, string> = {}) {
  const app = action.mount === 'ops' ? ops : opsConsole;
  return app.request(action.path, {
    method: action.method,
    headers: { ...(action.body ? { 'content-type': 'application/json' } : {}), ...headers },
    ...(action.body ? { body: JSON.stringify(action.body) } : {}),
  });
}

function as(email: string) {
  getUser.mockResolvedValue({ data: { user: { id: `u-${email.split('@')[0]}`, email } }, error: null });
  return { Authorization: `Bearer token-for-${email}` };
}

/**
 * A refusal is the gate's byte-identical plain-text 404 and nothing else. A JSON
 * 404 (an unknown job, an app that is not there) came from a handler that RAN, so
 * it proves the opposite of a refusal.
 */
async function refused(res: Response): Promise<boolean> {
  if (res.status !== 404) return false;
  const type = res.headers.get('content-type') ?? '';
  return type.includes('text/plain') && (await res.text()) === '404 Not Found';
}

beforeEach(() => {
  vi.clearAllMocks();
  __clearE2EJobsForTest();
  process.env.OPS_HOSTING_ENABLED = 'true';
  process.env.OPS_BETA_ACCOUNTS = BETA;
  process.env.OPS_FOUNDER_ACCOUNTS = FOUNDER;
  process.env.OPS_APPS_DOMAIN = 'justgoblin.app';

  provisionRouter.mockResolvedValue({ provisioned: true, blockedOnDns: false, steps: [] });
  routerStatus.mockResolvedValue({ domain: 'justgoblin.app', pattern: '*.justgoblin.app/*', workerDeployed: true, zoneFound: true, wildcardProxied: true, routeBound: true, notes: [] });
  checkNameAvailable.mockResolvedValue({ ok: true, normalized: 'meinladen', url: 'https://meinladen.justgoblin.app' });
  publishHostedApp.mockResolvedValue({ ok: true, url: 'https://meinladen.justgoblin.app', files: 3 });
  listUserOpsApps.mockResolvedValue([]);
  listAllOpsApps.mockResolvedValue({ available: true, apps: [] });
  opsAppsTableAvailable.mockResolvedValue(true);
  opsAuditTableAvailable.mockResolvedValue(true);
  runOpsE2E.mockResolvedValue({ passed: true, steps: [], numbers: {}, notes: [], tookMs: 1 });

  // One chain that serves both readers: ownership (`.single()`) and the project
  // picker (`.limit()`).
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.order = () => chain;
  chain.single = async () => ({ data: { id: 'proj-1' } });
  chain.limit = async () => ({ data: [], error: null });
  from.mockReturnValue(chain);
});

afterEach(() => {
  __clearE2EJobsForTest();
  delete process.env.OPS_HOSTING_ENABLED;
  delete process.env.OPS_BETA_ACCOUNTS;
  delete process.env.OPS_FOUNDER_ACCOUNTS;
  delete process.env.OPS_APPS_DOMAIN;
});

// ── 1. The founder reaches what the console offers ──────────────────────────

describe('a founder-allowlisted account reaches every action the console drives', () => {
  for (const action of CONSOLE_ACTIONS) {
    it(`${action.label} — ${action.method} ${action.mount}${action.path}`, async () => {
      const res = await call(action, as(FOUNDER));
      expect(await refused(res), `${action.label} was refused`).toBe(false);
    });
  }

  it('is NOT on the beta allowlist — the coherence, not a second membership', () => {
    expect(process.env.OPS_BETA_ACCOUNTS).not.toContain(FOUNDER);
  });

  it('actually runs the router provisioning rather than merely not-404ing', async () => {
    const res = await ops.request('/router/provision', { method: 'POST', headers: as(FOUNDER) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ provisioned: true });
    expect(provisionRouter).toHaveBeenCalledTimes(1);
  });

  it('publishes as the founder, with ownership still re-checked by the handler', async () => {
    const res = await ops.request('/apps/publish', {
      method: 'POST',
      headers: { ...as(FOUNDER), 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: 'proj-1', name: 'meinladen' }),
    });
    expect(res.status).toBe(200);
    expect(publishHostedApp).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-vinc.hafner2', projectId: 'proj-1' }));
  });
});

// ── 2. Every operator action is still attributable ──────────────────────────

describe('an action taken by founder authority carries the founder`s verified email', () => {
  it('hands the E2E runner the session email as its actor — the audit actor', async () => {
    // The E2E run suspends and tears down real apps, and every one of those writes
    // an ops_app_audit row whose `actor` is this string (services/ops-operator.ts).
    // It comes from the verified session and no request body can override it.
    await ops.request('/e2e?confirm=RUN-E2E', { method: 'POST', headers: as(FOUNDER) });
    expect(runOpsE2E).toHaveBeenCalledWith(expect.objectContaining({ actor: FOUNDER, userId: 'u-vinc.hafner2' }));
  });

  it('does the same on the console`s job wrapper', async () => {
    const res = await opsConsole.request('/e2e/start?confirm=RUN-E2E', { method: 'POST', headers: as(FOUNDER) });
    expect(res.status).toBe(202);
    await vi.waitFor(() => expect(runOpsE2E).toHaveBeenCalledWith(expect.objectContaining({ actor: FOUNDER })));
  });

  it('refuses the E2E run without its confirm token, founder or not', async () => {
    const res = await ops.request('/e2e', { method: 'POST', headers: as(FOUNDER) });
    expect(res.status).toBe(400);
    expect(runOpsE2E).not.toHaveBeenCalled();
  });
});

// ── 3. The beta path is untouched ───────────────────────────────────────────

describe('the beta account still reaches the beta paths, exactly as before', () => {
  for (const action of CONSOLE_ACTIONS.filter((a) => a.mount === 'ops')) {
    it(`${action.method} /api/ops${action.path}`, async () => {
      const res = await call(action, as(BETA));
      expect(await refused(res), `${action.label} was refused for the beta account`).toBe(false);
    });
  }

  it('still cannot reach the founder console — the beta list is not operator authority', async () => {
    for (const action of CONSOLE_ACTIONS.filter((a) => a.mount === 'console')) {
      expect(await refused(await call(action, as(BETA))), action.label).toBe(true);
    }
  });
});

// ── 4. Cohort protection, unchanged ─────────────────────────────────────────

describe('a normal Act-1 user gets the byte-identical 404 on every one of them', () => {
  for (const action of CONSOLE_ACTIONS) {
    it(`${action.method} ${action.mount}${action.path}`, async () => {
      const res = await call(action, as(NORMAL));
      expect(res.status).toBe(404);
      expect(await res.text()).toBe('404 Not Found');
      expect(res.headers.get('content-type')).toContain('text/plain');
    });
  }

  it('never reaches a handler — no service was called at all', async () => {
    for (const action of CONSOLE_ACTIONS) await call(action, as(NORMAL));
    for (const spy of [provisionRouter, routerStatus, checkNameAvailable, publishHostedApp, listUserOpsApps, listAllOpsApps, runOpsE2E]) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('cannot tell a refusal from an unmounted path, or from any other refusal', async () => {
    const denied = await call(CONSOLE_ACTIONS[0]!, as(NORMAL));
    const anonymous = await call(CONSOLE_ACTIONS[0]!);
    const unmounted = await ops.request('/gibt-es-nicht');
    const bodies = [await denied.text(), await anonymous.text(), await unmounted.text()];
    expect(new Set(bodies).size).toBe(1);
    expect(new Set([denied.status, anonymous.status, unmounted.status]).size).toBe(1);
  });
});

// ── 5. What the second allowlist did NOT buy ────────────────────────────────

describe('the kill switch still ANDs — the founder gets no bypass around it', () => {
  it('404s every /api/ops action for the founder with OPS_HOSTING_ENABLED off', async () => {
    process.env.OPS_HOSTING_ENABLED = 'false';
    for (const action of CONSOLE_ACTIONS.filter((a) => a.mount === 'ops')) {
      expect(await refused(await call(action, as(FOUNDER))), action.label).toBe(true);
    }
  });

  it('still never asks Supabase who is calling when the switch is off', async () => {
    process.env.OPS_HOSTING_ENABLED = 'false';
    const headers = as(FOUNDER);
    getUser.mockClear();
    for (const action of CONSOLE_ACTIONS.filter((a) => a.mount === 'ops')) await call(action, headers);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('leaves the console itself reachable with the switch off — it has to be able to SAY "aus"', async () => {
    process.env.OPS_HOSTING_ENABLED = 'false';
    const res = await opsConsole.request('/status', { headers: as(FOUNDER) });
    expect(res.status).toBe(200);
    expect((await res.json()).hosting.enabled).toBe(false);
  });

  it('admits nobody through the founder path when OPS_FOUNDER_ACCOUNTS is unset', async () => {
    delete process.env.OPS_FOUNDER_ACCOUNTS;
    for (const action of CONSOLE_ACTIONS) {
      expect(await refused(await call(action, as(FOUNDER))), action.label).toBe(true);
    }
  });

  it('admits nobody through the founder path when the list is empty or blank', async () => {
    for (const value of ['', '   ', ',', ' , ']) {
      process.env.OPS_FOUNDER_ACCOUNTS = value;
      const res = await ops.request('/router/provision', { method: 'POST', headers: as(FOUNDER) });
      expect(await refused(res), `OPS_FOUNDER_ACCOUNTS=${JSON.stringify(value)} must admit nobody`).toBe(true);
    }
  });

  it('fails closed when the auth backend is down, on both mounts', async () => {
    getUser.mockRejectedValue(new Error('supabase down'));
    for (const action of CONSOLE_ACTIONS) {
      const res = await call(action, { Authorization: 'Bearer whatever' });
      expect(await refused(res), action.label).toBe(true);
    }
  });
});
