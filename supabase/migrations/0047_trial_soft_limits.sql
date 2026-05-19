-- 14-5: Trial soft-limits + key-reset logic
-- Extends existing 0030_cloud_trial schema on `users` table.

alter table public.users
  add column if not exists trial_ended_at timestamptz,
  add column if not exists trial_end_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_trial_end_reason_check'
  ) then
    alter table public.users
      add constraint users_trial_end_reason_check
      check (trial_end_reason is null or trial_end_reason in ('expired','key_added','subscription_started'));
  end if;
end$$;

-- Daily request count for users without a BYOK key (soft-limit accounting).
create table if not exists public.daily_request_counts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists idx_daily_request_counts_user_date
  on public.daily_request_counts(user_id, date);

alter table public.daily_request_counts enable row level security;

drop policy if exists "Users see own counts" on public.daily_request_counts;
create policy "Users see own counts" on public.daily_request_counts
  for select using (auth.uid() = user_id);

-- Atomic increment helper. Insert-or-update by (user_id, date).
create or replace function public.increment_daily_request_count(
  p_user_id uuid,
  p_date date
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.daily_request_counts (user_id, date, count)
  values (p_user_id, p_date, 1)
  on conflict (user_id, date)
  do update set count = daily_request_counts.count + 1, updated_at = now();
$$;

revoke all on function public.increment_daily_request_count(uuid, date) from public;
grant execute on function public.increment_daily_request_count(uuid, date) to service_role;
