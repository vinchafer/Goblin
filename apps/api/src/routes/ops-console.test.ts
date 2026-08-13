// AKT 2 · PHASE 2.5 · U-C2/C3/C4 — the console's backing routes.
//
// Three properties are under test, in this order of importance:
//   1. INVISIBILITY — the whole mount 404s for anyone who is not the founder, and
//      for everyone when the allowlist is unset.
//   2. UNKNOWN SURVIVES THE WIRE — a probe that could not tell must arrive at the
//      client as null, never as false. This is where "never guessed into green"
//      is actually enforced; the UI can only be honest if the payload is.
//   3. THE JOB IS NOT A GUESS — start → status transitions → terminal state, with
//      no step appearing before the runner produced it.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const getUser = vi.fn();
const from = vi.fn();
vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({ auth: { getUser: (...a: unknown[]) => getUser(...a) }, from: (...a: unknown[]) => from(...a) }),
}));

const routerStatus = vi.fn();
vi.mock('../services/ops-router-deploy', () => ({ routerStatus: () => routerStatus() }));

const listAllOpsApps = vi.fn();
const opsAppsTableAvailable = vi.fn();
vi.mock('../services/ops-apps-store', () => ({
  listAllOpsApps: () => listAllOpsApps(),
  opsAppsTableAvailable: () => opsAppsTableAvailable(),
}));

const opsAuditTableAvailable = vi.fn();
const writeOpsAudit = vi.fn();
vi.mock('../services/ops-audit', () => ({
  opsAuditTableAvailable: () => opsAuditTableAvailable(),
  writeOpsAudit: (...a: unknown[]) => writeOpsAudit(...a),
}));

// PHASE 3 · U3.3 — the review queue's three collaborators. Mocked at the module
// boundary so this file keeps testing ROUTES rather than Cloudflare and Postgres.
const listPendingReviews = vi.fn();
const findReviewItem = vi.fn();
const decideReview = vi.fn();
vi.mock('../services/ops-review-queue', () => ({
  listPendingReviews: (...a: unknown[]) => listPendingReviews(...a),
  findReviewItem: (...a: unknown[]) => findReviewItem(...a),
  decideReview: (...a: unknown[]) => decideReview(...a),
}));

const loadCandidatePreview = vi.fn();
vi.mock('../services/ops-review-preview', () => ({
  loadCandidatePreview: (...a: unknown[]) => loadCandidatePreview(...a),
}));

const publishHostedApp = vi.fn();
vi.mock('../services/ops-publish', () => ({
  publishHostedApp: (...a: unknown[]) => publishHostedApp(...a),
}));

vi.mock('../services/cf-deploy', () => ({ opsAppsDomain: () => 'justgoblin.app' }));

const runOpsE2E = vi.fn();
vi.mock('../services/ops-e2e', () => ({
  E2E_CONFIRM: 'RUN-E2E',
  runOpsE2E: (...a: unknown[]) => runOpsE2E(...a),
}));

const { opsConsole, PROJECT_PICKER_COLUMNS, PROJECT_PICKER_ORDER } = await import('./ops-console');
const { __clearE2EJobsForTest } = await import('../services/ops-e2e-jobs');

const FOUNDER = 'vinc.hafner3@gmail.com';
const COHORT = 'real.user@example.com';

function founderHeaders() {
  getUser.mockResolvedValue({ data: { user: { id: 'u-founder', email: FOUNDER } }, error: null });
  return { Authorization: 'Bearer founder-token' };
}

function get(path: string, headers: Record<string, string> = founderHeaders()) {
  return opsConsole.request(path, { headers });
}

function post(path: string, headers: Record<string, string> = founderHeaders()) {
  return opsConsole.request(path, { method: 'POST', headers });
}

