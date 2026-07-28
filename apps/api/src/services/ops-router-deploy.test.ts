/**
 * AKT 2 · PHASE 2 · U2.2 — provisioning the router's hostname.
 *
 * The adapter is mocked here; what is under test is the DECISION LOGIC and,
 * above all, the honesty of the report: which combinations count as provisioned,
 * which count as BLOCKED-ON-DNS, and whether the founder is handed the exact
 * dashboard steps for the specific thing that failed rather than a generic
 * "check Cloudflare".
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const deployWorker = vi.fn();
const findZoneId = vi.fn();
const ensureWildcardDns = vi.fn();
const ensureWorkerRoute = vi.fn();
const getWorker = vi.fn();
const listDnsRecords = vi.fn();
const listWorkerRoutes = vi.fn();

vi.mock('./cf-deploy', () => ({
  deployWorker: (...a: unknown[]) => deployWorker(...a),
  findZoneId: (...a: unknown[]) => findZoneId(...a),
  ensureWildcardDns: (...a: unknown[]) => ensureWildcardDns(...a),
  ensureWorkerRoute: (...a: unknown[]) => ensureWorkerRoute(...a),
  getWorker: (...a: unknown[]) => getWorker(...a),
  listDnsRecords: (...a: unknown[]) => listDnsRecords(...a),
  listWorkerRoutes: (...a: unknown[]) => listWorkerRoutes(...a),
  opsAppsDomain: () => (process.env.OPS_APPS_DOMAIN ?? '').trim(),
  opsSiteUrl: () => 'https://justgoblin.com',
}));

const mod = await import('./ops-router-deploy');

const ok = <T>(value: T) => ({ ok: true as const, value });
const err = (code: string, message = 'nope') => ({ ok: false as const, error: { code, message } });

beforeEach(() => {
  process.env.OPS_APPS_DOMAIN = 'justgoblin.app';
  process.env.CF_KV_NAMESPACE_ID = 'kv-1';
  process.env.CF_R2_BUCKET = 'goblin-apps';
  for (const m of [deployWorker, findZoneId, ensureWildcardDns, ensureWorkerRoute, getWorker, listDnsRecords, listWorkerRoutes]) {
    m.mockReset();
  }
});

/** Every step succeeding — the happy path all four checks pass. */
function allGood() {
  deployWorker.mockResolvedValue(ok({ scriptName: 'goblin-apps-router', bytes: 1234 }));
  findZoneId.mockResolvedValue(ok('zone-abc'));
  ensureWildcardDns.mockResolvedValue(ok({ created: true, recordId: 'rec-1', proxied: true }));
  ensureWorkerRoute.mockResolvedValue(ok({ created: true, updated: false, routeId: 'route-1' }));
}

describe('routerRoutePattern', () => {
  it('covers every hostname and every path under the apps domain', () => {
    expect(mod.routerRoutePattern('justgoblin.app')).toBe('*.justgoblin.app/*');
  });
});

describe('provisionRouter — the happy path', () => {
  it('reports provisioned only when all four steps are ok', async () => {
    allGood();
    const r = await mod.provisionRouter();
    expect(r.provisioned).toBe(true);
    expect(r.blockedOnDns).toBe(false);
    expect(r.steps.map((s) => `${s.step}:${s.status}`)).toEqual(['worker:ok', 'zone:ok', 'dns:ok', 'route:ok']);
  });

  it('uploads the router WITH its KV and R2 bindings', async () => {
    allGood();
    await mod.provisionRouter();
    const [scriptName, code, opts] = deployWorker.mock.calls[0] as [string, string, { bindings: Array<Record<string, string>> }];
    expect(scriptName).toBe('goblin-apps-router');
    expect(code).toContain('export default'); // the real worker source
    expect(opts.bindings).toEqual([
      { type: 'kv_namespace', name: 'ROUTES', namespace_id: 'kv-1' },
      { type: 'r2_bucket', name: 'APPS', bucket_name: 'goblin-apps' },
      { type: 'plain_text', name: 'APPS_DOMAIN', text: 'justgoblin.app' },
      { type: 'plain_text', name: 'SITE_URL', text: 'https://justgoblin.com' },
    ]);
  });

  it('is idempotent — a second run over existing infrastructure still reports provisioned', async () => {
    deployWorker.mockResolvedValue(ok({ scriptName: 'goblin-apps-router', bytes: 1234 }));
    findZoneId.mockResolvedValue(ok('zone-abc'));
    ensureWildcardDns.mockResolvedValue(ok({ created: false, recordId: 'rec-1', proxied: true }));
    ensureWorkerRoute.mockResolvedValue(ok({ created: false, updated: false, routeId: 'route-1' }));
    const r = await mod.provisionRouter();
    expect(r.provisioned).toBe(true);
    expect(r.steps.find((s) => s.step === 'dns')?.detail).toContain('already present');
  });
});

