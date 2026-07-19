// WAVE-H · H5 — observability metrics (closes ticket #12). A tiny in-process metrics
// registry that turns the signals the platform already produces (HTTP status, agent-run
// lifecycle, admission shedding, circuit-breaker state) into a founder-reachable snapshot
// with derived ALERTS — so the founder sees an incident on GET /api/admin/metrics before a
// user reports it. NO new paid service: this is the "Railway + platform_events + a simple
// internal surface is sufficient" branch of the H5 decision, not a hosted observability SaaS.
//
// Honest scope: counters are IN-PROCESS and reset on deploy/restart (per-instance, exactly
// like rate-limit/abuse-cap/cache — Code-DD N-2/N-4). On the single Railway box that is the
// whole fleet, so the numbers are complete; a cross-replica aggregate would need the same
// founder-gated shared store the N-findings name, NOT assumed here. Rolling counts use
// one-minute buckets over a bounded window so "error rate" means "recently", not "since boot".

import { getAllCircuitStates } from '../middleware/circuit-breaker';
import { admissionSnapshot } from '../services/agent/run-registry';

/** How many one-minute buckets the rolling window keeps (error-rate / shedding "recently"). */
const WINDOW_MINUTES = 15;
/** Below this many requests in the window, an error-rate % is statistically meaningless. */
const MIN_SAMPLES_FOR_RATE = 20;
/** Rolling 5xx rate (%) at/above which the metrics surface raises an error-spike alert. */
const ERROR_RATE_ALERT_PCT = 10;

interface MinuteBucket {
  minute: number; // Math.floor(ms / 60000)
  requests: number;
  errors: number; // 5xx
  admissionRejected: number;
}

// ── cumulative counters (since process start) ───────────────────────────────
const totals = {
  httpRequests: 0,
  httpErrors: 0, // 5xx
  agentRunsStarted: 0,
  agentRunsFinished: 0,
  agentRunsFailed: 0, // outcome 'error' or a fatal throw
  admissionRejected: 0,
};
const agentOutcomes: Record<string, number> = {}; // finished / stopped / budget / error
const admissionReasons: Record<string, number> = {}; // per_user_limit / global_limit
const startedAt = Date.now();

// ── rolling window ──────────────────────────────────────────────────────────
const buckets: MinuteBucket[] = [];

function currentBucket(nowMs: number): MinuteBucket {
  const minute = Math.floor(nowMs / 60_000);
  let b = buckets[buckets.length - 1];
  if (!b || b.minute !== minute) {
    b = { minute, requests: 0, errors: 0, admissionRejected: 0 };
    buckets.push(b);
    // Drop buckets older than the window (bounded memory).
    const cutoff = minute - WINDOW_MINUTES;
    while (buckets.length && buckets[0]!.minute <= cutoff) buckets.shift();
  }
  return b;
}

/** Record one HTTP response. `nowMs` injectable for deterministic tests. */
export function recordHttp(status: number, nowMs: number = Date.now()): void {
  totals.httpRequests += 1;
  const b = currentBucket(nowMs);
  b.requests += 1;
  if (status >= 500) {
    totals.httpErrors += 1;
    b.errors += 1;
  }
}

/** Record an agent-run lifecycle event. */
export function recordAgentRun(
  event: 'started' | 'finished' | 'admission_rejected',
  meta?: { outcome?: string; reason?: string },
  nowMs: number = Date.now(),
): void {
  if (event === 'started') {
    totals.agentRunsStarted += 1;
  } else if (event === 'finished') {
    totals.agentRunsFinished += 1;
    const outcome = meta?.outcome ?? 'unknown';
    agentOutcomes[outcome] = (agentOutcomes[outcome] ?? 0) + 1;
    if (outcome === 'error') totals.agentRunsFailed += 1;
  } else if (event === 'admission_rejected') {
    totals.admissionRejected += 1;
    const reason = meta?.reason ?? 'unknown';
    admissionReasons[reason] = (admissionReasons[reason] ?? 0) + 1;
    currentBucket(nowMs).admissionRejected += 1;
  }
}

