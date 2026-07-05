-- I0 (MOBILE-1 telemetry pre-unit): make EVERY completion_costs row attributable
-- project-vs-standalone without a chat_sessions join.
--
-- Background: telemetry A19 (project vs standalone token split) needs a single
-- discriminator on completion_costs. The chat-sessions route now writes
-- chat_session_id (→ chat_sessions.project_id), but the LEGACY project route
-- (routes/chat.ts) creates no chat_sessions row, so its rows would stay
-- unattributable even after that patch (telemetry NOTES gap #1). Adding
-- project_id directly closes the gap for both routes and makes per-project cost
-- rollups trivial.
--
-- project_id NULL  = standalone chat (no project). NOT NULL = project chat.
-- Nullable, no FK cascade required for accounting rows; kept as a plain uuid so a
-- deleted project's historical cost rows survive (COGS history must not vanish).
--
-- Idempotent (ADD COLUMN IF NOT EXISTS). NOT applied automatically — founder
-- applies via Supabase SQL Editor. The API write is pre-migration tolerant:
-- trackCompletion retries the insert without project_id if this column is absent.

alter table public.completion_costs
  add column if not exists project_id uuid;

create index if not exists completion_costs_project_idx
  on public.completion_costs(project_id, created_at desc);

-- Refresh the rollup view to expose the project dimension. date_trunc grouping
-- unchanged; project_id added so A19 can split project vs standalone (NULL).
create or replace view public.monthly_costs_per_user as
select
  user_id,
  project_id,
  date_trunc('month', created_at) as month,
  provider,
  sum(tokens_in) as tokens_in,
  sum(tokens_out) as tokens_out,
  sum(cost_usd) as cost_usd,
  count(*) as completions
from public.completion_costs
group by user_id, project_id, date_trunc('month', created_at), provider;
