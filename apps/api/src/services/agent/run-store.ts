// FEEL-3a — agent_runs persistence (A1 data layer).
//
// One row per orchestrator run. Create at loop start (status 'running'), finalize
// at loop end with the fine-grained outcome + the execution log. Every write is
// pre-migration tolerant: the create uses only columns that exist since the
// initial schema (0001), and the finalize retries WITHOUT the 0081 columns
// (step_log, tools_used, iterations, outcome) when they are absent, so a pre-0081
// DB records the run's lifecycle (status/tokens/completed_at) and simply omits the
// richer log rather than dropping the row.

import { getSupabaseAdmin } from '../../lib/supabase';
import logger from '../../lib/logger';
import { scrubSecrets } from '../../lib/scrub-secrets';

/** Fine-grained terminal reason, orthogonal to agent_runs.status. */
export type RunOutcome = 'finished' | 'stopped' | 'budget' | 'error';

/** One entry in the run's execution log. `args` is a short summary, not the payload. */
export interface RunStep {
  tool: string;
  args: string;
  outcome: string;
  ms: number;
}

export interface CreateRunInput {
  userId: string;
  projectId: string;
  model: string;
  /** Must satisfy the agent_runs.source_tier CHECK: goblin_hosted | free_api | byok. */
  sourceTier?: 'goblin_hosted' | 'free_api' | 'byok' | null;
  /** F-40: the code session this run belongs to (0092) — the re-attach probe keys on it. */
  sessionId?: string | null;
}

/** F-40: a run the re-attach mount probe found still in flight for a session. */
export interface ActiveRun {
  runId: string;
  status: string;
  createdAt: string | null;
  /** U2 (0106): last emitted-frame timestamp, when the column exists and is set. */
  heartbeatAt: string | null;
}

export interface FinalizeRunInput {
  /** Truthful lifecycle: success = loop ended without a fatal error; failed = fatal error. */
  status: 'success' | 'failed';
  outcome: RunOutcome;
  inputTokens?: number;
  outputTokens?: number;
  steps: RunStep[];
  toolsUsed: string[];
  iterations: number;
  /**
   * A-6: the orchestrator's assembled report card (ReportCard). Persisted so the client
   * can re-fetch it after a stop/abort closed the SSE before the agent_report frame
   * landed. Optional + pre-migration tolerant (0088) — dropped from the update if the
   * column is absent, never dropping the run row.
   */
  report?: unknown;
}

/**
 * Insert a run row (status 'running'). Uses only 0001-era columns, so it never
 * needs migration tolerance. Returns the run id, or null if the insert failed
 * (the orchestrator still runs — it just loses the evidence row, logged here).
 */
export async function createAgentRun(input: CreateRunInput): Promise<string | null> {
  try {
    const sb = getSupabaseAdmin();
    const base = {
      user_id: input.userId,
      project_id: input.projectId,
      model_used: input.model,
      source_tier: input.sourceTier ?? null,
      status: 'running',
    };
    // F-40: write the session link (0092) so the re-attach probe can find this run.
    const { data, error } = await sb
      .from('agent_runs')
      .insert({ ...base, session_id: input.sessionId ?? null })
      .select('id')
      .single();
    if (error || !data) {
      // Pre-0092 tolerance: retry WITHOUT session_id when the column is absent, so a
      // run is still recorded (it simply offers no re-attach on a pre-migration DB).
      const { data: d2, error: e2 } = await sb
        .from('agent_runs')
        .insert(base)
        .select('id')
        .single();
      if (e2 || !d2) {
        logger.warn({ err: (error ?? e2)?.message }, 'agent_run_create_failed');
        return null;
      }
      return d2.id as string;
    }
    return data.id as string;
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'agent_run_create_failed');
    return null;
  }
}

// U2 (0106, phantom-session fix): once a run has ever emitted a frame, "still alive"
// means "emitted something recently" — this is far tighter than the old pure-age
// heuristic and is what actually distinguishes a live orchestrator loop (which emits
// at least once per iteration, well under a minute apart for every model observed in
// prod) from a process that died mid-run and will never emit again.
const HEARTBEAT_STALE_MS = 90_000;

// null = unprobed; true/false = the 0106 column is present/absent. Cached per process,
// same pattern as run-events.ts's tablePresent — a deploy re-probes.
let heartbeatColumnPresent: boolean | null = null;

function isMissingColumn(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === '42703' || /heartbeat_at/i.test(err.message ?? '');
}

/**
 * U2 (0106): touch this run's heartbeat. Called from run-registry.ts's single emit()
 * path, so every meta/narration/step/report/done/error frame counts as "alive". Best
 * effort + pre-migration tolerant (Gesetz 4): a missing column flips the cached probe
 * and no-ops thereafter — the run is never slowed or failed by this write.
 */
export async function touchRunHeartbeat(runId: string): Promise<void> {
  if (!runId || heartbeatColumnPresent === false) return;
  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb
      .from('agent_runs')
      .update({ heartbeat_at: new Date().toISOString() })
      .eq('id', runId);
    if (error) {
      if (isMissingColumn(error)) { heartbeatColumnPresent = false; return; }
      logger.warn({ err: error.message, runId }, 'agent_run_heartbeat_failed');
      return;
    }
    heartbeatColumnPresent = true;
  } catch (e) {
    logger.warn({ err: (e as Error).message, runId }, 'agent_run_heartbeat_threw');
  }
}

/**
 * U2 (0106): has this run gone quiet? Used by the cross-replica DB-poll branch of
 * streamRunEvents to stop waiting out the full max-runtime deadline in silence. Returns
 * false (never claim staleness) on a pre-0106 DB or any error — the caller's existing
 * runtime-ceiling poll remains the only backstop until the migration is applied.
 */