const HEALTHY_ROUTER = {
  scriptName: 'goblin-router',
  domain: 'justgoblin.app',
  pattern: '*.justgoblin.app/*',
  workerDeployed: true,
  zoneFound: true,
  wildcardProxied: true,
  routeBound: true,
  notes: [],
  timestamp: '2026-07-29T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  __clearE2EJobsForTest();
  process.env.OPS_FOUNDER_ACCOUNTS = FOUNDER;
  delete process.env.OPS_HOSTING_ENABLED;
  delete process.env.OPS_BETA_ACCOUNTS;
  routerStatus.mockResolvedValue(HEALTHY_ROUTER);
  opsAppsTableAvailable.mockResolvedValue(true);
  opsAuditTableAvailable.mockResolvedValue(true);
  listAllOpsApps.mockResolvedValue({ available: true, apps: [] });
  runOpsE2E.mockResolvedValue({ passed: true, steps: [], numbers: {} });
});

afterEach(() => {
  __clearE2EJobsForTest();
  delete process.env.OPS_FOUNDER_ACCOUNTS;
  delete process.env.OPS_HOSTING_ENABLED;
  delete process.env.OPS_BETA_ACCOUNTS;
});

describe('1 — the whole mount is invisible to everyone but the founder', () => {
  // PHASE 3 — the review routes join the same invisibility gate. Listed here
  // rather than in their own describe so a future route cannot be added to the
  // mount without also being added to the cohort-exclusion proof.
  const paths = ['/status', '/apps', '/projects', '/e2e/status/anything', '/reviews', '/reviews/r1/preview'];

  it('404s every route for an anonymous request', async () => {
    for (const p of paths) {
      const res = await opsConsole.request(p);
      expect(res.status, p).toBe(404);
      expect(await res.text()).toBe('404 Not Found');
    }
  });

  it('404s every route for a normal Act-1 cohort user', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u2', email: COHORT } }, error: null });
    for (const p of paths) {
      expect((await opsConsole.request(p, { headers: { Authorization: 'Bearer t' } })).status, p).toBe(404);
    }
  });

  it('404s every route when OPS_FOUNDER_ACCOUNTS is unset — the founder included', async () => {
    delete process.env.OPS_FOUNDER_ACCOUNTS;
    for (const p of paths) {
      expect((await get(p)).status, p).toBe(404);
    }
    expect((await post('/e2e/start?confirm=RUN-E2E')).status).toBe(404);
    expect(runOpsE2E).not.toHaveBeenCalled();
  });

  it('404s the start route for a cohort user even with the right confirm token', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u2', email: COHORT } }, error: null });
    const res = await opsConsole.request('/e2e/start?confirm=RUN-E2E', {
      method: 'POST',
      headers: { Authorization: 'Bearer t' },
    });
    expect(res.status).toBe(404);
    expect(runOpsE2E).not.toHaveBeenCalled();
  });
});

describe('2 — UNKNOWN survives the wire', () => {
  it('reports the router as null when the probe throws, never as false', async () => {
    routerStatus.mockRejectedValue(new Error('cloudflare unreachable'));
    const body = await (await get('/status')).json();
    expect(body.router).toBeNull();
    expect(body.router).not.toBe(false);
  });

  it('passes each tri-state router field through unflattened', async () => {
    routerStatus.mockResolvedValue({
      ...HEALTHY_ROUTER,
      workerDeployed: true,
      wildcardProxied: null, // could not tell
      routeBound: false, // definitely not bound
      notes: ['dns check failed: token lacks Zone:Read'],
    });
    const body = await (await get('/status')).json();
    expect(body.router.workerDeployed).toBe(true);
    expect(body.router.wildcardProxied).toBeNull();
    expect(body.router.routeBound).toBe(false);
    expect(body.router.notes).toEqual(['dns check failed: token lacks Zone:Read']);
  });

  it('surfaces the documented trap — wildcard present but NOT proxied — as its own flag', async () => {
    routerStatus.mockResolvedValue({
      ...HEALTHY_ROUTER,
      wildcardProxied: false,
      notes: ['*.justgoblin.app exists but is not proxied — the Worker will never run'],
    });
    const body = await (await get('/status')).json();
    expect(body.router.wildcardProxied).toBe(false);
    expect(body.router.notes[0]).toContain('not proxied');
  });

  it('reports each migration as null when its probe throws', async () => {
    opsAppsTableAvailable.mockRejectedValue(new Error('db down'));
    opsAuditTableAvailable.mockRejectedValue(new Error('db down'));
    const body = await (await get('/status')).json();
    expect(body.migrations).toEqual({ registry: null, audit: null });
  });

  it('reports a missing 0100 as false and a present 0099 as true, independently', async () => {
    opsAppsTableAvailable.mockResolvedValue(true);
    opsAuditTableAvailable.mockResolvedValue(false);
    const body = await (await get('/status')).json();
    expect(body.migrations).toEqual({ registry: true, audit: false });
  });

  it('degrades one line, not the whole header, when one probe fails', async () => {
    routerStatus.mockRejectedValue(new Error('boom'));
    const res = await get('/status');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.router).toBeNull();
    expect(body.migrations.registry).toBe(true); // the others still answered
    expect(body.timestamp).toBeTruthy();
  });

  it('distinguishes "registry unreadable" from "no apps" on the app list', async () => {
    listAllOpsApps.mockResolvedValue({ available: false, apps: [] });
    const body = await (await get('/apps')).json();
    expect(body.available).toBe(false);
    expect(body.apps).toEqual([]);

    listAllOpsApps.mockResolvedValue({ available: true, apps: [] });
    expect((await (await get('/apps')).json()).available).toBe(true);
  });

  it('always carries a timestamp, so "last refreshed" is never invented client-side', async () => {
    for (const p of ['/status', '/apps']) {
      const body = await (await get(p)).json();
      expect(Number.isFinite(Date.parse(body.timestamp)), p).toBe(true);
    }
  });
});

