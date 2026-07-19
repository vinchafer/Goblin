// WAVE-H · H1 — synthetic load harness (in-process, no live infra).
//
// Why in-process and not autocannon-against-prod: CLOUD RIDER — load tests NEVER run
// against prod under real users. A full HTTP harness needs a booted stack (Supabase +
// storage + a real/mocked model); the autocannon recipe for THAT lives in BASELINE.md
// for the founder to run locally. What this file measures is the exact DD surface the
// N-findings name (`run-registry.ts:86`, no global admission control): the process-level
// run registry under N concurrent runs, with a MOCKED execute (no model call, no tokens,
// no network). It is deterministic and runs in this sandbox, so the H4 before/after is a
// real number, not a claim.
//
// It drives `startRun` (the same entrypoint the agent route uses) with a synthetic
// execute that emits a few frames, waits `workMs`, then resolves — simulating a run that
// holds a slot for a bounded time. It attaches a stream to each run (the same
// `streamRunEvents` the SSE route uses) so subscriber lifecycle is exercised too (H3).
//
// Output: p50/p95 admit + first-frame + completion latencies, peak concurrent in-flight,
// admitted-vs-rejected counts, heap delta, and leaked-subscriber count. JSON to stdout
// (append `--json`) or a human summary (default).
//
// Run:  LOG_LEVEL=silent npx tsx _sprint/wave-h/harness/load-harness.ts --n 200 --work 200
//       (env caps AGENT_GLOBAL_MAX_CONCURRENT / AGENT_MAX_CONCURRENT_PER_USER apply)

import { startRun, streamRunEvents, admissionSnapshot } from '../../../apps/api/src/services/agent/run-registry';
import type { RunEvent } from '../../../apps/api/src/services/agent/run-events';

interface Args { n: number; work: number; users: number; json: boolean; ramp: number }

