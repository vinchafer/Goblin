/**
 * AKT 2 · PHASE 1 · U1.5 — the round-trip proof against the REAL Cloudflare APIs.
 *
 * ── Why this is an endpoint and not a script ──────────────────────────────────
 * The Cloudflare credentials live only in the Railway environment. A cloud CC
 * session is not a vault (OPS_SPIKE_0 §4.4), and neither is a founder's phone, so
 * neither may hold a token in order to prove the adapter works. This code runs
 * INSIDE the deployed API — the one process that legitimately holds the
 * credentials — and returns a report. The founder triggers it with one authorized
 * request and reads the result; no human and no session ever sees a secret.
 *
 * ── What it proves ───────────────────────────────────────────────────────────
 * Three round-trips, each run `runs` times (default 3), each a full
 * create → read-back → delete → verify-gone cycle on a real substrate:
 *   (a) R2      put 3 files → list (3/3) → get each and byte-match → batched
 *               delete → list (0)
 *   (b) KV      setRoute → getRoute matches → deleteRoute → gone
 *   (c) Workers deploy a throwaway hello script → read back exists → delete → gone
 *
 * ── Safety ───────────────────────────────────────────────────────────────────
 * The names are CONSTANTS, not parameters: this cannot be pointed at a real app,
 * because there is nothing to point. Before it runs it checks the registry for an
 * app squatting the self-test name and refuses if one exists. Cleanup is attempted
 * even when a step fails, and the cleanup outcome is reported rather than assumed
 * — a self-test that leaves debris and calls itself green is worse than no test.
 */

import { createHash } from 'node:crypto';
import {
  deleteAppFiles,
  deleteRoute,
  deleteWorker,
  deployWorker,
  getAppFile,
  getRoute,
  getWorker,
  listAppFiles,
  opsAppsDomain,
  putAppFiles,
  setRoute,
  type CfError,
} from './cf-deploy';
import { findOpsAppByName } from './ops-apps-store';
import logger from '../lib/logger';

/** Fixed, unmistakable scope. Never derived from a request. */
export const SELFTEST_APP_ID = 'test-roundtrip';
export const SELFTEST_ROUTE_NAME = 'test-roundtrip';
export const SELFTEST_WORKER_NAME = 'goblin-ops-selftest';

const DEFAULT_RUNS = 3;

/** The three files of the R2 round-trip. Fixed content so byte-match is exact. */
const SELFTEST_FILES = [
  { path: 'index.html', content: '<!doctype html><meta charset="utf-8"><h1>Goblin ops self-test</h1>\n' },
  { path: 'assets/app.css', content: ':root{--goblin:#000}\nbody{margin:0}\n' },
  { path: 'nested/deep/data.json', content: JSON.stringify({ selftest: true, phase: 'akt2-p1', n: 3 }) },
] as const;

export interface SelftestStep {
  step: string;
  ok: boolean;
  /** Numbers, not adjectives: "3/3", "0", "match". */
  observed?: string;
  expected?: string;
  code?: CfError['code'];
  detail?: string;
}

export interface SelftestSuite {
  surface: 'r2' | 'kv' | 'workers';
  runs: number;
  passedRuns: number;
  /** "3/3" — the gate's own vocabulary. */
  result: string;
  steps: SelftestStep[];
  cleanedUp: boolean;
}

export interface SelftestReport {
  passed: boolean;
  summary: string;
  refused?: string;
  suites: SelftestSuite[];
  scope: { appId: string; routeName: string; workerName: string; r2Prefix: string; appsDomain: string };
  startedAt: string;
  tookMs: number;
}

function sha256(bytes: Uint8Array | string): string {
  return createHash('sha256').update(Buffer.from(bytes as never)).digest('hex');
}

function stepFail(step: string, error: CfError, expected?: string): SelftestStep {
  return {
    step,
    ok: false,
    code: error.code,
    detail: error.message.slice(0, 300),
    ...(expected ? { expected } : {}),
  };
}

// ── (a) R2 ──────────────────────────────────────────────────────────────────

