/**
 * AKT 2 · PHASE 3 · U3.2 — pre-migration-tolerant access to `ops_review_queue`.
 *
 * Migration 0102 is AUTHORED, NOT APPLIED. Between merge and the founder running
 * it the table does not exist, and nothing here may throw because of that. The
 * same feature-detect probe as `ops-apps-store.ts` (0099) and `ops-audit.ts` (0100).
 *
 * ── The one place this file differs from the audit writer, and why ───────────
 * `writeOpsAudit` degrades to 'unavailable' and the ACTION STILL HAPPENS: an
 * operator must be able to suspend a phishing app at 3am on a database one
 * migration behind, and losing the evidence row is the lesser harm.
 *
 * Here the calculus inverts. A held publish with no queue row is a publish that
 * disappears: the builder was told a human would look, and there is nothing for
 * any human to look AT. So `enqueueReview` reports its own failure honestly and
 * the publish path changes what it says to the builder — "try again later" rather
 * than "someone will get to it". Nothing is uploaded either way; what differs is
 * only whether we make a promise we cannot keep.
 */

import { getSupabaseAdmin } from '../lib/supabase';
import logger from '../lib/logger';
import { isMissingSchema } from '../lib/schema-shape';
import type { AupCategory, ClassifierReason } from './safety/abuse-classifier';

type Sb = ReturnType<typeof getSupabaseAdmin>;

/**
 * FOUNDER-WALK-6 · U3 (F3) — `approved_publish_failed` is a fourth, TERMINAL
 * status: a human said yes (that fact is never revisited), the publish
 * attempt that followed did not reach live, and the row stays visible —
 * see `listNeedsAttentionReviews` — until a retry succeeds or an operator
 * decides otherwise. It is reached ONLY from `approved` (`markPublishFailed`)
 * and leaves ONLY back to `approved` (`markPublishRecovered`, on a successful
 * retry) — never to `pending`, which would misrepresent that no decision was
 * made.
 */
export type ReviewStatus = 'pending' | 'approved' | 'blocked' | 'approved_publish_failed';

/** One held publish, as the API reads it. */
export interface ReviewItem {
  id: string;
  userId: string;
  projectId: string | null;
  requestedName: string;
  status: ReviewStatus;
  stage1Verdict: string;
  stage1RuleIds: string[];
  stage2Verdict: string;
  stage2Reason: ClassifierReason;
  categories: AupCategory[];
  stage2Confidence: string | null;
  scannedFiles: number | null;
  scannedBytes: number | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  /** Set only when status is `approved_publish_failed` — the last publish attempt's German reason. */
  publishFailureMessage: string | null;
  createdAt: string;
}

const COLUMNS =
  'id, user_id, project_id, requested_name, status, stage1_verdict, stage1_rule_ids, ' +
  'stage2_verdict, stage2_reason, categories, stage2_confidence, scanned_files, scanned_bytes, ' +
  'tokens_input, tokens_output, decided_by, decided_at, decision_reason, created_at';

/**
 * FOUNDER-WALK-6 · U3 (F3) — 0104's column, selected ONLY by the functions that
 * need it. Kept off the base `COLUMNS` deliberately: every pre-existing reader
 * (list/find/decide/enqueue) must keep working, unchanged, on a database where
 * 0104 has not been applied yet — exactly the same reasoning `users-soft-delete.ts`
 * states for `deleted_at`. Only the NEW functions below try this column, and
 * fall back to the base list (message lost, status change kept) if it is absent.
 */
const COLUMNS_WITH_FAILURE = `${COLUMNS}, publish_failure_message`;

/** Narrow, like `isMissingDeletedAt`: a generic schema-shape check would also
 *  swallow the TABLE being absent, which `opsReviewQueueAvailable` already
 *  gates separately and retrying would just fail again. */
function isMissingPublishFailureColumn(message: string | null | undefined): boolean {
  if (!message) return false;
  return isMissingSchema(message) && /publish_failure_message/i.test(message);
}

/**
 * True if migration 0102 has been applied. Probed per call, never cached — a cached
 * `false` would keep the queue dark for the life of the process after the founder
 * applies the migration.
 */
