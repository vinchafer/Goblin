-- Session 9D-4: BYOK per-provider usage tracking (tokens + requests per month)
create table if not exists public.byok_key_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  tokens_in bigint not null default 0,
  tokens_out bigint not null default 0,
  requests int not null default 0,
  last_used_at timestamptz default now(),
  period_start date not null default (current_date),
  created_at timestamptz not null default now(),
  unique(user_id, provider, period_start)
);

create index if not exists byok_usage_user_idx
  on public.byok_key_usage(user_id, period_start desc);

alter table public.byok_key_usage enable row level security;

create policy "Users can read own usage"
  on public.byok_key_usage for select
  using (auth.uid() = user_id);

create policy "Service role full access"
  on public.byok_key_usage for all
  using (auth.role() = 'service_role');

create or replace function public.increment_byok_usage(
  p_user_id uuid,
  p_provider text,
  p_tokens_in bigint,
  p_tokens_out bigint
) returns void
language plpgsql
security definer
as $$
begin
  insert into public.byok_key_usage (user_id, provider, tokens_in, tokens_out, requests, last_used_at, period_start)
  values (p_user_id, p_provider, p_tokens_in, p_tokens_out, 1, now(), current_date)
  on conflict (user_id, provider, period_start)
  do update set
    tokens_in = byok_key_usage.tokens_in + excluded.tokens_in,
    tokens_out = byok_key_usage.tokens_out + excluded.tokens_out,
    requests = byok_key_usage.requests + 1,
    last_used_at = now();
end;
$$;
