// F-40 (resumable runs) — the process-level run registry (U2 core).
//
// The gap the SPIKE named (DIAGNOSIS Part B): an agent run is coupled to the HTTP request
// (code-sessions.ts:676 passed stopSignal = c.req.raw.signal), so a client disconnect both
// STOPS the run and loses the view of it. This registry decouples the two:
//
//   • the RUN lives here, detached from any request, with its OWN AbortController — the
//     STOP signal, architecturally distinct from the request/disconnect signal;
//   • a client disconnect only DETACHES that request's subscriber; the run continues;
//   • an explicit user Stop aborts the controller (reason 'user_stop');
//   • a max-runtime guard aborts it (reason 'max_runtime') so an abandoned run can't burn
//     tokens forever (the three signals — disconnect, stop, timeout — are all distinct);
//   • every emitted event flows through ONE path: assign seq → in-memory ring → durable
//     event log (0091) → fan out to live subscribers. That single path is what the starting
//     request AND every re-attach stream read (streamRunEvents), so there is no second live
//     mechanism (the F-29 parallel-plumbing anti-pattern).
//
// Long-running server assumption (apps/api/railway.json → Railway, node dist/index.js): the
// process outlives the request, so "continue after disconnect" is real. Cross-replica /
// post-restart re-attach degrades to a DB-log poll (see streamRunEvents) — the event log is
// the source of truth in that case.

import logger from '../../lib/logger';
import { agentMaxRuntimeMs, MAX_RUNTIME_ABORT_REASON, USER_STOP_ABORT_REASON } from './config';
import { appendRunEvent, loadRunEvents, type RunEvent, type RunEventType } from './run-events';

/** A frame emitted into a run's log/stream: a type + an arbitrary metadata body. */
export interface EmitFrame {
  type: RunEventType;
  [key: string]: unknown;
}

/** What the registry hands the run's completion callback so it can decide the push, etc. */
export interface CompletionMeta {
  /** True if at least one client was attached when the run reached a terminal state. */
  hadSubscriber: boolean;
  /** True if the max-runtime guard (not the user, not a normal finish) ended the run. */
  timedOut: boolean;
}

export interface StartRunInput<R> {
  runId: string;
  userId: string;
  projectId: string;
  sessionId: string;
  /** Runs the actual work (runAgent). Receives the run's emit + its OWN stop signal. */
  execute: (ctx: { emit: (frame: EmitFrame) => void; stopSignal: AbortSignal }) => Promise<R>;
  /** Finalize + persist + (if unattached) push. Called once on normal completion. */
  onComplete: (result: R, meta: CompletionMeta) => Promise<void> | void;
  /** Called once on a fatal execute() throw (still persists + may push). */
  onError: (err: unknown, meta: CompletionMeta) => Promise<void> | void;
  /** The model slug for the leading meta frame (client shows the label). */
  modelSlug?: string | null;
}

interface RunHandle {
  runId: string;
  userId: string;
  projectId: string;
  sessionId: string;
  controller: AbortController;
  /** In-memory ring: the full ordered event list (capped) for same-process replay. */
  events: RunEvent[];
  seq: number;
  subscribers: Set<(ev: RunEvent) => void>;
  terminal: boolean;
  timedOut: boolean;
  startedAt: number;
  timer: ReturnType<typeof setTimeout> | null;
}

/** Terminal frames close a stream: 'done' (any non-fatal landing) or 'error' (fatal). */
function isTerminalType(t: RunEventType): boolean {
  return t === 'done' || t === 'error';
}

// Cap the in-memory ring so a pathological run can't grow memory unbounded. The DB log
// (0091) is the complete record; the ring is just the fast same-process replay buffer.
const MAX_RING = 5000;
// Keep a finished run's handle around briefly so an immediate re-attach still hits the
// ring (and its live subscriber flush) before falling back to the DB log.
const EVICT_GRACE_MS = 120_000;
// DB-poll cadence for the cross-replica / post-restart tail (no in-process handle).
const POLL_INTERVAL_MS = 1_000;

const runs = new Map<string, RunHandle>();

/** Test/ops visibility: is this run live in THIS process right now? */
export function isRunLocal(runId: string): boolean {
  return runs.has(runId);
}

/**
 * WAVE-H (H1/H5) — read-only observability snapshot of the live-run map. `inFlight`
 * counts non-terminal runs (the ones actually holding a slot); `totalRuns` includes
 * terminal-but-not-yet-evicted handles; `totalSubscribers` is the sum of attached SSE
 * sinks (a leak canary — it must return to 0 after every run drains). `perUser` maps a
 * user id to their non-terminal run count (the per-user concurrency the H4 cap bounds).
 * Pure read — no mutation, so calling it can never perturb a run.
 */
