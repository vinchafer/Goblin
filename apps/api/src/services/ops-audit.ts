/**
 * AKT 2 · PHASE 2 · U2.5 — the operator audit trail.
 *
 * Every suspend, unsuspend and teardown writes a row here: who, what, why, when.
 * ABUSE_RESPONSE §8.7 asks for exactly that, and §8.5 (Widerspruch) is unanswerable
 * without it — "war die Sperre falsch?" needs a record of what the sperre was.
 *
 * ── The honesty rule this file exists to keep ────────────────────────────────
 * Migration 0100 is AUTHORED, NOT APPLIED. Between merge and the founder running
 * it, this table does not exist. Two wrong answers were available and both are
 * refused:
 *   • throwing — an operator must be able to suspend a phishing app at 3am on a
 *     database that is one migration behind. The emergency stop does not get to
 *     depend on a migration.
 *   • pretending — returning success and writing nothing would mean the response
 *     says "audit written" while there is no evidence anywhere.
 * So the write REPORTS ITS OWN OUTCOME ('written' | 'unavailable' | 'failed'), the
 * caller passes that outcome through to the operator verbatim, and the action is
 * always also written to the application log, which does not need a migration.
 */

import { getSupabaseAdmin } from '../lib/supabase';
import logger from '../lib/logger';

type Sb = ReturnType<typeof getSupabaseAdmin>;

/**
 * The operator actions recorded here. Free text in the DB — see 0100, which
 * deliberately has no CHECK so a later phase can add one without a migration.
 *
 * PHASE 3 adds the two review-queue decisions. They are a slightly different
 * SHAPE of row and the difference is worth knowing when reading the trail: a
 * suspend acts on a published app, so `app_id`/`app_name` are that app's. A review
 * decision acts on a CANDIDATE that was never published and has no app id at all,
 * so those columns carry the review-queue row's id and the name that was
 * requested, and `meta.subject` says `review_queue_item` so nobody mistakes the
 * id for an `ops_apps.app_id`. On an approve that then publishes, the app's own id
 * lands in `meta.published_app_id`.
 */
export type OpsAuditAction =
  | 'suspend' | 'unsuspend' | 'teardown' | 'orphan_purge'
  | 'review_approve' | 'review_block'
  // X1: the same physical teardown, but triggered by the BUILDER deleting their
  // project rather than by an operator taking an app down. A separate action string
  // because the two read completely differently in an appeal — "we removed your app"
  // and "you removed your app" must never be confused — and because `actor` is the
  // builder's own id here, not a founder email.
  | 'project_delete_teardown';

/** Did the evidence actually land? Never collapsed into a boolean. */
export type OpsAuditOutcome = 'written' | 'unavailable' | 'failed';

export interface OpsAuditEntry {
  appId: string;
  appName: string;
  userId?: string | null;
  action: OpsAuditAction;
  /** A human: the founder's email, or 'system'. Never a token or a session id. */
  actor: string;
  /** The founder's own words. Never a code. */
  reason?: string | null;
  /** Metadata only — step outcomes, counts, orphan check. Never user content. */
  meta?: Record<string, unknown>;
}

/**
 * True if migration 0100 has been applied. Probed per call, never cached: a cached
 * `false` would keep audit writes dark for the life of the process after the
 * founder applies the migration — the same stale-state lie ops-apps-store refuses.
 */
export async function opsAuditTableAvailable(sb: Sb = getSupabaseAdmin()): Promise<boolean> {
  const { error } = await sb.from('ops_app_audit').select('id').limit(1);
  if (!error) return true;
  const signature = `${error.code ?? ''} ${error.message ?? ''}`;
  if (/42P01|PGRST205|does not exist|schema cache/i.test(signature)) return false;
  // Any other error means the table DOES exist and something else went wrong.
  return true;
}

/**
 * Record an operator action. Never throws — a failed audit write must not be the
 * reason a takedown does not happen.
 *
 * The log line is written FIRST and unconditionally, so the evidence exists even
 * when the table does not and even if the insert then fails.
 */
export async function writeOpsAudit(entry: OpsAuditEntry, sb: Sb = getSupabaseAdmin()): Promise<OpsAuditOutcome> {
  logger.warn(
    {
      appId: entry.appId,
      appName: entry.appName,
      action: entry.action,
      actor: entry.actor,
      reason: entry.reason ?? null,
      meta: entry.meta ?? {},
    },
    `ops_audit:${entry.action}`,
  );

  try {
    if (!(await opsAuditTableAvailable(sb))) {
      logger.warn({ appId: entry.appId, action: entry.action }, 'ops_audit_table_absent (pre-0100) — action logged only');
      return 'unavailable';
    }
    const { error } = await sb.from('ops_app_audit').insert({
      app_id: entry.appId,
      app_name: entry.appName,
      user_id: entry.userId ?? null,
      action: entry.action,
      actor: entry.actor,
      reason: entry.reason ?? null,
      meta: entry.meta ?? {},
    });
    if (error) {
      logger.error({ appId: entry.appId, action: entry.action, reason: error.message }, 'ops_audit_write_failed');
      return 'failed';
    }
    return 'written';
  } catch (err) {
    logger.error({ appId: entry.appId, reason: (err as Error)?.message }, 'ops_audit_write_threw');
    return 'failed';
  }
}

/** An app's history — what §8.5 (Widerspruch) reads to answer "what did we do?". */
export async function readOpsAudit(appId: string, sb: Sb = getSupabaseAdmin()) {
  if (!(await opsAuditTableAvailable(sb))) return [];
  const { data, error } = await sb
    .from('ops_app_audit')
    .select('id, app_id, app_name, action, actor, reason, meta, created_at')
    .eq('app_id', appId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    logger.warn({ appId, reason: error.message }, 'ops_audit_read_failed');
    return [];
  }
  return data ?? [];
}
