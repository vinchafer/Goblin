import { getSupabaseAdmin } from './supabase';
import { calculateCost } from './model-pricing';
import logger from './logger';

interface TrackParams {
  userId: string;
  chatSessionId?: string | null;
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
  try {
    const sb = getSupabaseAdmin();
    await sb.from('completion_costs').insert({
      user_id: params.userId,
      chat_session_id: params.chatSessionId ?? null,
      provider: params.provider,
      model: params.model,
      source_tier: params.sourceTier ?? null,
      tokens_in: params.tokensIn,
      tokens_out: params.tokensOut,
      cost_usd: cost,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message, ...params }, 'trackCompletion failed');
  }
}
