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

/**
 * F-40 re-attach probe: the newest still-running run for a (session, user). Survives a
 * process restart / a different replica because it reads the DB, not the in-memory
 * registry. A run older than `staleAfterMs` is treated as a zombie (a process that died
 * mid-run leaves status='running' forever — DIAGNOSIS B.2) and is NOT offered for
 * re-attach. Returns null on a pre-0092 DB (no session_id column) or any error.
 */
export async function findActiveRun(
  sessionId: string,
  userId: string,
  staleAfterMs: number,
): Promise<ActiveRun | null> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('agent_runs')
      .select('id, status, created_at')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .eq('status', 'running')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const createdAt = (data.created_at as string | null) ?? null;
    if (createdAt) {
      const age = Date.now() - new Date(createdAt).getTime();
      if (Number.isFinite(age) && age > staleAfterMs) return null; // zombie — do not offer
    }
    return { runId: data.id as string, status: data.status as string, createdAt };
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