describe('2b — the status payload keeps secrets server-side', () => {
  it('reports the beta allowlist as a COUNT, never as addresses', async () => {
    process.env.OPS_BETA_ACCOUNTS = `${FOUNDER},someone.private@example.com`;
    const raw = await (await get('/status')).text();
    expect(JSON.parse(raw).hosting.betaAccountCount).toBe(2);
    expect(raw).not.toContain('someone.private@example.com');
  });

  it('echoes only the CALLER\'S own email, which they already know', async () => {
    process.env.OPS_FOUNDER_ACCOUNTS = `${FOUNDER},second.founder@example.com`;
    const raw = await (await get('/status')).text();
    expect(JSON.parse(raw).founder.email).toBe(FOUNDER);
    expect(raw).not.toContain('second.founder@example.com');
  });

  it('reports the hosting flag honestly in both directions', async () => {
    process.env.OPS_HOSTING_ENABLED = 'true';
    expect((await (await get('/status')).json()).hosting.enabled).toBe(true);
    process.env.OPS_HOSTING_ENABLED = 'false';
    expect((await (await get('/status')).json()).hosting.enabled).toBe(false);
  });

  it('still answers with hosting OFF — the console can report the dark state', async () => {
    delete process.env.OPS_HOSTING_ENABLED;
    const res = await get('/status');
    expect(res.status).toBe(200);
    expect((await res.json()).hosting.enabled).toBe(false);
  });
});

