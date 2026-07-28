// AKT 2 · PHASE 1 · U1.5 — the self-test harness itself.
//
// IMPORTANT — what these tests are and are not. Cloudflare is MOCKED here, so
// these prove the harness's OWN honesty: that it counts runs correctly, that it
// detects a byte mismatch, that a leftover object makes it fail rather than pass,
// that it cleans up even after a failure, and that it refuses to run when a real
// app owns the self-test name. They do NOT prove the real substrate answers —
// only a run of POST /api/ops/selftest against the deployed API does that, and
// until that run exists the U1.5 gate is BLOCKED-ON-FOUNDER, not green.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const cf = {
  putAppFiles: vi.fn(),
  listAppFiles: vi.fn(),
  getAppFile: vi.fn(),
  deleteAppFiles: vi.fn(),
  setRoute: vi.fn(),
  getRoute: vi.fn(),
  deleteRoute: vi.fn(),
  deployWorker: vi.fn(),
  getWorker: vi.fn(),
  deleteWorker: vi.fn(),
  opsAppsDomain: vi.fn(() => 'justgoblin.app'),
};

vi.mock('./cf-deploy', () => cf);

const findOpsAppByName = vi.fn();
vi.mock('./ops-apps-store', () => ({ findOpsAppByName: (...a: unknown[]) => findOpsAppByName(...a) }));

const { runOpsSelftest, SELFTEST_APP_ID, SELFTEST_ROUTE_NAME, SELFTEST_WORKER_NAME } = await import('./ops-selftest');

const FILES = [
  { path: 'index.html', content: '<!doctype html><meta charset="utf-8"><h1>Goblin ops self-test</h1>\n' },
  { path: 'assets/app.css', content: ':root{--goblin:#000}\nbody{margin:0}\n' },
  { path: 'nested/deep/data.json', content: JSON.stringify({ selftest: true, phase: 'akt2-p1', n: 3 }) },
];

const ok = (value: unknown) => ({ ok: true, value });
const err = (code: string, message = 'boom') => ({ ok: false, error: { code, message } });

/** Everything answers exactly as a healthy Cloudflare would. */
function happyPath() {
  // The fake models real R2 state: a put restores the objects a previous run's
  // delete removed, so run 2 does not silently observe run 1's empty bucket.
  let deleted = true;
  cf.putAppFiles.mockImplementation(async () => {
    deleted = false;
    return ok({ files: 3, bytes: 123 });
  });
  cf.listAppFiles.mockImplementation(async () =>
    ok(deleted ? [] : FILES.map((f) => ({ path: f.path, key: `apps/${SELFTEST_APP_ID}/${f.path}`, size: 1 }))),
  );
  cf.getAppFile.mockImplementation(async (_id: string, path: string) => {
    const file = FILES.find((f) => f.path === path)!;
    return ok({ path, bytes: new TextEncoder().encode(file.content) });
  });
  cf.deleteAppFiles.mockImplementation(async () => {
    const res = ok({ deleted: deleted ? 0 : 3, batches: deleted ? 0 : 1 });
    deleted = true;
    return res;
  });

  let route: { appId: string } | null = null;
  cf.setRoute.mockImplementation(async (_n: string, appId: string) => {
    route = { appId };
    return ok({ name: SELFTEST_ROUTE_NAME, appId, status: 'active' });
  });
  cf.getRoute.mockImplementation(async () => ok(route));
  cf.deleteRoute.mockImplementation(async () => {
    const had = route !== null;
    route = null;
    return ok({ deleted: had });
  });

  let worker: { size: number } | null = null;
  cf.deployWorker.mockImplementation(async () => {
    worker = { size: 140 };
    return ok({ scriptName: SELFTEST_WORKER_NAME, bytes: 140 });
  });
  cf.getWorker.mockImplementation(async () => ok(worker ? { scriptName: SELFTEST_WORKER_NAME, size: worker.size } : null));
  cf.deleteWorker.mockImplementation(async () => {
    const had = worker !== null;
    worker = null;
    return ok({ deleted: had });
  });
}

beforeEach(() => {
  for (const fn of Object.values(cf)) (fn as ReturnType<typeof vi.fn>).mockReset();
  cf.opsAppsDomain.mockReturnValue('justgoblin.app');
  findOpsAppByName.mockReset();
  findOpsAppByName.mockResolvedValue(null);
});

describe('the happy path', () => {
  it('reports 3/3 on all three surfaces and passes', async () => {
    happyPath();
    const report = await runOpsSelftest();
    expect(report.passed).toBe(true);
    expect(report.summary).toBe('r2 3/3 · kv 3/3 · workers 3/3');
    expect(report.suites.map((s) => s.result)).toEqual(['3/3', '3/3', '3/3']);
    expect(report.suites.every((s) => s.cleanedUp)).toBe(true);
    expect(report.scope).toMatchObject({
      appId: 'test-roundtrip',
      routeName: 'test-roundtrip',
      workerName: 'goblin-ops-selftest',
      r2Prefix: 'apps/test-roundtrip/',
    });
  });

  it('stays inside its own hard-coded scope', async () => {
    happyPath();
    await runOpsSelftest();
    for (const call of cf.putAppFiles.mock.calls) expect(call[0]).toBe(SELFTEST_APP_ID);
    for (const call of cf.setRoute.mock.calls) expect(call[0]).toBe(SELFTEST_ROUTE_NAME);
    for (const call of cf.deployWorker.mock.calls) expect(call[0]).toBe(SELFTEST_WORKER_NAME);
  });

  it('honors a runs override and clamps it', async () => {
    happyPath();
    expect((await runOpsSelftest({ runs: 1 })).suites[0]!.result).toBe('1/1');
    happyPath();
    expect((await runOpsSelftest({ runs: 999 })).suites[0]!.result).toBe('10/10');
    happyPath();
    expect((await runOpsSelftest({ runs: 0 })).suites[0]!.result).toBe('3/3');
  });
});