export async function isRunHeartbeatStale(runId: string): Promise<boolean> {
  if (heartbeatColumnPresent === false) return false;
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('agent_runs')
      .select('heartbeat_at, status')
      .eq('id', runId)
      .maybeSingle();
    if (error) {
      if (isMissingColumn(error)) { heartbeatColumnPresent = false; }
      return false;
    }
    heartbeatColumnPresent = true;
    if (!data || data.status !== 'running') return false; // already terminal — not this check's job
    const hb = data.heartbeat_at as string | null;
    if (!hb) return false; // no heartbeat yet written (e.g. mid-first-iteration) — don't guess
    const age = Date.now() - new Date(hb).getTime();
    return Number.isFinite(age) && age > HEARTBEAT_STALE_MS;
  } catch (e) {
    logger.warn({ err: (e as Error).message, runId }, 'agent_run_heartbeat_check_threw');
    return false;
  }
}

/**
 * F-40 re-attach probe: the newest still-running run for a (session, user). Survives a
 * process restart / a different replica because it reads the DB, not the in-memory
 * registry. U2 (0106): prefers heartbeat recency over raw age when the column is
 * populated — a run is only offered while it has emitted something in the last
 * HEARTBEAT_STALE_MS. Falls back to the OLD `staleAfterMs`-since-created heuristic when
 * heartbeat_at is absent/null (pre-migration DB, or a run that predates this column) —
 * an honest degrade to the previous behaviour, not a new failure mode. Returns null on a
 * pre-0092 DB (no session_id column) or any error.
 */
export async function findActiveRun(
  sessionId: string,
  userId: string,
  staleAfterMs: number,
): Promise<ActiveRun | null> {
  try {
    const sb = getSupabaseAdmin();
    type Row = { id: string; status: string; created_at: string | null; heartbeat_at?: string | null };
    let heartbeatAt: string | null = null;
    let data: Row | null = null;
    const full = await sb
      .from('agent_runs')
      .select('id, status, created_at, heartbeat_at')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .eq('status', 'running')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (full.error && isMissingColumn(full.error)) {
      heartbeatColumnPresent = false;
      const fallback = await sb
        .from('agent_runs')
        .select('id, status, created_at')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .eq('status', 'running')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fallback.error || !fallback.data) return null;
      data = fallback.data as Row;
    } else if (full.error || !full.data) {
      return null;
    } else {
      heartbeatColumnPresent = true;
      data = full.data as Row;
      heartbeatAt = data.heartbeat_at ?? null;
    }
    if (!data) return null;
    const createdAt = (data.created_at as string | null) ?? null;
    if (heartbeatAt) {
      const age = Date.now() - new Date(heartbeatAt).getTime();
      if (Number.isFinite(age) && age > HEARTBEAT_STALE_MS) return null; // zombie — verified quiet
    } else if (createdAt) {
      // No heartbeat recorded yet (pre-0106 row, or genuinely no frame emitted since
      // upgrade) — the only honest signal left is age, same as before this migration.
      const age = Date.now() - new Date(createdAt).getTime();
      if (Number.isFinite(age) && age > staleAfterMs) return null; // zombie — do not offer
    }
    return { runId: data.id as string, status: data.status as string, createdAt, heartbeatAt };
  } catch (e) {
    logger.warn({ err: (e as Error).message, sessionId }, 'agent_run_find_active_failed');
    return null;
  }
}

/**
 * Finalize a run. Writes the 0081 log columns (step_log/tools_used/iterations/
 * outcome) alongside the lifecycle fields; on a missing-column error retries with
 * the bare lifecycle update so a pre-0081 DB still records status/tokens/completed.
 * Never throws.
 */
export async function finalizeAgentRun(runId: string, input: FinalizeRunInput): Promise<void> {
  if (!runId) return;
  const base = {
    status: input.status,
    input_tokens: input.inputTokens ?? null,
    output_tokens: input.outputTokens ?? null,
    completed_at: new Date().toISOString(),
  };
  try {
    const sb = getSupabaseAdmin();
    // D-3: scrub the run log + report before persisting. A tool error message or the
    // model's own text (both flow verbatim into step_log/report) could echo an upstream
    // API key — this pass guarantees no secret lands in the agent_runs row.
    const steps = scrubSecrets(input.steps);
    const report = input.report !== undefined ? scrubSecrets(input.report) : undefined;
    // Richest write: 0081 log columns + the 0088 report card.
    const full = {
      ...base,
      outcome: input.outcome,
      iterations: input.iterations,
      tools_used: input.toolsUsed,
      step_log: steps,
      ...(report !== undefined ? { report } : {}),
    };
    const { error } = await sb.from('agent_runs').update(full).eq('id', runId);
    if (error) {
      // Retry WITHOUT the 0088 report column (pre-0088 DB) but keep the 0081 log.
      const { error: e2 } = await sb
        .from('agent_runs')
        .update({ ...base, outcome: input.outcome, iterations: input.iterations, tools_used: input.toolsUsed, step_log: steps })
        .eq('id', runId);
      // Last resort: bare lifecycle (pre-0081 DB).
      if (e2) await sb.from('agent_runs').update(base).eq('id', runId);
    }
  } catch (e) {
    logger.warn({ err: (e as Error).message, runId }, 'agent_run_finalize_failed');
  }
}

/** Test seam — reset the cached heartbeat-column probe between unit tests, same
 *  pattern as run-events.ts's __resetRunEventsProbe(). */
export function __resetHeartbeatProbe(): void {
  heartbeatColumnPresent = null;
}