interface WindowAgg { requests: number; errors: number; admissionRejected: number; errorRatePct: number | null }

function windowAgg(nowMs: number): WindowAgg {
  const cutoff = Math.floor(nowMs / 60_000) - WINDOW_MINUTES;
  let requests = 0, errors = 0, admissionRejected = 0;
  for (const b of buckets) {
    if (b.minute <= cutoff) continue;
    requests += b.requests; errors += b.errors; admissionRejected += b.admissionRejected;
  }
  const errorRatePct = requests >= MIN_SAMPLES_FOR_RATE ? +((errors / requests) * 100).toFixed(1) : null;
  return { requests, errors, admissionRejected, errorRatePct };
}

export interface MetricsSnapshot {
  uptimeSec: number;
  memoryMB: number;
  http: { total: number; errors: number; window: WindowAgg };
  agent: {
    started: number;
    finished: number;
    failed: number;
    successRatePct: number | null;
    outcomes: Record<string, number>;
    admissionRejected: number;
    admissionReasons: Record<string, number>;
  };
  live: { inFlightRuns: number; subscribers: number };
  circuits: Array<{ name: string; state: string; failures: number }>;
  alerts: string[];
  perInstanceNote: string;
}

/**
 * The founder-reachable snapshot. Pure read (safe to call from a health/admin route).
 * `alerts` is the "someone should look now" list, derived so a synthetic incident (an
 * error spike, an OPEN breaker, capacity shedding) is visible in one GET.
 */
export function metricsSnapshot(nowMs: number = Date.now()): MetricsSnapshot {
  const live = admissionSnapshot();
  const circuits = getAllCircuitStates();
  const window = windowAgg(nowMs);
  const successRatePct = totals.agentRunsFinished > 0
    ? +(((totals.agentRunsFinished - totals.agentRunsFailed) / totals.agentRunsFinished) * 100).toFixed(1)
    : null;

  const alerts: string[] = [];
  if (window.errorRatePct !== null && window.errorRatePct >= ERROR_RATE_ALERT_PCT) {
    alerts.push(`error_rate_high:${window.errorRatePct}%`);
  }
  const open = circuits.filter((c) => c.state === 'OPEN').map((c) => c.name);
  if (open.length) alerts.push(`circuit_open:${open.join(',')}`);
  if (window.admissionRejected > 0) alerts.push(`capacity_shedding:${window.admissionRejected}`);

  return {
    uptimeSec: Math.floor((nowMs - startedAt) / 1000),
    memoryMB: +(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1),
    http: { total: totals.httpRequests, errors: totals.httpErrors, window },
    agent: {
      started: totals.agentRunsStarted,
      finished: totals.agentRunsFinished,
      failed: totals.agentRunsFailed,
      successRatePct,
      outcomes: { ...agentOutcomes },
      admissionRejected: totals.admissionRejected,
      admissionReasons: { ...admissionReasons },
    },
    live: { inFlightRuns: live.inFlight, subscribers: live.totalSubscribers },
    circuits,
    alerts,
    perInstanceNote: 'in-process counters; reset on deploy; single-box = whole fleet (N-2/N-4 cross-replica store is founder-gated)',
  };
}

/** Test-only reset of the metrics registry. */
export function __resetMetricsForTest(): void {
  totals.httpRequests = 0; totals.httpErrors = 0;
  totals.agentRunsStarted = 0; totals.agentRunsFinished = 0; totals.agentRunsFailed = 0;
  totals.admissionRejected = 0;
  for (const k of Object.keys(agentOutcomes)) delete agentOutcomes[k];
  for (const k of Object.keys(admissionReasons)) delete admissionReasons[k];
  buckets.length = 0;
}