function parseArgs(argv: string[]): Args {
  const get = (flag: string, def: number): number => {
    const i = argv.indexOf(flag);
    if (i >= 0 && argv[i + 1]) { const v = Number(argv[i + 1]); if (Number.isFinite(v)) return v; }
    return def;
  };
  return {
    n: get('--n', 200),
    work: get('--work', 200),
    users: get('--users', 50),
    ramp: get('--ramp', 0),
    json: argv.includes('--json'),
  };
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface RunOutcome {
  admitted: boolean;
  rejectReason?: string;
  admitMs: number;
  firstFrameMs?: number;
  completeMs?: number;
}

async function driveOneRun(runId: string, userId: string, workMs: number): Promise<RunOutcome> {
  const t0 = Date.now();
  // startRun returns void in the H1 baseline (no admission control) and an
  // AdmissionResult after H4. Treat a void/undefined return as "admitted" so the SAME
  // harness produces the before AND after numbers — same tool, honest comparison.
  const res = startRun<void>({
    runId,
    userId,
    projectId: `proj-${userId}`,
    sessionId: `sess-${runId}`,
    modelSlug: 'goblin/efficient',
    execute: async ({ emit, stopSignal }) => {
      emit({ type: 'agent_narration', text: 'arbeitet…' });
      // Hold the slot for workMs unless stopped, simulating a bounded run.
      const step = 25;
      let elapsed = 0;
      while (elapsed < workMs && !stopSignal.aborted) { await sleep(step); elapsed += step; }
      emit({ type: 'agent_report', ok: true });
    },
    onComplete: () => {},
    onError: () => {},
  }) as { admitted?: boolean; reason?: string } | void;
  const admitMs = Date.now() - t0;
  if (res && res.admitted === false) return { admitted: false, rejectReason: res.reason, admitMs };

  // Attach a stream (same path the SSE route uses) and time first frame + completion.
  let firstFrameMs: number | undefined;
  const controller = new AbortController();
  const sink = (ev: RunEvent): void => {
    if (firstFrameMs === undefined) firstFrameMs = Date.now() - t0;
    void ev;
  };
  await streamRunEvents(runId, userId, 0, sink, { signal: controller.signal });
  const completeMs = Date.now() - t0;
  controller.abort();
  return { admitted: true, admitMs, firstFrameMs, completeMs };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const heapBefore = process.memoryUsage().heapUsed;

  let peakInFlight = 0;
  const poll = setInterval(() => {
    const snap = admissionSnapshot();
    if (snap.inFlight > peakInFlight) peakInFlight = snap.inFlight;
  }, 5);
  poll.unref?.();

  const outcomes: RunOutcome[] = [];
  const tasks: Promise<void>[] = [];
  for (let i = 0; i < args.n; i++) {
    const userId = `user-${i % args.users}`;
    const runId = `run-${i}-${userId}`;
    tasks.push(driveOneRun(runId, userId, args.work).then((o) => { outcomes.push(o); }));
    if (args.ramp > 0) await sleep(args.ramp);
  }
  await Promise.all(tasks);
  clearInterval(poll);

  // Let any eviction timers settle so the leaked-subscriber probe is honest.
  await sleep(50);
  const finalSnap = admissionSnapshot();
  const heapAfter = process.memoryUsage().heapUsed;

  const admitted = outcomes.filter((o) => o.admitted);
  const rejected = outcomes.filter((o) => !o.admitted);
  const admitLat = admitted.map((o) => o.admitMs).sort((a, b) => a - b);
  const firstLat = admitted.map((o) => o.firstFrameMs ?? 0).sort((a, b) => a - b);
  const compLat = admitted.map((o) => o.completeMs ?? 0).sort((a, b) => a - b);
  const rejectReasons = rejected.reduce<Record<string, number>>((acc, o) => {
    const k = o.rejectReason ?? 'unknown'; acc[k] = (acc[k] ?? 0) + 1; return acc;
  }, {});

  const report = {
    config: { concurrency: args.n, workMs: args.work, distinctUsers: args.users, rampMs: args.ramp },
    caps: {
      AGENT_GLOBAL_MAX_CONCURRENT: process.env.AGENT_GLOBAL_MAX_CONCURRENT ?? '(default)',
      AGENT_MAX_CONCURRENT_PER_USER: process.env.AGENT_MAX_CONCURRENT_PER_USER ?? '(default)',
    },
    admission: { admitted: admitted.length, rejected: rejected.length, rejectReasons, peakInFlight },
    latencyMs: {
      admit_p50: pct(admitLat, 50), admit_p95: pct(admitLat, 95),
      firstFrame_p50: pct(firstLat, 50), firstFrame_p95: pct(firstLat, 95),
      complete_p50: pct(compLat, 50), complete_p95: pct(compLat, 95),
    },
    hygiene: {
      leakedSubscribers: finalSnap.totalSubscribers,
      liveHandlesAfterDrain: finalSnap.inFlight,
      heapDeltaMB: +((heapAfter - heapBefore) / 1024 / 1024).toFixed(1),
    },
  };

  if (args.json) { process.stdout.write(JSON.stringify(report, null, 2) + '\n'); return; }

  const l = (s: string) => process.stdout.write(s + '\n');
  l('── WAVE-H load harness ──────────────────────────────────────');
  l(`concurrency=${args.n}  workMs=${args.work}  users=${args.users}  ramp=${args.ramp}ms`);
  l(`caps: global=${report.caps.AGENT_GLOBAL_MAX_CONCURRENT}  perUser=${report.caps.AGENT_MAX_CONCURRENT_PER_USER}`);
  l('');
  l(`admitted=${report.admission.admitted}  rejected=${report.admission.rejected}  peakInFlight=${report.admission.peakInFlight}`);
  if (report.admission.rejected > 0) l(`reject reasons: ${JSON.stringify(rejectReasons)}`);
  l('');
  l(`admit      p50=${report.latencyMs.admit_p50}ms  p95=${report.latencyMs.admit_p95}ms`);
  l(`firstFrame p50=${report.latencyMs.firstFrame_p50}ms  p95=${report.latencyMs.firstFrame_p95}ms`);
  l(`complete   p50=${report.latencyMs.complete_p50}ms  p95=${report.latencyMs.complete_p95}ms`);
  l('');
  l(`leakedSubscribers=${report.hygiene.leakedSubscribers}  liveHandlesAfterDrain=${report.hygiene.liveHandlesAfterDrain}  heapDelta=${report.hygiene.heapDeltaMB}MB`);
  l('─────────────────────────────────────────────────────────────');
}

void main();