async function r2Run(run: number): Promise<SelftestStep[]> {
  const steps: SelftestStep[] = [];
  const tag = `run ${run}`;

  const put = await putAppFiles(SELFTEST_APP_ID, SELFTEST_FILES.map((f) => ({ path: f.path, content: f.content })));
  if (!put.ok) return [stepFail(`${tag}: put 3 files`, put.error, '3 files')];
  steps.push({ step: `${tag}: put 3 files`, ok: put.value.files === 3, observed: `${put.value.files}/3`, expected: '3/3' });

  const listed = await listAppFiles(SELFTEST_APP_ID);
  if (!listed.ok) return [...steps, stepFail(`${tag}: list after put`, listed.error, '3')];
  steps.push({
    step: `${tag}: list after put`,
    ok: listed.value.length === 3,
    observed: `${listed.value.length}/3`,
    expected: '3/3',
  });

  // Byte-match every file: fetch it back and compare sha256 against what we wrote.
  let matched = 0;
  for (const file of SELFTEST_FILES) {
    const got = await getAppFile(SELFTEST_APP_ID, file.path);
    if (!got.ok) {
      steps.push(stepFail(`${tag}: get ${file.path}`, got.error, 'byte-match'));
      continue;
    }
    if (!got.value) {
      steps.push({ step: `${tag}: get ${file.path}`, ok: false, observed: 'absent', expected: 'byte-match' });
      continue;
    }
    const same = sha256(got.value.bytes) === sha256(file.content);
    if (same) matched += 1;
    steps.push({
      step: `${tag}: get ${file.path}`,
      ok: same,
      observed: same ? 'byte-match' : 'BYTES DIFFER',
      expected: 'byte-match',
    });
  }
  steps.push({ step: `${tag}: byte-match total`, ok: matched === 3, observed: `${matched}/3`, expected: '3/3' });

  const deleted = await deleteAppFiles(SELFTEST_APP_ID);
  if (!deleted.ok) return [...steps, stepFail(`${tag}: batched delete`, deleted.error, '3 deleted')];
  steps.push({
    step: `${tag}: batched delete`,
    ok: deleted.value.deleted === 3,
    observed: `${deleted.value.deleted} in ${deleted.value.batches} batch(es)`,
    expected: '3 in 1 batch(es)',
  });

  const after = await listAppFiles(SELFTEST_APP_ID);
  if (!after.ok) return [...steps, stepFail(`${tag}: list after delete`, after.error, '0')];
  steps.push({ step: `${tag}: list after delete`, ok: after.value.length === 0, observed: `${after.value.length}`, expected: '0' });

  return steps;
}

// ── (b) KV ──────────────────────────────────────────────────────────────────

async function kvRun(run: number): Promise<SelftestStep[]> {
  const steps: SelftestStep[] = [];
  const tag = `run ${run}`;
  const expectedAppId = `${SELFTEST_APP_ID}-${run}`;

  const set = await setRoute(SELFTEST_ROUTE_NAME, expectedAppId);
  if (!set.ok) return [stepFail(`${tag}: setRoute`, set.error, expectedAppId)];
  steps.push({ step: `${tag}: setRoute`, ok: true, observed: expectedAppId });

  const got = await getRoute(SELFTEST_ROUTE_NAME);
  if (!got.ok) return [...steps, stepFail(`${tag}: getRoute`, got.error, expectedAppId)];
  const match = got.value?.appId === expectedAppId;
  steps.push({
    step: `${tag}: getRoute matches`,
    ok: match,
    observed: got.value ? got.value.appId : 'absent',
    expected: expectedAppId,
  });

  const del = await deleteRoute(SELFTEST_ROUTE_NAME);
  if (!del.ok) return [...steps, stepFail(`${tag}: deleteRoute`, del.error, 'deleted')];
  steps.push({ step: `${tag}: deleteRoute`, ok: true, observed: del.value.deleted ? 'deleted' : 'already absent' });

  const after = await getRoute(SELFTEST_ROUTE_NAME);
  if (!after.ok) return [...steps, stepFail(`${tag}: getRoute after delete`, after.error, 'gone')];
  steps.push({
    step: `${tag}: getRoute after delete`,
    ok: after.value === null,
    observed: after.value === null ? 'gone' : 'STILL PRESENT',
    expected: 'gone',
  });

  return steps;
}

// ── (c) Workers ─────────────────────────────────────────────────────────────

const HELLO_WORKER = `export default {
  fetch() {
    return new Response('goblin ops self-test', { headers: { 'content-type': 'text/plain' } });
  },
};
`;