export async function opsReviewQueueAvailable(sb: Sb = getSupabaseAdmin()): Promise<boolean> {
  const { error } = await sb.from('ops_review_queue').select('id').limit(1);
  if (!error) return true;
  const signature = `${error.code ?? ''} ${error.message ?? ''}`;
  if (/42P01|PGRST205|does not exist|schema cache/i.test(signature)) return false;
  // Any other error means the table exists and something else went wrong.
  return true;
}

function toItem(row: Record<string, unknown>): ReviewItem {
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
  return {
    id: String(row.id),
    userId: String(row.user_id),
    projectId: row.project_id ? String(row.project_id) : null,
    requestedName: String(row.requested_name),
    status: String(row.status) as ReviewStatus,
    stage1Verdict: String(row.stage1_verdict),
    stage1RuleIds: arr(row.stage1_rule_ids),
    stage2Verdict: String(row.stage2_verdict),
    stage2Reason: String(row.stage2_reason) as ClassifierReason,
    categories: arr(row.categories) as AupCategory[],
    stage2Confidence: row.stage2_confidence ? String(row.stage2_confidence) : null,
    scannedFiles: row.scanned_files === null || row.scanned_files === undefined ? null : Number(row.scanned_files),
    scannedBytes: row.scanned_bytes === null || row.scanned_bytes === undefined ? null : Number(row.scanned_bytes),
    tokensInput: row.tokens_input === null || row.tokens_input === undefined ? null : Number(row.tokens_input),
    tokensOutput: row.tokens_output === null || row.tokens_output === undefined ? null : Number(row.tokens_output),
    decidedBy: row.decided_by ? String(row.decided_by) : null,
    decidedAt: row.decided_at ? String(row.decided_at) : null,
    decisionReason: row.decision_reason ? String(row.decision_reason) : null,
    // Present only when the caller selected COLUMNS_WITH_FAILURE and 0104 is
    // applied; `undefined` (not selected) and `null` (selected, empty) both
    // read the same way here, which is exactly right — a caller that never
    // asked for this column has nothing wrong to report either.
    publishFailureMessage: row.publish_failure_message ? String(row.publish_failure_message) : null,
    createdAt: String(row.created_at),
  };
}

export interface EnqueueInput {
  userId: string;
  projectId: string | null;
  requestedName: string;
  stage1Verdict: string;
  stage1RuleIds: string[];
  stage2Reason: ClassifierReason;
  categories: AupCategory[];
  stage2Confidence: string;
  scannedFiles: number;
  scannedBytes: number;
  tokensInput: number;
  tokensOutput: number;
}

/**
 * Record a held publish. Returns the row, or `null` when the queue could not take
 * it — pre-0102, or an insert that failed.
 *
 * `null` is not "it worked, quietly". Every caller must treat it as "this hold was
 * not recorded" and say something different to the builder. Nothing is uploaded in
 * either case; the difference is entirely about what we promise.
 */
export async function enqueueReview(input: EnqueueInput, sb: Sb = getSupabaseAdmin()): Promise<ReviewItem | null> {
  // Written to the application log first and unconditionally, so the hold leaves a
  // trace even on a pre-0102 database. Metadata only.
  logger.warn(
    {
      userId: input.userId,
      projectId: input.projectId,
      requestedName: input.requestedName,
      stage2Reason: input.stage2Reason,
      categories: input.categories,
    },
    'hosted_publish_held_for_review',
  );

  try {
    if (!(await opsReviewQueueAvailable(sb))) {
      logger.error({ userId: input.userId }, 'ops_review_queue_absent (pre-0102) — the hold could not be recorded');
      return null;
    }
    const { data, error } = await sb
      .from('ops_review_queue')
      .insert({
        user_id: input.userId,
        project_id: input.projectId,
        requested_name: input.requestedName,
        status: 'pending',
        stage1_verdict: input.stage1Verdict,
        stage1_rule_ids: input.stage1RuleIds,
        stage2_verdict: 'review',
        stage2_reason: input.stage2Reason,
        categories: input.categories,
        stage2_confidence: input.stage2Confidence,
        scanned_files: input.scannedFiles,
        scanned_bytes: input.scannedBytes,
        tokens_input: input.tokensInput,
        tokens_output: input.tokensOutput,
      })
      .select(COLUMNS)
      .single();

    if (error || !data) {
      logger.error({ userId: input.userId, reason: error?.message }, 'ops_review_queue_insert_failed');
      return null;
    }
    return toItem(data as unknown as Record<string, unknown>);
  } catch (err) {
    logger.error({ userId: input.userId, reason: (err as Error)?.message }, 'ops_review_queue_insert_threw');
    return null;
  }
}

