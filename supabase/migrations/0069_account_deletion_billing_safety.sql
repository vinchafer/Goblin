-- 0069_account_deletion_billing_safety.sql
-- Billing-safety hardening for the canonical account-deletion service.
--
-- ① Track the Stripe-cancel outcome on each deletion request so the cron
--    hard-delete can BLOCK the data purge while a live (uncancelled)
--    subscription still exists — never erase data while Stripe could bill.
-- ② Fix goblin_hosted_waitlist FK: it referenced users(id) with the default
--    NO ACTION (RESTRICT), which would BLOCK the auth-cascade delete for any
--    user who had joined the waitlist. Switch to ON DELETE CASCADE.
--
-- Reuses the existing account_deletions table (0042). `scheduled_hard_delete_at`
-- is the existing hard-delete deadline; the service now sets it to now + 10 days
-- (founder decision: 10-day reactivable grace).

-- ── ① cancel-tracking columns ───────────────────────────────────────────────
alter table public.account_deletions
  add column if not exists stripe_cancel_requested boolean not null default false,
  add column if not exists stripe_cancel_confirmed boolean not null default false,
  add column if not exists stripe_cancel_attempts  integer not null default 0,
  add column if not exists stripe_cancel_last_error text,
  add column if not exists purge_blocked boolean not null default false,
  add column if not exists purge_blocked_reason text,
  add column if not exists purge_blocked_at timestamptz;

-- ── ② goblin_hosted_waitlist FK → ON DELETE CASCADE ─────────────────────────
-- Drop whatever the auto-named FK is, then recreate with cascade. The FK was
-- created inline (CREATE TABLE ... user_id UUID REFERENCES users(id)), so the
-- constraint name is the Postgres default: <table>_<column>_fkey.
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_name = 'goblin_hosted_waitlist'
      and constraint_name = 'goblin_hosted_waitlist_user_id_fkey'
  ) then
    alter table public.goblin_hosted_waitlist
      drop constraint goblin_hosted_waitlist_user_id_fkey;
  end if;
end $$;

alter table public.goblin_hosted_waitlist
  add constraint goblin_hosted_waitlist_user_id_fkey
  foreign key (user_id) references public.users(id) on delete cascade;

-- NOTE: build_runs (0024) has `user_id UUID NOT NULL` with NO foreign key, so it
-- does NOT cascade. Adding an FK here could fail against existing orphan rows on
-- live data, so the deletion SERVICE deletes build_runs by user_id explicitly
-- before the auth-cascade delete (see services/account-deletion.ts).
