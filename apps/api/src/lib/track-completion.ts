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
    // I0: write project_id when the column exists (migration 0077). Pre-migration
    // tolerant — a missing column errors the insert, so we retry WITHOUT project_id
    // rather than dropping the cost row entirely (accounting must never silently
    // lose a completion because an instrumentation column is not yet applied).
    const { error } = await sb.from('completion_costs').insert({ ...baseRow, project_id: params.projectId ?? null });
    if (error) {
      await sb.from('completion_costs').insert(baseRow);
    }
  } catch (e) {
    logger.error({ error: (e as Error).message, ...params }, 'trackCompletion failed');
  }
}
