import { getSupabaseAdmin } from './supabase';
import logger from './logger';

export type PlatformEventType = 'platform_cogs' | 'context_retry';

export interface PlatformEvent {
  eventType: PlatformEventType;
  userId?: string | null;
  projectId?: string | null;
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  meta?: Record<string, unknown>;
}

/**
 * I0 (MOBILE-1 telemetry pre-unit): persist a platform-internal event
 * (platform COGS or a reduced-context retry) so A20/B2 are measurable from the
 * DB instead of only ephemeral Railway logs.
 *
 * Silent-fail by contract: NEVER throws and NEVER alters request flow. When the
 * `platform_events` table is absent (migration 0078 not yet applied) the insert
 * errors and we no-op — the caller's existing log line remains the fallback.
 */
export async function insertPlatformEvent(event: PlatformEvent): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb.from('platform_events').insert({
      event_type: event.eventType,
      user_id: event.userId ?? null,
      project_id: event.projectId ?? null,
      model: event.model ?? null,
      tokens_in: event.tokensIn ?? null,
      tokens_out: event.tokensOut ?? null,
      meta: event.meta ?? {},
    });
    // Pre-migration (table missing) or RLS hiccup — degrade to no-op; the
    // caller already logged the event, so measurability is only deferred.
    if (error) {
      logger.debug({ error: error.message, eventType: event.eventType }, 'platform_events insert skipped (table absent?)');
    }
  } catch (e) {
    logger.debug({ error: (e as Error).message, eventType: event.eventType }, 'platform_events insert failed');
  }
}
