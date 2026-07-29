/**
 * AKT 2 · PHASE 2.5 · U-C4 — the E2E run as a JOB, because a phone cannot hold a
 * 15-minute HTTP request open.
 *
 * ── What this is, and what it deliberately is not ────────────────────────────
 * It is a thin wrapper that starts `runOpsE2E` (services/ops-e2e.ts) in the
 * background and lets a poller read the steps as they land. It re-implements
 * NOTHING: every step, every number and every propagation measurement comes from
 * the existing runner via its `onStep` observer. If this file and the runner ever
 * disagree, the runner is right — this one only stores what it was handed.
 *
 * ── The honesty problem this file has, stated rather than hidden ─────────────
 * State lives in this process's memory. That has three consequences, and all
 * three are surfaced to the operator instead of being papered over:
 *
 *   1. A REDEPLOY LOSES THE VIEW, NOT NECESSARILY THE RUN. Railway restarts the
 *      process; the job map goes with it. The run itself is `fetch` calls against
 *      Cloudflare and Supabase that may well have completed — the writes are real
 *      either way. So a lost job is reported as exactly that: the progress view is
 *      gone, the run's effects are not. `GET /status/:id` for an unknown id says
 *      "unknown", never "failed" and never "done".
 *   2. MULTIPLE INSTANCES DO NOT SHARE IT. If the API ever runs more than one
 *      replica, a poll can land on an instance that never had the job. Same
 *      answer: unknown, not invented.
 *   3. IT IS NOT DURABLE EVIDENCE. The copy-out button (U-C5) exists because the
 *      operator must lift the result out of memory and into the phase report
 *      before anything restarts.
 *
 * ── No invented progress ────────────────────────────────────────────────────
 * There is no timer, no estimate and no interpolation anywhere in this file. A
 * step appears in `steps` only when the runner has actually produced it. `status`
 * moves to 'done' or 'failed' only when the runner's promise has settled. A poller
 * that sees four steps is looking at four measured results, not four guesses.
 */

import { runOpsE2E, type E2EReport, type E2EStep } from './ops-e2e';
import logger from '../lib/logger';

export type E2EJobStatus = 'running' | 'done' | 'failed';

export interface E2EJob {
  id: string;
  status: E2EJobStatus;
  /** Who started it — the verified founder email. Goes into the report. */
  actor: string;
  startedAt: string;
  finishedAt: string | null;
  /** How many publish loops this run was asked for. The gate is 5. */
  loops: number;
  /** Steps the runner has ACTUALLY produced so far. Never pre-filled. */
  steps: E2EStep[];
  /** Present only once the runner has returned. */
  report: E2EReport | null;
  /** Present only when the run threw. An honest sentence, not a stack trace. */
  error: string | null;
}

/** What a poller gets. Same shape whether the job is running or finished. */
export interface E2EJobView extends E2EJob {
  /** Seconds since start — measured, not estimated. */
  elapsedSec: number;
  /**
   * How many steps have landed. Deliberately NOT a percentage: nothing here knows
   * how many steps a run will produce (a blocked preflight produces two and stops),
   * so a percentage would be invented. See FEELING invariants — no invented progress.
   */
  stepsCompleted: number;
}

/**
 * The store. A plain Map, capped, oldest-evicted.
 *
 * The cap is not memory management — a handful of reports is nothing — it is a
 * guard against an unbounded map in a long-lived process. Finished jobs are
 * evicted before running ones, so a poll on an in-flight run cannot lose its view
 * because somebody started six more.
 */
const JOBS = new Map<string, E2EJob>();
const MAX_JOBS = 20;

function evictIfNeeded() {
  if (JOBS.size <= MAX_JOBS) return;
  const finished = [...JOBS.values()].filter((j) => j.status !== 'running');
  const victim = (finished[0] ?? [...JOBS.values()][0])!;
  JOBS.delete(victim.id);
}

/** Ids are for correlation, not secrecy — the route behind them is already gated. */
function newJobId(): string {
  return `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * True if a run is in flight. The console uses it to disable "E2E starten" with an
 * honest reason rather than offering a button that would start a second run
 * against the same production substrate.
 */
export function runningE2EJob(): E2EJob | null {
  return [...JOBS.values()].find((j) => j.status === 'running') ?? null;
}

/**
 * Start a run and return immediately. The promise is deliberately NOT awaited and
 * deliberately NOT returned: the caller is an HTTP handler that must answer in
 * milliseconds.
 */
export function startE2EJob(opts: { userId: string; actor: string; loops?: number }): E2EJob {
  const id = newJobId();
  const job: E2EJob = {
    id,
    status: 'running',
    actor: opts.actor,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    loops: Math.min(Math.max(opts.loops ?? 5, 1), 10),
    steps: [],
    report: null,
    error: null,
  };
  JOBS.set(id, job);
  evictIfNeeded();

  logger.warn({ jobId: id, actor: opts.actor, loops: job.loops }, 'ops_e2e_job_started');

  runOpsE2E({
    userId: opts.userId,
    actor: opts.actor,
    loops: job.loops,
    onStep: (step) => {
      job.steps.push(step);
    },
  })
    .then((report) => {
      job.report = report;
      // The RUNNER decides pass/fail. This wrapper does not re-judge it, and a
      // report that came back at all means the run completed — 'failed' here is
      // reserved for "the run threw", which is a different fact from "a step
      // failed" and must not be collapsed into it.
      job.status = 'done';
      job.finishedAt = new Date().toISOString();
      // The runner's own step list is authoritative: it includes anything the
      // observer missed, and its order is the order things actually happened.
      job.steps = report.steps;
      logger.warn({ jobId: id, passed: report.passed, numbers: report.numbers }, 'ops_e2e_job_finished');
    })
    .catch((err: unknown) => {
      job.status = 'failed';
      job.finishedAt = new Date().toISOString();
      job.error = (err as Error)?.message ?? 'Der Lauf wurde mit einem unbekannten Fehler abgebrochen.';
      logger.error({ jobId: id, reason: job.error }, 'ops_e2e_job_threw');
    });

  return job;
}

/**
 * Read a job. `null` means THIS PROCESS has never heard of that id — which is not
 * the same as "the run failed" and must not be rendered as one. See the header.
 */
export function getE2EJob(id: string): E2EJobView | null {
  const job = JOBS.get(id);
  if (!job) return null;
  const end = job.finishedAt ? Date.parse(job.finishedAt) : Date.now();
  return {
    ...job,
    // Copy, so a poller cannot mutate the live array mid-run.
    steps: [...job.steps],
    elapsedSec: Math.max(0, Math.round((end - Date.parse(job.startedAt)) / 1000)),
    stepsCompleted: job.steps.length,
  };
}

/** Test seam only — the process-lifetime map is otherwise never cleared. */
export function __clearE2EJobsForTest(): void {
  JOBS.clear();
}