describe('it cannot be fooled into reading green', () => {
  it('fails on a byte mismatch even though every call succeeded', async () => {
    happyPath();
    cf.getAppFile.mockImplementation(async (_id: string, path: string) =>
      ok({ path, bytes: new TextEncoder().encode('TAMPERED') }),
    );
    const report = await runOpsSelftest({ runs: 1 });
    expect(report.passed).toBe(false);
    const mismatch = report.suites[0]!.steps.find((s) => s.observed === 'BYTES DIFFER');
    expect(mismatch).toBeTruthy();
    expect(report.suites[0]!.steps.find((s) => s.step.includes('byte-match total'))?.observed).toBe('0/3');
  });

  it('fails when the delete leaves objects behind', async () => {
    happyPath();
    cf.listAppFiles.mockResolvedValue(ok([{ path: 'index.html', key: 'k', size: 1 }]));
    cf.deleteAppFiles.mockResolvedValue(ok({ deleted: 3, batches: 1 }));
    const report = await runOpsSelftest({ runs: 1 });
    expect(report.passed).toBe(false);
    expect(report.suites[0]!.steps.find((s) => s.step.includes('list after delete'))?.observed).toBe('1');
  });

  it('fails when a route survives its own deletion', async () => {
    happyPath();
    cf.getRoute.mockResolvedValue(ok({ name: SELFTEST_ROUTE_NAME, appId: 'test-roundtrip-1', status: 'active' }));
    const report = await runOpsSelftest({ runs: 1 });
    expect(report.passed).toBe(false);
    const kv = report.suites.find((s) => s.surface === 'kv')!;
    expect(kv.steps.find((s) => s.step.includes('after delete'))?.observed).toBe('STILL PRESENT');
  });

  it('fails when a worker survives its own deletion', async () => {
    happyPath();
    cf.getWorker.mockResolvedValue(ok({ scriptName: SELFTEST_WORKER_NAME, size: 140 }));
    const report = await runOpsSelftest({ runs: 1 });
    expect(report.passed).toBe(false);
    const workers = report.suites.find((s) => s.surface === 'workers')!;
    expect(workers.steps.find((s) => s.step.includes('after delete'))?.observed).toBe('STILL PRESENT');
  });

  it('fails when cleanup itself fails, even if every run passed', async () => {
    happyPath();
    const realDelete = cf.deleteWorker.getMockImplementation()!;
    let calls = 0;
    cf.deleteWorker.mockImplementation(async (...args: unknown[]) => {
      calls += 1;
      // runs 1..3 delete fine; the trailing cleanup call fails
      return calls > 3 ? err('upstream') : realDelete(...(args as []));
    });
    const report = await runOpsSelftest();
    expect(report.suites.find((s) => s.surface === 'workers')!.passedRuns).toBe(3);
    expect(report.suites.find((s) => s.surface === 'workers')!.cleanedUp).toBe(false);
    expect(report.passed).toBe(false);
  });
});

describe('failure handling', () => {
  it('records a typed error code and still attempts cleanup', async () => {
    happyPath();
    cf.putAppFiles.mockResolvedValue(err('auth', 'token lacks R2 write'));
    const report = await runOpsSelftest({ runs: 1 });
    expect(report.passed).toBe(false);
    const r2 = report.suites.find((s) => s.surface === 'r2')!;
    expect(r2.result).toBe('0/1');
    expect(r2.steps[0]!.code).toBe('auth');
    expect(cf.deleteAppFiles).toHaveBeenCalled(); // cleanup ran despite the failure
  });

  it('never throws, whatever the adapter returns', async () => {
    for (const fn of Object.values(cf)) {
      if (fn === cf.opsAppsDomain) continue;
      (fn as ReturnType<typeof vi.fn>).mockResolvedValue(err('upstream', 'everything is down'));
    }
    await expect(runOpsSelftest({ runs: 1 })).resolves.toMatchObject({ passed: false });
  });

  it('reports one surface failing without hiding the others', async () => {
    happyPath();
    cf.setRoute.mockResolvedValue(err('not_configured', 'CF_KV_NAMESPACE_ID missing'));
    const report = await runOpsSelftest({ runs: 1 });
    expect(report.summary).toBe('r2 1/1 · kv 0/1 · workers 1/1');
    expect(report.passed).toBe(false);
  });
});

describe('safety', () => {
  it('refuses to run if a registered app owns the self-test name', async () => {
    happyPath();
    findOpsAppByName.mockResolvedValue({ appId: 'real', appName: SELFTEST_ROUTE_NAME });
    const report = await runOpsSelftest();
    expect(report.passed).toBe(false);
    expect(report.summary).toBe('refused');
    expect(report.refused).toContain('test-roundtrip');
    expect(cf.putAppFiles).not.toHaveBeenCalled();
    expect(cf.setRoute).not.toHaveBeenCalled();
    expect(cf.deployWorker).not.toHaveBeenCalled();
  });
});
