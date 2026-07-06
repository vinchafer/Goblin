import { getSupabaseAdmin } from './supabase';
import { calculateCost } from './model-pricing';
import logger from './logger';

interface TrackParams {
  userId: string;
  chatSessionId?: string | null;
  // I0: project attribution written directly (migration 0077). NULL = standalone
  // chat. Covers the legacy project route (chat.ts) too, which has no session row
  // and so cannot be attributed via chat_session_id (telemetry NOTES gap #1).
  projectId?: string | null;
  provider: string;
  model: string;
  sourceTier?: string | null;
  tokensIn: number;
  tokensOut: number;
  // P1.8: speed measurement (migration 0080). ttftMs = time to first token,
  // durationMs = total generation wall time, both in ms. Optional — non-streaming
  // / BYOK callers where ttft isn't meaningful leave them undefined (→ NULL).
  ttftMs?: number;
  durationMs?: number;
}

/**
 * Records per-completion cost + token usage. Never throws — failures only logged.
 * Called from streaming completion path after a successful `done` event.
 */
export async function trackCompletion(params: TrackParams): Promise<void> {
  const cost = calculateCost(params.model, params.tokensIn, params.tokensOut);
  const baseRow = {
    user_id: params.userId,
    chat_session_id: params.chatSessionId ?? null,
    provider: params.provider,
    model: params.model,
    source_tier: params.sourceTier ?? null,
    tokens_in: params.tokensIn,
    tokens_out: params.tokensOut,
    cost_usd: cost,
  };
  try {
    const sb = getSupabaseAdmin();
    // Write the optional instrumentation columns (project_id — migration 0077;
    // ttft_ms/duration_ms — migration 0080) when they exist. Pre-migration
    // tolerant: a missing column errors the insert, so we retry with the bare
    // baseRow (dropping ALL of project_id + the timing fields) rather than losing
    // the cost row entirely — accounting must never silently drop a completion
    // because an instrumentation column is not yet applied. The retry degrades
    // gracefully whether the missing column is project_id (pre-0077) or the timing
    // fields (pre-0080).
    const { error } = await sb.from('completion_costs').insert({
      ...baseRow,
      project_id: params.projectId ?? null,
      ttft_ms: params.ttftMs ?? null,
      duration_ms: params.durationMs ?? null,
    });
    if (error) {
      await sb.from('completion_costs').insert(baseRow);
    }
  } catch (e) {
    logger.error({ error: (e as Error).message, ...params }, 'trackCompletion failed');
  }
}
