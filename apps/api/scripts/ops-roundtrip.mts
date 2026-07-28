/**
 * AKT 2 · PHASE 1.5 · U1.5a — LOCAL round-trip harness (dev-only).
 *
 * ── Why this exists ───────────────────────────────────────────────────────────
 * U1.5's round-trip proof also runs as the deployed /api/ops/selftest endpoint,
 * because the Cloudflare credentials live in Railway. But a founder can ALSO hold
 * those credentials on their own laptop (the local .env.local), and there the
 * adapter can be exercised DIRECTLY — no HTTP, no Supabase login, no auth token,
 * no trial gate. That is what closes gate U1.5 with real evidence when the cloud
 * path is blocked. This script is that direct driver.
 *
 * ── What it does ──────────────────────────────────────────────────────────────
 *   1. Loads the local env (via ../src/load-env — the same loader index.ts uses).
 *   2. REFUSES to run if any adapter env var is missing — reporting NAMES ONLY,
 *      never a value or a length.
 *   3. Runs the EXISTING round-trip (services/ops-selftest → the adapter), each
 *      surface 3× by default, printing the numeric result of every step.
 *   4. Cleans up the fixed test scope in a `finally`, ALWAYS — even on crash — and
 *      reports the cleanup outcome. A run that leaves debris is not green.
 *
 * ── Secret hygiene ────────────────────────────────────────────────────────────
 * Nothing here prints a secret value. Env presence is booleans by name; every
 * upstream error string has already been redacted by the adapter before it
 * reaches a step's `detail`. Safe to pipe to an evidence file.
 *
 * ── Blast radius ──────────────────────────────────────────────────────────────
 * The only keys this can ever touch are the hard-coded self-test constants:
 *   R2 prefix  apps/test-roundtrip/   ·  KV key  route:test-roundtrip
 *   Worker     goblin-ops-selftest
 * They are constants in services/ops-selftest, never derived from input.
 *
 * Run:  cd apps/api && npx tsx scripts/ops-roundtrip.mts            (3 runs)
 *       cd apps/api && npx tsx scripts/ops-roundtrip.mts --runs 5   (N runs)
 */

import '../src/load-env';
import { CF_ENV_VARS, cfEnvPresence, deleteAppFiles, deleteRoute, deleteWorker } from '../src/services/cf-deploy';
import {
  runOpsSelftest,
  SELFTEST_APP_ID,
  SELFTEST_ROUTE_NAME,
  SELFTEST_WORKER_NAME,
} from '../src/services/ops-selftest';

function parseRuns(): number {
  const i = process.argv.indexOf('--runs');
  if (i === -1) return 3;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 10) : 3;
}

/** Belt-and-suspenders teardown of the fixed scope, independent of the suite's own cleanup. */
async function finalCleanup(): Promise<string> {
  const parts: string[] = [];
  try {
    const r2 = await deleteAppFiles(SELFTEST_APP_ID);
    parts.push(`r2 ${r2.ok ? `deleted ${r2.value.deleted}` : `FAILED(${r2.error.code})`}`);
  } catch (e) {
    parts.push(`r2 THREW(${(e as Error)?.name ?? 'error'})`);
  }
  try {
    const kv = await deleteRoute(SELFTEST_ROUTE_NAME);
    parts.push(`kv ${kv.ok ? (kv.value.deleted ? 'deleted' : 'already-absent') : `FAILED(${kv.error.code})`}`);
  } catch (e) {
    parts.push(`kv THREW(${(e as Error)?.name ?? 'error'})`);
  }
  try {
    const w = await deleteWorker(SELFTEST_WORKER_NAME);
    parts.push(`workers ${w.ok ? (w.value.deleted ? 'deleted' : 'already-absent') : `FAILED(${w.error.code})`}`);
  } catch (e) {
    parts.push(`workers THREW(${(e as Error)?.name ?? 'error'})`);
  }
  return parts.join(' · ');
}

async function main(): Promise<number> {
  const runs = parseRuns();

  // ── Env presence gate. NAMES ONLY in the message. ──────────────────────────
  const presence = cfEnvPresence();
  const missing = CF_ENV_VARS.filter((name) => !presence[name]);
  console.log('== ops round-trip (LOCAL, direct adapter) ==');
  console.log(`env presence: ${CF_ENV_VARS.map((n) => `${n}=${presence[n] ? 'set' : 'MISSING'}`).join('  ')}`);
  if (missing.length > 0) {
    console.error(`\nREFUSING TO RUN — missing required env var(s): ${missing.join(', ')}`);
    console.error('These must be present in the local env file. No values are read or printed here.');
    return 2;
  }
  console.log(`runs per surface: ${runs}\n`);

  const report = await runOpsSelftest({ runs });

  if (report.refused) {
    console.error(`REFUSED: ${report.refused}`);
    return 3;
  }

  // ── Per-step numeric detail. ───────────────────────────────────────────────
  for (const suite of report.suites) {
    console.log(`── ${suite.surface.toUpperCase()} — ${suite.result} runs · cleanup ${suite.cleanedUp ? 'ok' : 'FAILED'}`);
    for (const step of suite.steps) {
      const mark = step.ok ? 'ok ' : 'FAIL';
      const obs = step.observed !== undefined ? ` [${step.observed}${step.expected ? ` / exp ${step.expected}` : ''}]` : '';
      const det = step.detail ? ` — ${step.code ?? 'err'}: ${step.detail}` : '';
      console.log(`   ${mark} ${step.step}${obs}${det}`);
    }
    console.log('');
  }

  // ── The gate's own summary line. ───────────────────────────────────────────
  const cleanupOk = report.suites.every((s) => s.cleanedUp);
  const summaryLine = `${report.summary} · cleanup ${cleanupOk ? 'ok' : 'FAILED'}`;
  console.log(`SUMMARY: ${summaryLine}`);
  console.log(`PASSED: ${report.passed && cleanupOk ? 'YES' : 'NO'}  (tookMs=${report.tookMs})`);

  return report.passed && cleanupOk ? 0 : 1;
}

let exitCode = 1;
try {
  exitCode = await main();
} catch (err) {
  console.error(`\nHARNESS CRASHED: ${(err as Error)?.message ?? String(err)}`);
  exitCode = 1;
} finally {
  const cleanup = await finalCleanup();
  console.log(`\nFINAL CLEANUP: ${cleanup}`);
}
process.exit(exitCode);
