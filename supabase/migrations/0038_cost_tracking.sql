-- 9B-2 Cost tracking — per-completion cost rows for admin dashboard
create table if not exists public.completion_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chat_session_id uuid,
  provider text not null,
  model text not null,
  source_tier text,
  tokens_in bigint not null default 0,
  tokens_out bigint not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists completion_costs_user_idx
  on public.completion_costs(user_id, created_at desc);

create index if not exists completion_costs_provider_idx
  on public.completion_costs(provider, created_at desc);

alter table public.completion_costs enable row level security;

drop policy if exists "Users read own costs" on public.completion_costs;
create policy "Users read own costs"
  on public.completion_costs for select
  using (auth.uid() = user_id);

drop policy if exists "Service role full access" on public.completion_costs;
create policy "Service role full access"
  on public.completion_costs for all
  using (auth.role() = 'service_role');

create or replace view public.monthly_costs_per_user as
select
  user_id,
  date_trunc('month', created_at) as month,
  provider,
  sum(tokens_in) as tokens_in,
  sum(tokens_out) as tokens_out,
  sum(cost_usd) as cost_usd,
  count(*) as completions
from public.completion_costs
group by user_id, date_trunc('month', created_at), provider;