describe('provisionRouter — refusals carry the exact founder action', () => {
  it('a missing token scope points at the token editor with the permission list', async () => {
    deployWorker.mockResolvedValue(err('auth', 'Actor is not authorized'));
    findZoneId.mockResolvedValue(ok('zone-abc'));
    ensureWildcardDns.mockResolvedValue(ok({ created: false, recordId: 'r', proxied: true }));
    ensureWorkerRoute.mockResolvedValue(ok({ created: false, updated: false, routeId: 'r' }));

    const r = await mod.provisionRouter();
    expect(r.provisioned).toBe(false);
    const worker = r.steps.find((s) => s.step === 'worker')!;
    expect(worker.status).toBe('fail');
    expect(worker.founderAction).toContain('API Tokens');
    expect(worker.founderAction).toContain('Workers Routes → Edit');
  });

  it('an absent zone says so and stops, instead of failing four times', async () => {
    deployWorker.mockResolvedValue(ok({ scriptName: 'goblin-apps-router', bytes: 1 }));
    findZoneId.mockResolvedValue(ok(null));
    const r = await mod.provisionRouter();
    expect(r.blockedOnDns).toBe(true);
    expect(r.steps.find((s) => s.step === 'zone')?.founderAction).toContain('Add a site');
    expect(r.steps.find((s) => s.step === 'dns')?.status).toBe('skip');
    expect(ensureWildcardDns).not.toHaveBeenCalled();
  });

  it('an UNPROXIED wildcard is a failure, not a success', async () => {
    deployWorker.mockResolvedValue(ok({ scriptName: 'goblin-apps-router', bytes: 1 }));
    findZoneId.mockResolvedValue(ok('zone-abc'));
    ensureWildcardDns.mockResolvedValue(ok({ created: false, recordId: 'rec-1', proxied: false }));
    ensureWorkerRoute.mockResolvedValue(ok({ created: false, updated: false, routeId: 'route-1' }));

    const r = await mod.provisionRouter();
    expect(r.provisioned).toBe(false);
    expect(r.blockedOnDns).toBe(true);
    const dns = r.steps.find((s) => s.step === 'dns')!;
    expect(dns.status).toBe('fail');
    expect(dns.detail).toContain('NOT proxied');
    expect(dns.founderAction).toContain('orange cloud');
  });

  it('a DNS failure marks BLOCKED-ON-DNS but still attempts the route', async () => {
    deployWorker.mockResolvedValue(ok({ scriptName: 'goblin-apps-router', bytes: 1 }));
    findZoneId.mockResolvedValue(ok('zone-abc'));
    ensureWildcardDns.mockResolvedValue(err('auth'));
    ensureWorkerRoute.mockResolvedValue(ok({ created: true, updated: false, routeId: 'route-1' }));

    const r = await mod.provisionRouter();
    expect(r.blockedOnDns).toBe(true);
    expect(ensureWorkerRoute).toHaveBeenCalled(); // buildable steps carry on
    expect(r.steps.find((s) => s.step === 'route')?.status).toBe('ok');
  });

  it('a route failure hands over the click-by-click dashboard route form', async () => {
    deployWorker.mockResolvedValue(ok({ scriptName: 'goblin-apps-router', bytes: 1 }));
    findZoneId.mockResolvedValue(ok('zone-abc'));
    ensureWildcardDns.mockResolvedValue(ok({ created: false, recordId: 'r', proxied: true }));
    ensureWorkerRoute.mockResolvedValue(err('upstream', 'route conflict'));

    const r = await mod.provisionRouter();
    expect(r.blockedOnDns).toBe(true);
    expect(r.steps.find((s) => s.step === 'route')?.founderAction).toContain('*.justgoblin.app/*');
  });

  it('skips cleanly when OPS_APPS_DOMAIN is unset — no half-provision', async () => {
    process.env.OPS_APPS_DOMAIN = '';
    const r = await mod.provisionRouter();
    expect(r.provisioned).toBe(false);
    expect(deployWorker).not.toHaveBeenCalled();
    expect(findZoneId).not.toHaveBeenCalled();
  });

  it('skips the upload when a binding has no value, rather than deploying a broken router', async () => {
    // A router uploaded without its KV binding answers 503 for every app. Not
    // deploying is strictly better than deploying something that cannot work.
    delete process.env.CF_KV_NAMESPACE_ID;
    findZoneId.mockResolvedValue(ok('zone-abc'));
    ensureWildcardDns.mockResolvedValue(ok({ created: false, recordId: 'r', proxied: true }));
    ensureWorkerRoute.mockResolvedValue(ok({ created: false, updated: false, routeId: 'r' }));

    const r = await mod.provisionRouter();
    expect(deployWorker).not.toHaveBeenCalled();
    expect(r.steps.find((s) => s.step === 'worker')?.status).toBe('skip');
    expect(r.provisioned).toBe(false);
  });

  it('never throws, whatever the adapter returns', async () => {
    deployWorker.mockResolvedValue(err('timeout'));
    findZoneId.mockResolvedValue(err('rate_limited'));
    await expect(mod.provisionRouter()).resolves.toBeTruthy();
  });
});