describe('3 — the E2E job: start, transitions, terminal state', () => {
  /** A runner we control: resolves only when we say so. */
  function deferredRun() {
    let settle!: (r: unknown) => void;
    let fail!: (e: Error) => void;
    const steps: Array<(s: unknown) => void> = [];
    runOpsE2E.mockImplementation((opts: { onStep?: (s: unknown) => void }) => {
      if (opts.onStep) steps.push(opts.onStep);
      return new Promise((res, rej) => {
        settle = res as (r: unknown) => void;
        fail = rej;
      });
    });
    return {
      emit: (s: unknown) => steps.forEach((fn) => fn(s)),
      finish: (r: unknown) => settle(r),
      throw: (e: Error) => fail(e),
    };
  }

  it('refuses to start without the confirm token, and starts nothing', async () => {
    const res = await post('/e2e/start');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('confirm_required');
    expect(runOpsE2E).not.toHaveBeenCalled();
  });

  it('refuses a wrong confirm token', async () => {
    expect((await post('/e2e/start?confirm=nope')).status).toBe(400);
    expect(runOpsE2E).not.toHaveBeenCalled();
  });

  it('answers 202 with a job id immediately, without waiting for the run', async () => {
    deferredRun(); // never settles
    const res = await post('/e2e/start?confirm=RUN-E2E');
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.jobId).toMatch(/^e2e-/);
    expect(body.status).toBe('running');
    expect(body.loops).toBe(5);
  });

  it('runs as the VERIFIED founder — the run\'s actor is not caller-supplied', async () => {
    deferredRun();
    await post('/e2e/start?confirm=RUN-E2E');
    expect(runOpsE2E).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-founder', actor: FOUNDER, loops: 5 }),
    );
  });

  it('shows ONLY the steps the runner has actually produced', async () => {
    const run = deferredRun();
    const { jobId } = await (await post('/e2e/start?confirm=RUN-E2E')).json();

    let body = await (await get(`/e2e/status/${jobId}`)).json();
    expect(body.status).toBe('running');
    expect(body.steps).toEqual([]);
    expect(body.stepsCompleted).toBe(0);
    expect(body.report).toBeNull();

    run.emit({ step: 'preflight:router', ok: true, detail: 'router deployed' });
    body = await (await get(`/e2e/status/${jobId}`)).json();
    expect(body.steps).toHaveLength(1);
    expect(body.stepsCompleted).toBe(1);
    expect(body.steps[0].step).toBe('preflight:router');
    expect(body.status).toBe('running'); // a step is not a terminal state
    expect(body.report).toBeNull(); // no numbers before the run returns

    run.emit({ step: 'scan:battery', ok: true, detail: '9/9', propagationSec: 12 });
    body = await (await get(`/e2e/status/${jobId}`)).json();
    expect(body.steps).toHaveLength(2);
    expect(body.steps[1].propagationSec).toBe(12);
  });

  it('reaches "done" only when the runner returns, and carries its numbers verbatim', async () => {
    const run = deferredRun();
    const { jobId } = await (await post('/e2e/start?confirm=RUN-E2E')).json();

    const report = {
      passed: true,
      runId: 'abc123',
      numbers: { publishLoops: '5/5', scanBattery: '9/9', suspensionRoundTrip: '3/3' },
      steps: [
        { step: 'preflight:router', ok: true, detail: 'ok' },
        { step: 'scan:battery', ok: true, detail: '9/9' },
      ],
      notes: [],
    };
    run.finish(report);
    await vi.waitFor(async () => {
      expect((await (await get(`/e2e/status/${jobId}`)).json()).status).toBe('done');
    });

    const body = await (await get(`/e2e/status/${jobId}`)).json();
    expect(body.report.numbers).toEqual({ publishLoops: '5/5', scanBattery: '9/9', suspensionRoundTrip: '3/3' });
    expect(body.steps).toHaveLength(2); // the runner's list is authoritative
    expect(body.finishedAt).toBeTruthy();
    expect(body.elapsedSec).toBeGreaterThanOrEqual(0);
  });

  it('records a FAILING run as done — the runner judges pass/fail, not the wrapper', async () => {
    const run = deferredRun();
    const { jobId } = await (await post('/e2e/start?confirm=RUN-E2E')).json();
    run.finish({ passed: false, numbers: { publishLoops: '2/5', scanBattery: '9/9', suspensionRoundTrip: '0/3' }, steps: [], notes: [] });

    await vi.waitFor(async () => {
      const b = await (await get(`/e2e/status/${jobId}`)).json();
      expect(b.status).toBe('done'); // NOT 'failed' — the run completed
      expect(b.report.passed).toBe(false);
    });
  });

  it('records a THROWN run as failed, with a sentence and no stack trace', async () => {
    const run = deferredRun();
    const { jobId } = await (await post('/e2e/start?confirm=RUN-E2E')).json();
    run.throw(new Error('Cloudflare API refused the token'));

    await vi.waitFor(async () => {
      const b = await (await get(`/e2e/status/${jobId}`)).json();
      expect(b.status).toBe('failed');
      expect(b.error).toBe('Cloudflare API refused the token');
      expect(b.error).not.toContain('at Object.');
      expect(b.report).toBeNull();
    });
  });

  it('refuses a SECOND concurrent run with 409 and names the one in flight', async () => {
    deferredRun();
    const first = await (await post('/e2e/start?confirm=RUN-E2E')).json();
    const res = await post('/e2e/start?confirm=RUN-E2E');
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('already_running');
    expect(body.jobId).toBe(first.jobId);
    expect(runOpsE2E).toHaveBeenCalledOnce();
  });

  it('allows a new run once the previous one has settled', async () => {
    const run = deferredRun();
    const first = await (await post('/e2e/start?confirm=RUN-E2E')).json();
    run.finish({ passed: true, numbers: {}, steps: [], notes: [] });
    await vi.waitFor(async () => {
      expect((await (await get(`/e2e/status/${first.jobId}`)).json()).status).toBe('done');
    });
    deferredRun();
    expect((await post('/e2e/start?confirm=RUN-E2E')).status).toBe(202);
  });

  it('reports an unknown job as unknown — not as failed, not as done', async () => {
    const res = await get('/e2e/status/e2e-never-existed');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('unknown_job');
    // The honest sentence has to say BOTH halves: the view is gone, the run's
    // writes may not be.
    expect(body.message).toContain('Arbeitsspeicher');
    expect(body.message).toContain('durchgelaufen sein');
    expect(body.status).toBeUndefined();
  });

  it('advertises the running job on /status so the console can disable the button', async () => {
    deferredRun();
    expect((await (await get('/status')).json()).e2e.running).toBeNull();
    const { jobId } = await (await post('/e2e/start?confirm=RUN-E2E')).json();
    expect((await (await get('/status')).json()).e2e.running).toBe(jobId);
  });

  it('clamps the loop count instead of trusting the query string', async () => {
    deferredRun();
    await post('/e2e/start?confirm=RUN-E2E&loops=999');
    expect(runOpsE2E).toHaveBeenCalledWith(expect.objectContaining({ loops: 10 }));
  });

  it('survives an observer that throws — a broken view cannot abort a production run', async () => {
    const run = deferredRun();
    const { jobId } = await (await post('/e2e/start?confirm=RUN-E2E')).json();
    run.emit({ step: 'ok', ok: true, detail: 'x' });
    run.finish({ passed: true, numbers: {}, steps: [{ step: 'ok', ok: true, detail: 'x' }], notes: [] });
    await vi.waitFor(async () => {
      expect((await (await get(`/e2e/status/${jobId}`)).json()).status).toBe('done');
    });
  });
});