/**
 * What is waiting. Reports whether the TABLE was there rather than collapsing
 * "not migrated" into an empty list — for the operator console, "nothing pending"
 * and "nobody can see what is pending" are different facts and lead to different
 * founder actions (the same distinction `listAllOpsApps` draws).
 */
export async function listPendingReviews(
  sb: Sb = getSupabaseAdmin(),
  limit = 50,
): Promise<{ available: boolean; items: ReviewItem[] }> {
  if (!(await opsReviewQueueAvailable(sb))) return { available: false, items: [] };
  const { data, error } = await sb
    .from('ops_review_queue')
    .select(COLUMNS)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    logger.warn({ reason: error.message }, 'ops_review_queue_list_failed');
    return { available: false, items: [] };
  }
  return { available: true, items: (data ?? []).map((r) => toItem(r as unknown as Record<string, unknown>)) };
}

/**
 * PHASE 3 · C8 — what was DECIDED, most recent first.
 *
 * ── Why the decision trail is read from HERE and not from `ops_app_audit` ────
 * The audit row is the retention-grade evidence (12 months, outlives the
 * account); the queue row is the operational record, and it is the one
 * `decideReview` writes transactionally, guarded on `status = 'pending'`. Both
 * carry who/what/when/why. Reading the queue is the smaller, truer fix.
 *
 * The alternative — teaching `GET /api/admin/ops/apps/:idOrName` to resolve a
 * queue-row id — was rejected: that route answers "here is an APP", and a
 * candidate is not an app. It would have had to return a fabricated or null
 * `app` object beside the audit rows, which is a shape lie in a surface whose
 * entire job is not to tell them.
 *
 * ── The honest limit of reading it here ──────────────────────────────────────
 * `ops_review_queue` cascades on user and project deletion (0102). The audit row
 * does not — deliberately, per ABUSE_RESPONSE §8.7. So if the builder's account
 * or project is deleted, this list loses the entry while the evidence survives in
 * `ops_app_audit`. That is the correct behaviour for both tables and it means
 * this list is a convenience, not the record of record.
 */
export async function listRecentReviewDecisions(
  sb: Sb = getSupabaseAdmin(),
  limit = 20,
): Promise<{ available: boolean; items: ReviewItem[] }> {
  if (!(await opsReviewQueueAvailable(sb))) return { available: false, items: [] };
  const { data, error } = await sb
    .from('ops_review_queue')
    .select(COLUMNS)
    .neq('status', 'pending')
    .order('decided_at', { ascending: false })
    .limit(limit);
  if (error) {
    logger.warn({ reason: error.message }, 'ops_review_queue_decided_list_failed');
    return { available: false, items: [] };
  }
  return { available: true, items: (data ?? []).map((r) => toItem(r as unknown as Record<string, unknown>)) };
}

export async function findReviewItem(id: string, sb: Sb = getSupabaseAdmin()): Promise<ReviewItem | null> {
  if (!(await opsReviewQueueAvailable(sb))) return null;
  const { data, error } = await sb.from('ops_review_queue').select(COLUMNS).eq('id', id).maybeSingle();
  if (error || !data) return null;
  return toItem(data as unknown as Record<string, unknown>);
}

/**
 * Settle a pending row. Returns the updated row, or null if it was not settled.
 *
 * Guarded on `status = 'pending'` in the WHERE clause, not read-then-write: two
 * console tabs open on the same item must not produce an approve and a block that
 * both report success. The second one finds no pending row and says so.
 */