describe('routerStatus — read-only, and tri-state on purpose', () => {
  it('reports what is in place without writing anything', async () => {
    getWorker.mockResolvedValue(ok({ scriptName: 'goblin-apps-router', size: 100 }));
    findZoneId.mockResolvedValue(ok('zone-abc'));
    listDnsRecords.mockResolvedValue(ok([{ id: 'r1', name: '*.justgoblin.app', type: 'A', proxied: true }]));
    listWorkerRoutes.mockResolvedValue(ok([{ id: 'rt1', pattern: '*.justgoblin.app/*', script: 'goblin-apps-router' }]));

    const s = await mod.routerStatus();
    expect(s).toMatchObject({ workerDeployed: true, zoneFound: true, wildcardProxied: true, routeBound: true });
    expect(s.notes).toEqual([]);
    expect(deployWorker).not.toHaveBeenCalled();
    expect(ensureWildcardDns).not.toHaveBeenCalled();
    expect(ensureWorkerRoute).not.toHaveBeenCalled();
  });

  it('distinguishes "could not tell" (null) from "not there" (false)', async () => {
    // The whole point: a failed CHECK and a confirmed ABSENCE are different facts
    // and must never be reported as the same one.
    getWorker.mockResolvedValue({ ok: false, error: { code: 'auth', message: 'no scope' } });
    findZoneId.mockResolvedValue(ok('zone-abc'));
    listDnsRecords.mockResolvedValue(ok([])); // definitely absent
    listWorkerRoutes.mockResolvedValue({ ok: false, error: { code: 'auth', message: 'no scope' } });

    const s = await mod.routerStatus();
    expect(s.workerDeployed).toBeNull(); // could not tell
    expect(s.wildcardProxied).toBe(false); // confirmed absent
    expect(s.routeBound).toBeNull(); // could not tell
    expect(s.notes.join(' ')).toContain('worker check failed');
  });

  it('names a route that points at the wrong script', async () => {
    getWorker.mockResolvedValue(ok(null));
    findZoneId.mockResolvedValue(ok('zone-abc'));
    listDnsRecords.mockResolvedValue(ok([{ id: 'r1', name: '*.justgoblin.app', type: 'A', proxied: true }]));
    listWorkerRoutes.mockResolvedValue(ok([{ id: 'rt1', pattern: '*.justgoblin.app/*', script: 'fremder-worker' }]));

    const s = await mod.routerStatus();
    expect(s.routeBound).toBe(false);
    expect(s.notes.join(' ')).toContain('fremder-worker');
  });

  it('flags an unproxied wildcard in the notes', async () => {
    getWorker.mockResolvedValue(ok(null));
    findZoneId.mockResolvedValue(ok('zone-abc'));
    listDnsRecords.mockResolvedValue(ok([{ id: 'r1', name: '*.justgoblin.app', type: 'A', proxied: false }]));
    listWorkerRoutes.mockResolvedValue(ok([]));

    const s = await mod.routerStatus();
    expect(s.wildcardProxied).toBe(false);
    expect(s.notes.join(' ')).toContain('not proxied');
  });
});