export function admissionSnapshot(): {
  inFlight: number;
  totalRuns: number;
  totalSubscribers: number;
  perUser: Record<string, number>;
} {
  let inFlight = 0;
  let totalSubscribers = 0;
  const perUser: Record<string, number> = {};
  for (const h of runs.values()) {
    totalSubscribers += h.subscribers.size;
    if (!h.terminal) {
      inFlight += 1;
      perUser[h.userId] = (perUser[h.userId] ?? 0) + 1;
    }
  }
  return { inFlight, totalRuns: runs.size, totalSubscribers, perUser };
}

/**
 * Start a run detached from any request. Idempotent per runId: if a live handle already
 * exists (e.g. a duplicate POST), the existing one is returned and no second execution
 * starts. Returns immediately — the work runs in the background.
 */
export function startRun<R>(input: StartRunInput<R>): void {
  if (runs.has(input.runId)) {
    logger.warn({ runId: input.runId }, 'agent_run_already_running');
    return;
  }

  const controller = new AbortController();
  const handle: RunHandle = {
    runId: input.runId,
    userId: input.userId,
    projectId: input.projectId,
    sessionId: input.sessionId,
    controller,
    events: [],
    seq: 0,
    subscribers: new Set(),
    terminal: false,
    timedOut: false,
    startedAt: Date.now(),
    timer: null,
  };
  runs.set(input.runId, handle);

  // The one emit path: seq → ring → durable log → live fan-out. Synchronous ring + fan-out
  // (so a stream that subscribed-then-snapshotted never races an interleaved emit); the DB
  // append is fire-and-forget best-effort (a log write must never stall or kill the run).
  const emit = (frame: EmitFrame): void => {
    handle.seq += 1;
    const { type, ...payload } = frame;
    const ev: RunEvent = { seq: handle.seq, type, payload: payload as Record<string, unknown> };
    handle.events.push(ev);
    if (handle.events.length > MAX_RING) handle.events.shift();
    void appendRunEvent({
      runId: handle.runId,
      userId: handle.userId,
      projectId: handle.projectId,
      seq: ev.seq,
      type: ev.type,
      payload: ev.payload,
    });
    for (const sub of handle.subscribers) {
      try { sub(ev); } catch { /* a broken sink must not break the run or other sinks */ }
    }
  };

  // The max-runtime guard (F-40 orphan protection): distinct abort reason so the
  // orchestrator lands an honest "Zeitlimit erreicht" report rather than a user "gestoppt".
  handle.timer = setTimeout(() => {
    handle.timedOut = true;
    if (!controller.signal.aborted) controller.abort(MAX_RUNTIME_ABORT_REASON);
  }, agentMaxRuntimeMs());
  // Node keeps the event loop alive for pending timers; this one shouldn't hold the process
  // open on its own.
  handle.timer.unref?.();

  // The leading meta frame (run id + model label) — the first event every attach replays.
  emit({ type: 'meta', run_id: input.runId, model_slug: input.modelSlug ?? null });

  // Detached execution — NOT awaited by the caller (the request).
  void (async () => {
    let result: R | undefined;
    let threw: unknown;
    try {
      result = await input.execute({ emit, stopSignal: controller.signal });
    } catch (err) {
      threw = err;
    }

    // Capture attach state at the moment of completion for the push decision (U5).
    const meta: CompletionMeta = { hadSubscriber: handle.subscribers.size > 0, timedOut: handle.timedOut };

    try {
      if (threw !== undefined) {
        await input.onError(threw, meta);
      } else {
        await input.onComplete(result as R, meta);
      }
    } catch (cbErr) {
      logger.warn({ err: (cbErr as Error).message, runId: input.runId }, 'agent_run_completion_callback_failed');
    }

    // The terminal frame closes every attached (and future replayed) stream. onComplete/
    // onError may have emitted the agent_report frame already; 'done'/'error' is the seal.
    if (threw !== undefined) {
      emit({ type: 'error', run_id: input.runId, message: 'Agent-Lauf fehlgeschlagen' });
    } else {
      emit({ type: 'done', run_id: input.runId });
    }

    handle.terminal = true;
    if (handle.timer) { clearTimeout(handle.timer); handle.timer = null; }
    // Evict after a grace window; the DB log remains the durable record for later re-attach.
    setTimeout(() => { runs.delete(input.runId); }, EVICT_GRACE_MS).unref?.();
  })();
}

