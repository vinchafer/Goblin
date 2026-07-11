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
    const { data, error } = await sb
      .from('agent_runs')
      .insert({
        user_id: input.userId,
        project_id: input.projectId,
        model_used: input.model,
        source_tier: input.sourceTier ?? null,
        status: 'running',
      })
      .select('id')
      .single();
    if (error || !data) {
      logger.warn({ err: error?.message }, 'agent_run_create_failed');
      return null;
    }
    return data.id as string;
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'agent_run_create_failed');
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
