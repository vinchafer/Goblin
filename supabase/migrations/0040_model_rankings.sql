-- =============================================================================
-- 9R: Model Intelligence Layer Schema
-- =============================================================================

create table if not exists public.model_sources (
  id text primary key,
  name text not null,
  url text not null,
  description text,
  enabled boolean not null default true,
  last_fetched_at timestamptz,
  last_status text,
  last_error text,
  last_record_count int default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.ranked_models (
  id text primary key,
  provider text not null,
  display_name text not null,
  family text,
  context_tokens int,
  pricing_in_per_million numeric(10, 4),
  pricing_out_per_million numeric(10, 4),
  modality text[] default array['text'],
  released_at date,
  is_open_source boolean default false,
  is_deprecated boolean default false,
  metadata jsonb default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists ranked_models_provider_idx on public.ranked_models(provider);
create index if not exists ranked_models_family_idx on public.ranked_models(family);

create table if not exists public.model_rankings (
  id uuid primary key default gen_random_uuid(),
  model_id text not null references public.ranked_models(id) on delete cascade,
  source_id text not null references public.model_sources(id) on delete cascade,
  dimension text not null,
  raw_score numeric(10, 4),
  normalized_score numeric(5, 4),
  rank_in_source int,
  sample_size int,
  fetched_at timestamptz not null default now(),
  unique(model_id, source_id, dimension)
);

create index if not exists rankings_dimension_idx on public.model_rankings(dimension, normalized_score desc);
create index if not exists rankings_model_idx on public.model_rankings(model_id);
create index if not exists rankings_source_idx on public.model_rankings(source_id);

create table if not exists public.model_ranking_history (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  model_id text not null,
  source_id text not null,
  dimension text not null,
  normalized_score numeric(5, 4),
  rank_in_source int,
  run_at timestamptz not null default now()
);

create index if not exists ranking_history_model_idx
  on public.model_ranking_history(model_id, dimension, run_at desc);

create index if not exists ranking_history_run_idx
  on public.model_ranking_history(run_id);

create table if not exists public.model_composite_rankings (
  model_id text not null references public.ranked_models(id) on delete cascade,
  task_type text not null,
  composite_score numeric(5, 4),
  rank int,
  source_count int,
  contributing_sources text[],
  computed_at timestamptz not null default now(),
  primary key(model_id, task_type)
);

create index if not exists composite_task_rank_idx
  on public.model_composite_rankings(task_type, rank);

alter table public.model_sources enable row level security;
alter table public.ranked_models enable row level security;
alter table public.model_rankings enable row level security;
alter table public.model_ranking_history enable row level security;
alter table public.model_composite_rankings enable row level security;

create policy "Public can read sources"
  on public.model_sources for select using (true);
create policy "Public can read ranked_models"
  on public.ranked_models for select using (true);
create policy "Public can read rankings"
  on public.model_rankings for select using (true);
create policy "Public can read composite"
  on public.model_composite_rankings for select using (true);

create policy "Service role full access on sources"
  on public.model_sources for all using (auth.role() = 'service_role');
create policy "Service role full access on ranked_models"
  on public.ranked_models for all using (auth.role() = 'service_role');
create policy "Service role full access on rankings"
  on public.model_rankings for all using (auth.role() = 'service_role');
create policy "Service role full access on history"
  on public.model_ranking_history for all using (auth.role() = 'service_role');
create policy "Service role full access on composite"
  on public.model_composite_rankings for all using (auth.role() = 'service_role');

insert into public.model_sources (id, name, url, description) values
  ('openrouter', 'OpenRouter',           'https://openrouter.ai/api/v1/models', 'Aggregator with live pricing + popularity data'),
  ('aider',      'Aider Polyglot',       'https://github.com/Aider-AI/aider', 'Coding benchmark across 6 languages, run by Aider team'),
  ('livebench',  'LiveBench',            'https://livebench.ai/', 'Contamination-free benchmark, monthly refresh'),
  ('hf',         'HuggingFace LLM Lb v2','https://huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard', 'Academic benchmarks for open-source models'),
  ('swebench',   'SWE-Bench Verified',   'https://www.swebench.com/', 'Real-world software engineering tasks')
on conflict (id) do update set
  name = excluded.name,
  url = excluded.url,
  description = excluded.description;
