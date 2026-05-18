-- 11A-1: GDPR-konforme Account-Deletion mit 30-Tage-Grace-Period.
-- EDPB CEF 2025 Report — Best-Practice: Soft-Delete + Hard-Delete nach 30 Tagen.

create table if not exists public.account_deletions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  scheduled_hard_delete_at timestamptz not null,
  status text not null check (status in ('pending', 'cancelled', 'completed')) default 'pending',
  cancellation_token text not null,
  cancellation_token_expires_at timestamptz not null,
  hard_delete_attempted_at timestamptz,
  hard_delete_completed_at timestamptz,
  hard_delete_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_account_deletions_cancellation_token
  on public.account_deletions(cancellation_token);
create index if not exists idx_account_deletions_status on public.account_deletions(status);
create index if not exists idx_account_deletions_scheduled
  on public.account_deletions(scheduled_hard_delete_at)
  where status = 'pending';

-- Audit-Log: persistent even after the user row is hard-deleted.
-- Stores only SHA-256 hashes — no PII.
create table if not exists public.deletion_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id_hash text not null,
  user_email_hash text not null,
  event_type text not null check (event_type in ('requested', 'cancelled', 'completed', 'failed')),
  event_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_deletion_audit_log_event_at
  on public.deletion_audit_log(event_at desc);

alter table public.account_deletions enable row level security;
alter table public.deletion_audit_log enable row level security;

-- User reads only their own deletion request.
drop policy if exists "Users can view own deletion request" on public.account_deletions;
create policy "Users can view own deletion request"
  on public.account_deletions for select
  using (auth.uid() = user_id);

-- service-role bypasses RLS, so no explicit policies for inserts/updates/selects on audit.
