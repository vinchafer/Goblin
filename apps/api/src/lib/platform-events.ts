import { getSupabaseAdmin } from './supabase';
import logger from './logger';

/**
 * Internal-accounting events (I0 / migration 0078) + the canonical BEHAVIOUR
 * funnel and product signals (I1 / migration 0085 — the CHECK on event_type was
 * dropped there so these persist; before it is applied every non-0078 insert
 * silent-fails into a no-op and measurement simply defers).
 *
 * PRIVACY LAW (WAVE-I): every event carries METADATA ONLY — which function,
 * when — never message content, never file contents, never generated code. The
 * `meta` payload is audited for this (platform-events.test.ts). Events are
 * personal data: they join the account-deletion purge (account-deletion.ts).
 */
export type PlatformEventType =
  // — internal accounting (0078) —
  | 'platform_cogs'
  | 'context_retry'
  // — canonical funnel (first-per-user timestamp defines each stage) —
  //   signup is derived from users.created_at, not emitted here.
  | 'onboarding_completed'
  | 'project_created'
  | 'message_sent'
  // agent_run_started is the twin of agent_run_finished: emitted the instant a
  // run begins, so Pulse can show started-vs-finished (a run that starts but
  // never finishes is a crash/abandon signal the finished-only count hides).
  | 'agent_run_started'
  | 'agent_run_finished'
  | 'publish_verified'
  | 'publish_failed'
  | 'upgrade_clicked'
  | 'upgraded'
  // — actives / product signals —
  | 'login'
  | 'trial_card_shown'
  | 'trial_card_clicked'
  | 'feedback_submitted'
  | 'help_opened'
  // F-43: a chat send routed through the real web-search service (the "Websuche"
  // toggle). Metadata only — ran/results/reason/source, never the query text.
  | 'chat_web_search'
  // — Wave-J-ready: emitted only once those surfaces exist —
  | 'support_chat_started'
  | 'support_chat_escalated'
  // — Wave-K safety layers (metadata only: rule-ids, policy areas, counts — never
  //   file contents or generated code) —
  //   K3: a publish blocked by the deterministic scan (high-confidence hit).
  | 'publish_blocked'
  //   K4: a cheap behavioral flag (velocity / content fan-out / repeated refusals).
  //   Flags INFORM — they never auto-punish; account actions stay founder decisions.
  | 'abuse_signal';

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
 * Persist a platform event (internal accounting or a behaviour-funnel signal).
 *
 * Silent-fail by contract: NEVER throws and NEVER alters or slows request flow.
 * When the `platform_events` table / constraint shape is older than the caller
 * expects (a migration not yet applied), the insert errors and we no-op — the
 * caller's existing log line remains the fallback and measurability is deferred.
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
    // Pre-migration (table/constraint older) or RLS hiccup — degrade to no-op.
    if (error) {
      logger.debug({ error: error.message, eventType: event.eventType }, 'platform_events insert skipped (migration pending?)');
    }
  } catch (e) {
    logger.debug({ error: (e as Error).message, eventType: event.eventType }, 'platform_events insert failed');
  }
}

/**
 * Fire-and-forget funnel/behaviour emit. Returns void immediately; the insert
 * runs detached and can never reject into the caller (the promise is swallowed).
 * Use at truth-gates in request handlers where awaiting would add latency to a
 * user flow. (Internal-accounting producers that already await — the summarizer,
 * the context-retry path — keep using insertPlatformEvent directly.)
 */
export function trackEvent(event: PlatformEvent): void {
  // Intentionally not awaited. insertPlatformEvent never throws, but guard the
  // synchronous-throw edge (e.g. getSupabaseAdmin misconfig) so a fire-and-forget
  // call site can never surface an unhandled rejection.
  void insertPlatformEvent(event).catch(() => {});
}