describe('the public-URL probe measures instead of assuming, and cannot be aimed', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('reports the status the public URL actually answered', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 403 })) as unknown as typeof fetch;
    const body = await (await get('/probe?name=demo')).json();
    expect(body.status).toBe(403);
    expect(body.reachable).toBe(true);
    expect(body.url).toBe('https://demo.justgoblin.app');
  });

  it('reports unreachable as unreachable — not as a status code', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('ETIMEDOUT');
    }) as unknown as typeof fetch;
    const body = await (await get('/probe?name=demo')).json();
    expect(body.reachable).toBe(false);
    expect(body.status).toBeNull(); // NOT 0, NOT 404 — those would be guesses
    expect(body.detail).toContain('ETIMEDOUT');
  });

  it('takes a NAME, so there is no URL for a caller to aim it at', async () => {
    const spy = vi.fn(async () => new Response('', { status: 200 }));
    globalThis.fetch = spy as unknown as typeof fetch;
    const evil = [
      'http://169.254.169.254/latest/meta-data',
      '../../etc/passwd',
      'demo.justgoblin.app@evil.example',
      'demo/../../x',
      'demo:8080',
      'demo demo',
      '-leading',
      '',
      'a'.repeat(120),
    ];
    for (const name of evil) {
      const res = await get(`/probe?name=${encodeURIComponent(name)}`);
      expect(res.status, name).toBe(400);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('only ever builds a URL on the apps domain', async () => {
    const spy = vi.fn(async (_input: unknown, _init?: unknown) => new Response('', { status: 200 }));
    globalThis.fetch = spy as unknown as typeof fetch;
    await get('/probe?name=demo');
    expect(String(spy.mock.calls[0]![0])).toBe('https://demo.justgoblin.app');
  });

  it('404s the probe for a cohort user like every other console route', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u2', email: COHORT } }, error: null });
    const res = await opsConsole.request('/probe?name=demo', { headers: { Authorization: 'Bearer t' } });
    expect(res.status).toBe(404);
  });
});

