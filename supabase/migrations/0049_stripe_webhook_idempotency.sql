-- Session 16 Phase 2: Stripe webhook idempotency
-- Stripe may deliver the same event multiple times. Track processed events to
-- prevent double-application of side effects (subscription updates, usage
-- resets).

create table if not exists public.stripe_processed_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

-- Auto-prune events older than 90 days to keep table bounded.
-- Run via a scheduled function or manual cleanup; for now the table is small
-- (~few hundred events/month at typical scale).
create index if not exists idx_stripe_processed_events_age
  on public.stripe_processed_events(processed_at);

alter table public.stripe_processed_events enable row level security;

create policy "stripe_processed_events service role"
  on public.stripe_processed_events
  for all using (auth.role() = 'service_role');