/**
 * Explicit user Stop (F-23 semantics): abort THIS run's controller with the user-stop
 * reason. Distinct from a disconnect (which never touches the controller). No-op if the
 * run isn't local to this process (a cross-replica stop would need a DB signal — out of
 * scope; the max-runtime guard still bounds such a run). Returns whether a live run was hit.
 */
export function stopRun(runId: string, userId: string): boolean {
  const handle = runs.get(runId);
  if (!handle || handle.userId !== userId) return false;
  if (!handle.controller.signal.aborted) handle.controller.abort(USER_STOP_ABORT_REASON);
  return true;
}

/**
 * Stream a run's events to `sink`: replay everything after `sinceSeq`, then live-tail until
 * a terminal frame (or the client disconnects via `opts.signal`). ONE consumer path for both
 * the starting request and every re-attach:
 *   • run local to this process → subscribe to the in-process bus + replay the ring;
 *   • not local (cross-replica / post-restart) but still in the DB → replay the event log
 *     then poll it for new rows until a terminal frame.
 * Delivery is serialized through an internal queue so SSE writes never interleave, and
 * deduped by a monotonic seq cursor so the ring/bus overlap never double-delivers.
 */
export async function streamRunEvents(
  runId: string,
  userId: string,
  sinceSeq: number,
  sink: (ev: RunEvent) => Promise<void> | void,
  opts?: { signal?: AbortSignal },
): Promise<void> {
  const handle = runs.get(runId);
  const clientSignal = opts?.signal;

  const queue: RunEvent[] = [];
  let lastEnqueued = sinceSeq;
  let terminalSeen = false;
  let wake: (() => void) | null = null;
  let closed = false;

  const enqueue = (ev: RunEvent): void => {
    if (ev.seq <= lastEnqueued) return; // monotonic dedup across ring/bus/poll overlap
    lastEnqueued = ev.seq;
    queue.push(ev);
    if (isTerminalType(ev.type)) terminalSeen = true;
    wake?.();
  };

  const onDisconnect = (): void => { closed = true; wake?.(); };
  clientSignal?.addEventListener('abort', onDisconnect);

  // --- Producer wiring ---------------------------------------------------------------
  let busSub: ((ev: RunEvent) => void) | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  if (handle && (handle.userId === userId)) {
    // Local run: subscribe FIRST (no await between subscribe and snapshot → no missed emit),
    // then replay the ring snapshot. Overlap is deduped by seq.
    busSub = (ev) => enqueue(ev);
    handle.subscribers.add(busSub);
    for (const ev of handle.events) enqueue(ev);
    if (handle.terminal) terminalSeen = terminalSeen || handle.events.some((e) => isTerminalType(e.type));
  } else {
    // Not local: durable-log replay, then poll for the live tail until a terminal frame.
    const initial = await loadRunEvents(runId, userId, sinceSeq);
    for (const ev of initial) enqueue(ev);
    if (!terminalSeen) {
      // Bounded safety: even if the run died on another replica without writing a terminal
      // frame, stop polling well after the max runtime so a stream can't hang forever.
      const deadline = Date.now() + agentMaxRuntimeMs() + 30_000;
      const poll = async (): Promise<void> => {
        if (closed || terminalSeen) return;
        if (Date.now() > deadline) { closed = true; wake?.(); return; }
        const fresh = await loadRunEvents(runId, userId, lastEnqueued);
        for (const ev of fresh) enqueue(ev);
        if (!terminalSeen && !closed) { pollTimer = setTimeout(() => void poll(), POLL_INTERVAL_MS); pollTimer.unref?.(); }
      };
      pollTimer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
      pollTimer.unref?.();
    }
  }

  // --- Consumer loop (serialized delivery) -------------------------------------------
  try {
    while (!closed) {
      if (queue.length === 0) {
        if (terminalSeen) break; // delivered everything up to and including the terminal frame
        await new Promise<void>((resolve) => { wake = resolve; });
        wake = null;
        continue;
      }
      const ev = queue.shift()!;
      await sink(ev);
      if (isTerminalType(ev.type)) break;
    }
  } finally {
    closed = true;
    clientSignal?.removeEventListener('abort', onDisconnect);
    if (handle && busSub) handle.subscribers.delete(busSub);
    if (pollTimer) clearTimeout(pollTimer);
  }
}

/** Test seam — clear the process-level run map between unit tests. */
export function __resetRunRegistry(): void {
  for (const h of runs.values()) { if (h.timer) clearTimeout(h.timer); }
  runs.clear();
}
