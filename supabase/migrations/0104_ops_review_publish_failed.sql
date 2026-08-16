-- AKT 2 · PHASE 3 · U3.2 follow-up (FOUNDER-WALK-6 · U3 / F3) — an approval whose
-- publish then fails must stay visible, not vanish into "approved" with nobody
-- knowing to look again.
--
-- AUTHORED, NOT APPLIED (Law 4 / sprint hard rule), exactly like 0102. Additive
-- and idempotent; touches no existing row.
--
-- ── WHAT WAS WRONG ────────────────────────────────────────────────────────────
-- `POST /reviews/:id/approve` (ops-console.ts) settles the row's status to
-- 'approved' BEFORE attempting the publish, on purpose (a network failure must
-- not erase a recorded human decision). But when the publish attempt that
-- follows then fails, NOTHING wrote that back — the row stayed 'approved'
-- forever, `listPendingReviews` excludes it (status != 'pending'), and
-- `listRecentReviewDecisions` shows it identically to a normal, successful
-- approval. The one-time API response said "the publish did not go through",
-- but nothing PERSISTED that, so the moment the operator's browser tab closed,
-- the fact was gone. An operator reading the console later has no way to tell
-- "approved and live" from "approved and never happened" without re-checking
-- every single approval by hand.
--
-- ── THE FIX, AND WHY IT IS A NEW STATUS AND NOT A REVERT TO 'pending' ─────────
-- `status` is free text (see 0102's comment on why) — no CHECK, so a fourth
-- value needs no constraint change, only code and this index. On a post-approval
-- publish failure, `ops-console.ts` now moves the row to
-- 'approved_publish_failed' instead of leaving it at 'approved'. The human
-- decision (`decided_by`/`decided_at`/`decision_reason`) is NEVER touched again
-- — reverting to 'pending' was rejected for exactly the reason the original
-- code comment gave: it would erase a decision that was, in fact, made. A
-- retry ('POST /reviews/:id/retry-publish') re-attempts ONLY the publish; on
-- success the row returns to plain 'approved' (published, as intended); on a
-- further failure it stays 'approved_publish_failed' with the latest reason.

alter table public.ops_review_queue
  add column if not exists publish_failure_message text;

comment on column public.ops_review_queue.publish_failure_message is
  'Set when a publish attempt after approval failed (status=approved_publish_failed). The same German, user-facing sentence PublishFailure.message carries — never a stack trace, never a rule id. Cleared on a successful retry.';

-- "What needs a human to look again?" — mirrors idx_ops_review_queue_pending's
-- shape for the same reason: this list must stay cheap however large the
-- decision history grows, because an operator must never learn to stop
-- checking it.
create index if not exists idx_ops_review_queue_publish_failed
  on public.ops_review_queue (created_at desc)
  where status = 'approved_publish_failed';
