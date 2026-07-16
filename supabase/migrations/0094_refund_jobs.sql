-- DD-hardening FW6-U1 (2026-07-15): refund resilience.
--
-- FW5-U5 (migration-less, `refundRemainingCreditOnCancel` in billing-service.ts)
-- auto-refunds any remaining downgrade credit when a subscription is cancelled.
-- It is NON-throwing by design (a refund must never fail the subscription.deleted
-- handler, which would retry the whole event). But that meant a FAILED refund
-- (no refundable charge yet, a Stripe 500, a timeout) was only LOGGED — the money
-- owed to the user was never retried and no operator surface showed it. A churned
-- user could be silently short-changed.
--
-- This makes a failed refund a DURABLE, RETRYABLE JOB — the exact pattern
-- 0084_stripe_webhook_jobs.sql established for webhook side-effects: persist the
-- work, retry it on a cron sweep from the stored context, and make it
-- operator-visible once it has failed N times. The refund itself stays idempotent
-- (keyed on the subscription in Stripe), so replay can never double-refund.
--
-- Keyed on subscription_id (PK) → one refund obligation per cancelled sub, so the
-- enqueue is a plain upsert and the retry can never fan out duplicates. A row is
-- only ever created when a refund attempt FAILED; a first-try success writes
-- nothing (the common path stays zero-cost).
--
-- NOTE (cloud rule): migration AUTHORED here, NOT applied. Apply via the normal
-- migration path (startup-migrations / supabase db push) at deploy time. The code
-- is pre-migration tolerant: if this table is absent, the enqueue/sweep log and
-- no-op rather than throwing, so cancellation refunds behave exactly as they did
-- in FW5-U5 until the migration lands.

create table if not exists public.refund_jobs (
  subscription_id text primary key,
  customer_id     text,
  -- pending  = queued, not yet retried since the last failure
  -- failed   = a retry attempt errored (still releasable — the sweep re-runs it)
  -- done     = the refund completed (refunded / balance-unadjusted / noop / skipped)
  status          text not null default 'pending'
                  check (status in ('pending', 'failed', 'done')),
  attempts        integer not null default 0,
  -- last non-success CancelRefundStatus reason (e.g. 'no_refundable_charge').
  last_reason     text,
  last_error      text,
  -- the credit we were trying to return, in cents (for the operator surface).
  credit_cents    integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Retry-sweep index: find releasable jobs (pending or previously-failed), oldest
-- first. `done` rows are excluded so a resolved obligation is never re-swept.
create index if not exists idx_refund_jobs_retry
  on public.refund_jobs(status, updated_at)
  where status in ('pending', 'failed');
