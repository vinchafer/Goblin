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

vi.mock('./cf-deploy', async () => ({
  // The jurisdiction helpers are taken from the REAL adapter rather than restated
  // here. They are pure env readers, and a hand-written stub of an env parser is
  // exactly the kind of second implementation that agrees with the test and not
  // with production — the quoted-paste behaviour below would pass against a naive
  // stub while failing on the wire.
  ...(await vi.importActual<typeof import('./cf-deploy')>('./cf-deploy')),
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
  // Unset by default: the default namespace is the baseline, and every existing
  // expectation in this file describes a binding with no jurisdiction on it.
  delete process.env.CF_R2_JURISDICTION;
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

/**
 * The 2026-08-10 provisioning failure: the founder read
 *
 *     binding APPS has no value — CF_KV_NAMESPACE_ID / CF_R2_BUCKET missing
 *
 * and went to re-check a KV namespace id that had been correct all along. The
 * report already KNEW which of the two was empty — `APPS` is the R2 binding — and
 * threw that knowledge away in the string. These tests pin the three states a
 * pasted Railway value can be in, and pin that the message never again names a
 * variable that is not the problem.
 */
describe('the binding set — present, absent, and pasted with quotes', () => {
  /** Every step after the upload succeeding, so the worker step is what is read. */
  function restGood() {
    findZoneId.mockResolvedValue(ok('zone-abc'));
    ensureWildcardDns.mockResolvedValue(ok({ created: false, recordId: 'r', proxied: true }));
    ensureWorkerRoute.mockResolvedValue(ok({ created: false, updated: false, routeId: 'r' }));
  }
  const workerStep = (r: Awaited<ReturnType<typeof mod.provisionRouter>>) =>
    r.steps.find((s) => s.step === 'worker')!;
  const bindingsSent = () =>
    (deployWorker.mock.calls[0] as [string, string, { bindings: Array<Record<string, string>> }])[2].bindings;

  describe('present', () => {
    it('assembles all four bindings and uploads', async () => {
      allGood();
      const r = await mod.provisionRouter();
      expect(workerStep(r).status).toBe('ok');
      expect(bindingsSent()).toEqual([
        { type: 'kv_namespace', name: 'ROUTES', namespace_id: 'kv-1' },
        { type: 'r2_bucket', name: 'APPS', bucket_name: 'goblin-apps' },
        { type: 'plain_text', name: 'APPS_DOMAIN', text: 'justgoblin.app' },
        { type: 'plain_text', name: 'SITE_URL', text: 'https://justgoblin.com' },
      ]);
    });
  });

  describe('absent — the message names the variable that is actually empty', () => {
    it('an unset CF_R2_BUCKET names CF_R2_BUCKET and does NOT name CF_KV_NAMESPACE_ID', async () => {
      delete process.env.CF_R2_BUCKET;
      restGood();

      const w = workerStep(await mod.provisionRouter());
      expect(w.status).toBe('skip');
      expect(w.detail).toContain('APPS');
      expect(w.detail).toContain('CF_R2_BUCKET');
      // The whole point of the fix: the variable that IS set is not accused.
      expect(w.detail).not.toContain('CF_KV_NAMESPACE_ID');
      expect(deployWorker).not.toHaveBeenCalled();
    });

    it('an unset CF_KV_NAMESPACE_ID names CF_KV_NAMESPACE_ID and does NOT name CF_R2_BUCKET', async () => {
      delete process.env.CF_KV_NAMESPACE_ID;
      restGood();

      const w = workerStep(await mod.provisionRouter());
      expect(w.detail).toContain('ROUTES');
      expect(w.detail).toContain('CF_KV_NAMESPACE_ID');
      expect(w.detail).not.toContain('CF_R2_BUCKET');
    });

    it('names BOTH when both are missing, so the second is not a surprise on the next run', async () => {
      delete process.env.CF_KV_NAMESPACE_ID;
      delete process.env.CF_R2_BUCKET;
      restGood();

      const w = workerStep(await mod.provisionRouter());
      expect(w.detail).toContain('CF_KV_NAMESPACE_ID');
      expect(w.detail).toContain('CF_R2_BUCKET');
    });

    it('a whitespace-only value is empty, not a value', async () => {
      process.env.CF_R2_BUCKET = '   ';
      restGood();

      const w = workerStep(await mod.provisionRouter());
      expect(w.status).toBe('skip');
      expect(w.detail).toContain('CF_R2_BUCKET');
      expect(deployWorker).not.toHaveBeenCalled();
    });

    it('carries a founderAction naming the variable — a skipped step used to carry none', async () => {
      delete process.env.CF_R2_BUCKET;
      restGood();

      const w = workerStep(await mod.provisionRouter());
      expect(w.founderAction).toBeTruthy();
      expect(w.founderAction).toContain('CF_R2_BUCKET');
      expect(w.founderAction).not.toContain('CF_KV_NAMESPACE_ID');
      // Where the value comes from, and how to settle "but I set it" against the
      // running process rather than against the dashboard.
      expect(w.founderAction).toContain('Railway');
      expect(w.founderAction).toContain('/api/ops/health');
    });
  });

  describe('quoted — a pasted value is read as the value it plainly is', () => {
    it('strips one pair of double quotes off both bindings', async () => {
      process.env.CF_KV_NAMESPACE_ID = '"kv-1"';
      process.env.CF_R2_BUCKET = '"goblin-apps"';
      allGood();

      const r = await mod.provisionRouter();
      expect(workerStep(r).status).toBe('ok');
      expect(bindingsSent()).toEqual(
        expect.arrayContaining([
          { type: 'kv_namespace', name: 'ROUTES', namespace_id: 'kv-1' },
          { type: 'r2_bucket', name: 'APPS', bucket_name: 'goblin-apps' },
        ]),
      );
    });

    it('strips single quotes and surrounding whitespace too', async () => {
      process.env.CF_R2_BUCKET = "  'goblin-apps'  ";
      allGood();

      await mod.provisionRouter();
      expect(bindingsSent()).toContainEqual({ type: 'r2_bucket', name: 'APPS', bucket_name: 'goblin-apps' });
    });

    it('a quote-only value is empty, and is reported as the variable it is', async () => {
      // `CF_R2_BUCKET=""` — the founder set the variable and set it to nothing.
      // Unwrapping makes this EMPTY, which is the honest reading: before, the two
      // quote characters counted as a value and were uploaded to Cloudflare as a
      // bucket name, failing later and further away with a stranger message.
      process.env.CF_R2_BUCKET = '""';
      restGood();

      const w = workerStep(await mod.provisionRouter());
      expect(w.status).toBe('skip');
      expect(w.detail).toContain('CF_R2_BUCKET');
      expect(deployWorker).not.toHaveBeenCalled();
    });

    it('leaves an unmatched quote alone rather than guessing — it stays visible', async () => {
      // One pair only. A stray single quote is a different mistake, and silently
      // repairing it would hide it. It is non-empty, so the upload is attempted
      // and Cloudflare gets to say what it thinks of the name.
      process.env.CF_R2_BUCKET = '"goblin-apps';
      allGood();

      await mod.provisionRouter();
      expect(bindingsSent()).toContainEqual({ type: 'r2_bucket', name: 'APPS', bucket_name: '"goblin-apps' });
    });
  });
});

/**
 * CF_R2_JURISDICTION — the field that makes an EU bucket bindable at all.
 *
 * The live failure this was written against: the bucket `goblin-apps` exists with
 * jurisdiction EU, the S3 round-trip against `<hash>.eu.r2.cloudflarestorage.com`
 * reads and writes it, and the Worker upload still answers
 * `10085 R2 bucket 'goblin-apps' not found` — because a jurisdiction bucket is in
 * a different namespace and the binding never said which one.
 */
describe('the R2 binding carries its jurisdiction', () => {
  const r2Binding = () =>
    (deployWorker.mock.calls[0] as [string, string, { bindings: Array<Record<string, unknown>> }])[2].bindings.find(
      (b) => b.type === 'r2_bucket',
    );
  const workerStep = (r: Awaited<ReturnType<typeof mod.provisionRouter>>) =>
    r.steps.find((s) => s.step === 'worker')!;
  /** Everything except the upload succeeding, so the worker step is the only variable. */
  function restGood() {
    findZoneId.mockResolvedValue(ok('zone-abc'));
    ensureWildcardDns.mockResolvedValue(ok({ created: false, recordId: 'r', proxied: true }));
    ensureWorkerRoute.mockResolvedValue(ok({ created: false, updated: false, routeId: 'r' }));
  }

  describe('set', () => {
    it('CF_R2_JURISDICTION=eu puts jurisdiction on the R2 binding — and ONLY on it', async () => {
      process.env.CF_R2_JURISDICTION = 'eu';
      allGood();

      await mod.provisionRouter();
      expect(r2Binding()).toEqual({
        type: 'r2_bucket',
        name: 'APPS',
        bucket_name: 'goblin-apps',
        jurisdiction: 'eu',
      });
      // KV has no jurisdiction concept — Cloudflare's binding schema defines none,
      // so inventing one here would be a field the API does not know.
      const kv = (deployWorker.mock.calls[0] as [string, string, { bindings: Array<Record<string, unknown>> }])[2].bindings.find(
        (b) => b.type === 'kv_namespace',
      );
      expect(kv).toEqual({ type: 'kv_namespace', name: 'ROUTES', namespace_id: 'kv-1' });
    });

    it('is read through the hardened unwrapper — a pasted "eu" with quotes still works', async () => {
      // The same paste that produced PR #77. Unhandled, this reaches Cloudflare as
      // `"eu"` and comes back as error 10021 "invalid jurisdiction".
      process.env.CF_R2_JURISDICTION = '"eu"';
      allGood();

      await mod.provisionRouter();
      expect(r2Binding()).toMatchObject({ jurisdiction: 'eu' });
    });

    it('is case-folded — the dashboard displays it as "EU"', async () => {
      process.env.CF_R2_JURISDICTION = '  EU  ';
      allGood();

      await mod.provisionRouter();
      expect(r2Binding()).toMatchObject({ jurisdiction: 'eu' });
    });

    it('names the jurisdiction in the success line, so evidence can answer where data lives', async () => {
      process.env.CF_R2_JURISDICTION = 'eu';
      allGood();

      const w = workerStep(await mod.provisionRouter());
      expect(w.status).toBe('ok');
      expect(w.detail).toContain('R2 jurisdiction: eu');
    });
  });

  describe('unset', () => {
    it('adds no jurisdiction key at all — the default namespace is not a value', async () => {
      allGood();

      await mod.provisionRouter();
      // toStrictEqual, not toEqual: `{..., jurisdiction: undefined}` passes toEqual
      // and is NOT what should go on the wire.
      expect(r2Binding()).toStrictEqual({ type: 'r2_bucket', name: 'APPS', bucket_name: 'goblin-apps' });
      expect(workerStep(await mod.provisionRouter()).detail).toContain('default namespace');
    });

    it('an empty or whitespace-only value is the same as unset', async () => {
      process.env.CF_R2_JURISDICTION = '   ';
      allGood();

      await mod.provisionRouter();
      expect(r2Binding()).toStrictEqual({ type: 'r2_bucket', name: 'APPS', bucket_name: 'goblin-apps' });
    });
  });

  describe('unrecognised — refused, never silently downgraded', () => {
    it('does not upload, and does not fall back to the default namespace', async () => {
      process.env.CF_R2_JURISDICTION = 'europe';
      restGood();

      const w = workerStep(await mod.provisionRouter());
      expect(w.status).toBe('skip');
      expect(deployWorker).not.toHaveBeenCalled();
      expect(w.detail).toContain('CF_R2_JURISDICTION');
    });

    it('the founder action names the variable, the value and the accepted set', async () => {
      process.env.CF_R2_JURISDICTION = 'europe';
      restGood();

      const w = workerStep(await mod.provisionRouter());
      expect(w.founderAction).toContain('CF_R2_JURISDICTION');
      expect(w.founderAction).toContain('europe');
      expect(w.founderAction).toContain('eu');
      // It must not accuse the bucket variable, which is fine.
      expect(w.founderAction).not.toContain('CF_R2_BUCKET');
    });

    it('is reported as a jurisdiction problem even when a binding is ALSO empty', async () => {
      // Two faults at once. The jurisdiction is the one that cannot be guessed at,
      // and sending the founder to CF_R2_BUCKET first would be the wrong variable.
      process.env.CF_R2_JURISDICTION = 'europe';
      delete process.env.CF_R2_BUCKET;
      restGood();

      const w = workerStep(await mod.provisionRouter());
      expect(w.status).toBe('skip');
      expect(w.detail).toContain('CF_R2_JURISDICTION');
      expect(deployWorker).not.toHaveBeenCalled();
    });

    it('the rest of the provision still runs — one bad variable is not four failed steps', async () => {
      process.env.CF_R2_JURISDICTION = 'europe';
      restGood();

      const r = await mod.provisionRouter();
      expect(r.provisioned).toBe(false);
      expect(r.steps.map((s) => `${s.step}:${s.status}`)).toEqual([
        'worker:skip',
        'zone:ok',
        'dns:ok',
        'route:ok',
      ]);
    });
  });

  describe('10085 stops blaming the token', () => {
    const upload10085 = () => {
      deployWorker.mockResolvedValue(err('upstream', "workers:upload: 10085 R2 bucket 'goblin-apps' not found."));
      restGood();
    };

    it('names the jurisdiction cause instead of permissions that are already granted', async () => {
      upload10085();

      const w = workerStep(await mod.provisionRouter());
      expect(w.status).toBe('fail');
      expect(w.founderAction).toContain('CF_R2_JURISDICTION');
      expect(w.founderAction).toMatch(/jurisdiction/i);
      // The regression itself: this used to be the token-permissions block, telling
      // the founder to add three scopes the token demonstrably already had.
      expect(w.founderAction).not.toContain('Workers R2 Storage → Edit');
      expect(w.founderAction).not.toContain('My Profile → API Tokens');
    });

    it('an auth failure still points at the token — 10085 is the exception, not the rule', async () => {
      deployWorker.mockResolvedValue(err('auth', 'Actor is not authorized'));
      restGood();

      const w = workerStep(await mod.provisionRouter());
      expect(w.founderAction).toContain('API Tokens');
    });

    it('an unrelated upload failure is unchanged', async () => {
      deployWorker.mockResolvedValue(err('upstream', 'workers:upload: 10021 something else entirely'));
      restGood();

      const w = workerStep(await mod.provisionRouter());
      expect(w.founderAction).toContain('API Tokens');
    });
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