describe('the project picker offers only what could actually be published', () => {
  /** What the route actually asked the database for, captured verbatim. */
  let asked: { columns: string; orderedBy: string } = { columns: '', orderedBy: '' };

  function mockProjects(result: { data?: unknown; error?: unknown }) {
    asked = { columns: '', orderedBy: '' };
    const chain = {
      select: (cols: string) => { asked.columns = cols; return chain; },
      eq: () => chain,
      order: (col: string) => { asked.orderedBy = col; return chain; },
      limit: () => Promise.resolve(result),
    };
    from.mockReturnValue(chain);
  }

  it('returns the founder\'s own projects', async () => {
    mockProjects({ data: [{ id: 'p1', name: 'Testprojekt', last_active: '2026-07-01' }], error: null });
    const body = await (await get('/projects')).json();
    expect(body.available).toBe(true);
    expect(body.projects).toEqual([{ id: 'p1', name: 'Testprojekt', updatedAt: '2026-07-01' }]);
  });

  it('reports a failed read as unavailable, not as "you have no projects"', async () => {
    mockProjects({ data: null, error: { message: 'connection reset' } });
    const body = await (await get('/projects')).json();
    expect(body.available).toBe(false);
    expect(body.projects).toEqual([]);
  });

  it('says WHAT went wrong when it could not read them', async () => {
    // The founder is the only reader of this surface and the only person who can
    // act on a schema error. A sentence with nothing behind it is what cost a
    // window: the console said "konnte nicht geladen werden" and the reason —
    // `42703 column projects.updated_at does not exist` — was visible nowhere.
    mockProjects({ data: null, error: { code: '42703', message: 'column projects.updated_at does not exist' } });
    const body = await (await get('/projects')).json();
    expect(body.available).toBe(false);
    expect(body.detail).toContain('42703');
    expect(body.detail).toContain('does not exist');
  });

  /**
   * ── THE REGRESSION THAT MADE THIS NECESSARY ────────────────────────────────
   * The route asked for `updated_at` and ordered by it. `projects` has no such
   * column — 0001 creates it with `created_at` and `last_active`, and nothing
   * since adds one. Every call answered 42703, the route reported `available:
   * false` exactly as designed, and the picker was permanently empty.
   *
   * The old mock could not catch it: `select()` and `order()` swallowed their
   * arguments, so any column name at all passed. So the columns are now a fact the
   * route exports, and this holds it against the COMMITTED MIGRATIONS rather than
   * against another hand-written list that could be wrong in the same direction.
   */
  describe('every column it asks for exists in the committed schema', () => {
    const MIGRATIONS = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url));

    /** The real `projects` columns: the CREATE TABLE plus every ADD COLUMN since. */
    const projectColumns = (() => {
      const cols = new Set<string>();
      for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
        const sql = readFileSync(join(MIGRATIONS, file), 'utf8');

        const created = /create table (?:if not exists )?(?:public\.)?projects\s*\(([\s\S]*?)\n\);/i.exec(sql);
        if (created) {
          for (const line of created[1]!.split('\n')) {
            const m = /^\s*([a-z_]+)\s+[a-z]/i.exec(line);
            if (m && !/^(primary|foreign|unique|check|constraint)$/i.test(m[1]!)) cols.add(m[1]!.toLowerCase());
          }
        }

        const altered = /alter table (?:public\.)?projects\b([\s\S]*?);/gi;
        for (let m = altered.exec(sql); m; m = altered.exec(sql)) {
          const adds = /add column (?:if not exists )?([a-z_]+)/gi;
          for (let a = adds.exec(m[1]!); a; a = adds.exec(m[1]!)) cols.add(a[1]!.toLowerCase());
        }
      }
      return cols;
    })();

    it('found a plausible schema to check against', () => {
      // Guards the guard: a regex that stopped matching would otherwise turn this
      // whole block into a test that always passes.
      expect(projectColumns.has('id')).toBe(true);
      expect(projectColumns.has('user_id')).toBe(true);
      expect(projectColumns.has('name')).toBe(true);
      expect(projectColumns.size).toBeGreaterThan(8);
    });

    it('has no updated_at — the column the picker used to ask for', () => {
      expect(projectColumns.has('updated_at')).toBe(false);
    });

    for (const col of PROJECT_PICKER_COLUMNS) {
      it(`selects "${col}", which the schema has`, () => {
        expect(projectColumns.has(col)).toBe(true);
      });
    }

    it(`orders by "${PROJECT_PICKER_ORDER}", which the schema has`, () => {
      expect(projectColumns.has(PROJECT_PICKER_ORDER)).toBe(true);
    });

    it('sends exactly those columns and that ordering to the database', async () => {
      mockProjects({ data: [], error: null });
      await get('/projects');
      expect(asked.columns.split(',').map((s) => s.trim())).toEqual([...PROJECT_PICKER_COLUMNS]);
      expect(asked.orderedBy).toBe(PROJECT_PICKER_ORDER);
    });
  });
});