async function workersRun(run: number): Promise<SelftestStep[]> {
  const steps: SelftestStep[] = [];
  const tag = `run ${run}`;

  const deployed = await deployWorker(SELFTEST_WORKER_NAME, HELLO_WORKER);
  if (!deployed.ok) return [stepFail(`${tag}: deployWorker`, deployed.error, 'uploaded')];
  steps.push({ step: `${tag}: deployWorker`, ok: true, observed: `${deployed.value.bytes} bytes` });

  const read = await getWorker(SELFTEST_WORKER_NAME);
  if (!read.ok) return [...steps, stepFail(`${tag}: getWorker`, read.error, 'exists')];
  steps.push({
    step: `${tag}: getWorker exists`,
    ok: read.value !== null,
    observed: read.value ? `${read.value.size} bytes` : 'absent',
    expected: 'exists',
  });

  const del = await deleteWorker(SELFTEST_WORKER_NAME);
  if (!del.ok) return [...steps, stepFail(`${tag}: deleteWorker`, del.error, 'deleted')];
  steps.push({ step: `${tag}: deleteWorker`, ok: true, observed: del.value.deleted ? 'deleted' : 'already absent' });

  const after = await getWorker(SELFTEST_WORKER_NAME);
  if (!after.ok) return [...steps, stepFail(`${tag}: getWorker after delete`, after.error, 'gone')];
  steps.push({
    step: `${tag}: getWorker after delete`,
    ok: after.value === null,
    observed: after.value === null ? 'gone' : 'STILL PRESENT',
    expected: 'gone',
  });

  return steps;
}

// ── Orchestration ───────────────────────────────────────────────────────────

/**
 * Best-effort teardown, run whatever happened. Its outcome is REPORTED, never
 * assumed: a self-test that leaves debris behind and still reads green is worse
 * than no self-test.
 */
async function cleanup(surface: SelftestSuite['surface']): Promise<boolean> {
  try {
    if (surface === 'r2') {
      const res = await deleteAppFiles(SELFTEST_APP_ID);
      return res.ok;
    }
    if (surface === 'kv') {
      const res = await deleteRoute(SELFTEST_ROUTE_NAME);
      return res.ok;
    }
    const res = await deleteWorker(SELFTEST_WORKER_NAME);
    return res.ok;
  } catch {
    return false;
  }
}

async function runSuite(
  surface: SelftestSuite['surface'],
  runner: (run: number) => Promise<SelftestStep[]>,
  runs: number,
): Promise<SelftestSuite> {
  const steps: SelftestStep[] = [];
  let passedRuns = 0;
  for (let run = 1; run <= runs; run += 1) {
    const runSteps = await runner(run);
    steps.push(...runSteps);
    if (runSteps.length > 0 && runSteps.every((s) => s.ok)) passedRuns += 1;
  }
  const cleanedUp = await cleanup(surface);
  return { surface, runs, passedRuns, result: `${passedRuns}/${runs}`, steps, cleanedUp };
}

/**
 * Run all three round-trips. Returns a report; never throws — the adapter returns
 * typed results and this function only ever reads them.
 */
export async function runOpsSelftest(opts: { runs?: number } = {}): Promise<SelftestReport> {
  const started = Date.now();
  const runs = Number.isFinite(opts.runs) && (opts.runs as number) > 0 ? Math.min(Math.floor(opts.runs as number), 10) : DEFAULT_RUNS;

  const scope = {
    appId: SELFTEST_APP_ID,
    routeName: SELFTEST_ROUTE_NAME,
    workerName: SELFTEST_WORKER_NAME,
    r2Prefix: `apps/${SELFTEST_APP_ID}/`,
    appsDomain: opsAppsDomain(),
  };

  // Refuse rather than trample: if a real app ever claims the self-test name, this
  // test must not touch its route. Pre-migration this is null and the check is a
  // no-op — which is correct, because pre-migration no app can exist.
  const squatter = await findOpsAppByName(SELFTEST_ROUTE_NAME);
  if (squatter) {
    return {
      passed: false,
      summary: 'refused',
      refused: `a registered app already owns the name "${SELFTEST_ROUTE_NAME}" — self-test not run`,
      suites: [],
      scope,
      startedAt: new Date(started).toISOString(),
      tookMs: Date.now() - started,
    };
  }

  const suites: SelftestSuite[] = [
    await runSuite('r2', r2Run, runs),
    await runSuite('kv', kvRun, runs),
    await runSuite('workers', workersRun, runs),
  ];

  const passed = suites.every((s) => s.passedRuns === s.runs && s.cleanedUp);
  const summary = suites.map((s) => `${s.surface} ${s.result}`).join(' · ');

  logger.warn({ passed, summary, cleanedUp: suites.map((s) => s.cleanedUp) }, 'ops_selftest_report');

  return {
    passed,
    summary,
    suites,
    scope,
    startedAt: new Date(started).toISOString(),
    tookMs: Date.now() - started,
  };
}