export async function decideReview(
  id: string,
  decision: 'approved' | 'blocked',
  actor: string,
  reason: string | null,
  sb: Sb = getSupabaseAdmin(),
): Promise<ReviewItem | null> {
  if (!(await opsReviewQueueAvailable(sb))) return null;
  const { data, error } = await sb
    .from('ops_review_queue')
    .update({
      status: decision,
      decided_by: actor,
      decided_at: new Date().toISOString(),
      decision_reason: reason,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select(COLUMNS)
    .maybeSingle();
  if (error) {
    logger.warn({ id, decision, reason: error.message }, 'ops_review_queue_decide_failed');
    return null;
  }
  return data ? toItem(data as unknown as Record<string, unknown>) : null;
}

// ── FOUNDER-WALK-6 · U3 (F3) — an approval whose publish then failed ───────

/**
 * The publish that followed an approval did not reach live. Moves the row to
 * the fourth, terminal status — never back to 'pending' (see `ReviewStatus`'s
 * doc comment for why) — and records the reason so it survives past the one
 * HTTP response that used to be the only place it was ever said.
 *
 * Guarded on `status = 'approved'`: this can only fire once, immediately after
 * the approve handler's own publish attempt. A retry's failure goes through
 * this same function too (it re-guards on 'approved', which `markPublishRecovered`
 * never sets on a further failure — see `retryReviewPublish`'s caller).
 */
export async function markPublishFailed(id: string, message: string, sb: Sb = getSupabaseAdmin()): Promise<ReviewItem | null> {
  if (!(await opsReviewQueueAvailable(sb))) return null;

  const attempt = (withMessage: boolean) =>
    sb
      .from('ops_review_queue')
      .update(
        withMessage
          ? { status: 'approved_publish_failed', publish_failure_message: message }
          : { status: 'approved_publish_failed' },
      )
      .eq('id', id)
      .eq('status', 'approved')
      .select(withMessage ? COLUMNS_WITH_FAILURE : COLUMNS)
      .maybeSingle();

  let { data, error } = await attempt(true);
  if (error && isMissingPublishFailureColumn(error.message)) {
    logger.warn({ id }, 'ops_review_queue_publish_failure_message_absent (pre-0104) — status recorded, message dropped');
    ({ data, error } = await attempt(false));
  }
  if (error) {
    logger.warn({ id, reason: error.message }, 'ops_review_queue_mark_publish_failed_failed');
    return null;
  }
  return data ? toItem(data as unknown as Record<string, unknown>) : null;
}

/**
 * A retry (`retryReviewPublish`'s caller, the console route) reached live.
 * Back to plain 'approved' — the state a first-try success would have left —
 * and the stale failure message is cleared so a second reader never sees it.
 */
export async function markPublishRecovered(id: string, sb: Sb = getSupabaseAdmin()): Promise<ReviewItem | null> {
  if (!(await opsReviewQueueAvailable(sb))) return null;

  const attempt = (withMessage: boolean) =>
    sb
      .from('ops_review_queue')
      .update(withMessage ? { status: 'approved', publish_failure_message: null } : { status: 'approved' })
      .eq('id', id)
      .eq('status', 'approved_publish_failed')
      .select(withMessage ? COLUMNS_WITH_FAILURE : COLUMNS)
      .maybeSingle();

  let { data, error } = await attempt(true);
  if (error && isMissingPublishFailureColumn(error.message)) {
    ({ data, error } = await attempt(false));
  }
  if (error) {
    logger.warn({ id, reason: error.message }, 'ops_review_queue_mark_publish_recovered_failed');
    return null;
  }
  return data ? toItem(data as unknown as Record<string, unknown>) : null;
}

/**
 * What needs a human to look AGAIN: an approval whose publish did not reach
 * live. Same shape and the same `available` reasoning as `listPendingReviews`
 * — deliberately its own list rather than folded into the time-limited
 * "recently decided" feed, so an old failure cannot age out of view the way
 * this whole unit exists to prevent.
 */
export async function listNeedsAttentionReviews(
  sb: Sb = getSupabaseAdmin(),
  limit = 50,
): Promise<{ available: boolean; items: ReviewItem[] }> {
  if (!(await opsReviewQueueAvailable(sb))) return { available: false, items: [] };

  const attempt = (withMessage: boolean) =>
    sb
      .from('ops_review_queue')
      .select(withMessage ? COLUMNS_WITH_FAILURE : COLUMNS)
      .eq('status', 'approved_publish_failed')
      .order('created_at', { ascending: false })
      .limit(limit);

  let { data, error } = await attempt(true);
  if (error && isMissingPublishFailureColumn(error.message)) {
    ({ data, error } = await attempt(false));
  }
  if (error) {
    logger.warn({ reason: error.message }, 'ops_review_queue_needs_attention_list_failed');
    return { available: false, items: [] };
  }
  return { available: true, items: (data ?? []).map((r) => toItem(r as unknown as Record<string, unknown>)) };
}
