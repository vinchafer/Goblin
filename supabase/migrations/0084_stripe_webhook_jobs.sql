-- Webhook hardening (2026-07-08): turn the idempotency table into a durable,
-- releasable job log so the Stripe webhook can ACK fast (200 before side-effects)
-- and process asynchronously without losing events if the Railway process is
-- restarted mid-flight.
--
-- Prior state (0049): stripe_processed_events was a bare (event_id, event_type,
-- processed_at) idempotency ledger. A processed row = "we already applied the
-- side effect". The webhook handler awaited ALL business logic before returning
-- 200, so a stalled Supabase/Stripe upstream could hang the response until Stripe
-- timed out the delivery (observability blind spot, ticket #12).
--
-- New state: each row is a job. The webhook verifies the signature, stores the
-- raw event payload with status='pending', ACKs 200 immediately, then processes
-- side-effects in the background. Success → status='done'. Failure/timeout →
-- status='failed' (releasable): a recovery sweep re-runs failed + stale-pending
-- jobs from the stored payload, so nothing is silently lost even though Stripe
-- (having received the 200) will not retry.
--
-- Backward compatible: existing rows (pre-hardening, already fully processed
-- synchronously) default to status='done' so the recovery sweep never re-applies
-- them.
--
-- NOTE (cloud rule): migration AUTHORED here, NOT applied. Apply via the normal
-- migration path (startup-migrations / supabase db push) at deploy time.

alter table public.stripe_processed_events
  add column if not exists status text not null default 'done',
  add column if not exists payload jsonb,
  add column if not exists attempts integer not null default 0,
  add column if not exists last_error text,
  add column if not exists updated_at timestamptz not null default now();

-- Constrain status to the known set (add only if not already present).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stripe_processed_events_status_chk'
  ) then
    alter table public.stripe_processed_events
      add constraint stripe_processed_events_status_chk
      check (status in ('pending', 'done', 'failed'));
  end if;
end $$;

-- Recovery-sweep index: find releasable jobs (failed, or pending that stalled).
create index if not exists idx_stripe_processed_events_recovery
  on public.stripe_processed_events(status, updated_at)
  where status in ('pending', 'failed');