// ── 4 — the review queue (PHASE 3 · U3.3) ───────────────────────────────────

const REVIEW_ITEM = {
  id: 'rv-1',
  userId: 'u-builder',
  projectId: 'p-1',
  requestedName: 'meinladen',
  status: 'pending' as const,
  stage1Verdict: 'pass',
  stage1RuleIds: [],
  stage2Verdict: 'review',
  stage2Reason: 'flagged' as const,
  categories: ['deception' as const],
  stage2Confidence: 'medium',
  scannedFiles: 2,
  scannedBytes: 900,
  tokensInput: 700,
  tokensOutput: 18,
  decidedBy: null,
  decidedAt: null,
  decisionReason: null,
  createdAt: '2026-08-13T00:00:00.000Z',
};

function postJson(path: string, body: unknown, headers: Record<string, string> = founderHeaders()) {
  return opsConsole.request(path, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('4 — the review queue', () => {
  beforeEach(() => {
    process.env.OPS_FOUNDER_ACCOUNTS = FOUNDER;
    listPendingReviews.mockResolvedValue({ available: true, items: [REVIEW_ITEM] });
    findReviewItem.mockResolvedValue(REVIEW_ITEM);
    decideReview.mockResolvedValue({ ...REVIEW_ITEM, status: 'approved' });
    writeOpsAudit.mockResolvedValue('written');
    publishHostedApp.mockResolvedValue({ ok: true, stage: 'live', appId: 'a1', name: 'meinladen', url: 'https://meinladen.justgoblin.app', files: 2, bytes: 900, republished: false, verification: { ok: true }, scan: { verdict: 'pass', scannedFiles: 2, hits: 0, classifier: 'not_run' } });
  });

  it('lists what is waiting, with BOTH stage verdicts', async () => {
    const body = await (await get('/reviews')).json();
    expect(body.available).toBe(true);
    expect(body.items[0]).toMatchObject({
      id: 'rv-1', requestedName: 'meinladen',
      stage1: { verdict: 'pass' }, stage2: { verdict: 'review', reason: 'flagged' },
      categories: ['deception'],
    });
  });

  it('reports an unreadable queue as UNAVAILABLE, never as "nothing waiting"', async () => {
    listPendingReviews.mockResolvedValue({ available: false, items: [] });
    const body = await (await get('/reviews')).json();
    expect(body.available).toBe(false);
    expect(body.items).toEqual([]);
  });

  it('serves the preview as inert TEXT and says so', async () => {
    loadCandidatePreview.mockResolvedValue({
      files: [{ path: 'index.html', text: '<script>alert(1)</script>', bytes: 25, truncated: false }],
      binaryFiles: [], omittedFiles: [], totalFiles: 1, available: true,
    });
    const body = await (await get('/reviews/rv-1/preview')).json();
    // The markup arrives as a STRING in a JSON field. Nothing in the payload is
    // html/* content-typed, and nothing asks a browser to parse it.
    expect(body.files[0].text).toBe('<script>alert(1)</script>');
    expect(body.note).toContain('nirgends ausgeführt');
  });

  it('says "could not read" rather than "empty" when the project is gone', async () => {
    loadCandidatePreview.mockResolvedValue({ files: [], binaryFiles: [], omittedFiles: [], totalFiles: 0, available: false });
    const body = await (await get('/reviews/rv-1/preview')).json();
    expect(body.note).toContain('NICHT');
  });

  it('404s a preview for an item that is not in the queue', async () => {
    findReviewItem.mockResolvedValue(null);
    expect((await get('/reviews/nope/preview')).status).toBe(404);
  });

  // ── approve ──
  it('approve settles the row, writes the audit with the ACTOR, then publishes', async () => {
    const res = await postJson('/reviews/rv-1/approve', { reason: 'Sieht harmlos aus' });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(decideReview).toHaveBeenCalledWith('rv-1', 'approved', FOUNDER, 'Sieht harmlos aus');
    expect(writeOpsAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'review_approve', actor: FOUNDER,
      meta: expect.objectContaining({ subject: 'review_queue_item', review_id: 'rv-1' }),
    }));
    expect(publishHostedApp).toHaveBeenCalledWith(expect.objectContaining({ operatorApproved: true, name: 'meinladen' }));
    expect(body).toMatchObject({ decision: 'approved', actor: FOUNDER, audit: 'written', published: true });
  });

  it('reports a failed publish as failed — an approval is not a live URL', async () => {
    publishHostedApp.mockResolvedValue({ ok: false, stage: 'name', code: 'name_taken', message: 'Dieser Name ist vergeben.' });
    const body = await (await postJson('/reviews/rv-1/approve', {})).json();
    expect(body.published).toBe(false);
    expect(body.publish).toMatchObject({ code: 'name_taken' });
    // And the decision is NOT rolled back — a human decided, a network call did not.
    expect(decideReview).toHaveBeenCalledWith('rv-1', 'approved', FOUNDER, null);
  });

  it('409s an item somebody else already decided, and publishes nothing', async () => {
    findReviewItem.mockResolvedValue({ ...REVIEW_ITEM, status: 'blocked' });
    expect((await postJson('/reviews/rv-1/approve', {})).status).toBe(409);
    expect(publishHostedApp).not.toHaveBeenCalled();
  });

  it('409s and publishes nothing when the row could not be settled', async () => {
    decideReview.mockResolvedValue(null);
    expect((await postJson('/reviews/rv-1/approve', {})).status).toBe(409);
    expect(publishHostedApp).not.toHaveBeenCalled();
  });

  // ── block ──
  it('REFUSES a block with no reason — 400, nothing decided, nothing logged', async () => {
    const res = await postJson('/reviews/rv-1/block', { reason: '   ' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('reason_required');
    expect(decideReview).not.toHaveBeenCalled();
    expect(writeOpsAudit).not.toHaveBeenCalled();
  });

  it('block settles the row and writes the audit with the actor and the reason', async () => {
    decideReview.mockResolvedValue({ ...REVIEW_ITEM, status: 'blocked' });
    const body = await (await postJson('/reviews/rv-1/block', { reason: 'Fake-Shop' })).json();
    expect(decideReview).toHaveBeenCalledWith('rv-1', 'blocked', FOUNDER, 'Fake-Shop');
    expect(writeOpsAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'review_block', actor: FOUNDER, reason: 'Fake-Shop' }));
    expect(body).toMatchObject({ decision: 'blocked', audit: 'written' });
    // A block takes nothing offline, because nothing ever went up.
    expect(publishHostedApp).not.toHaveBeenCalled();
  });

  it('passes an unavailable audit through verbatim instead of claiming a row', async () => {
    writeOpsAudit.mockResolvedValue('unavailable');
    decideReview.mockResolvedValue({ ...REVIEW_ITEM, status: 'blocked' });
    const body = await (await postJson('/reviews/rv-1/block', { reason: 'Fake-Shop' })).json();
    expect(body.audit).toBe('unavailable');
  });

  it('404s both decisions for a cohort user, and decides nothing', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u2', email: COHORT } }, error: null });
    const headers = { Authorization: 'Bearer t', 'content-type': 'application/json' };
    for (const p of ['/reviews/rv-1/approve', '/reviews/rv-1/block']) {
      const res = await opsConsole.request(p, { method: 'POST', headers, body: JSON.stringify({ reason: 'x' }) });
      expect(res.status, p).toBe(404);
      expect(await res.text()).toBe('404 Not Found');
    }
    expect(decideReview).not.toHaveBeenCalled();
    expect(publishHostedApp).not.toHaveBeenCalled();
  });
});
