-- ─────────────────────────────────────────────────────────────────────────────
-- A-1 · TTFT before/after — founder-runnable measurement SQL
-- Run in the Supabase SQL Editor. Cloud session cannot reach the prod DB, so these
-- produce the p50/p90 numbers the gate asks for; run BEFORE this wave merges (baseline)
-- and again ~24 h AFTER (with the byte-stable prefix + prompt_cache_key live).
--
-- Surface taxonomy on completion_costs (no dedicated `surface` column exists):
--   • agent run      → run_id IS NOT NULL
--   • project chat   → run_id IS NULL AND project_id IS NOT NULL
--   • standalone chat→ run_id IS NULL AND project_id IS NULL
-- Model tier is `model` (goblin/efficient = Swift, goblin/premium = Forge).
-- NOTE: ttft_ms is recorded on the STREAMING chat path (0080). Agent turns are
-- non-streaming, so their ttft_ms is NULL — the felt "Swift feels slow" is the chat
-- path, which is where the prefix cache shows up. Rows with ttft_ms NULL are excluded.
-- ─────────────────────────────────────────────────────────────────────────────

-- Q1 · TTFT p50/p90 by surface + tier, last 7 days (the headline table)
select
  case
    when run_id is not null then 'agent'
    when project_id is not null then 'project_chat'
    else 'standalone_chat'
  end                                                             as surface,
  model,
  count(*)                                                        as n,
  percentile_cont(0.5)  within group (order by ttft_ms)::int      as ttft_p50_ms,
  percentile_cont(0.9)  within group (order by ttft_ms)::int      as ttft_p90_ms,
  percentile_cont(0.5)  within group (order by duration_ms)::int  as dur_p50_ms,
  percentile_cont(0.9)  within group (order by duration_ms)::int  as dur_p90_ms
from public.completion_costs
where created_at >= now() - interval '7 days'
  and ttft_ms is not null
group by 1, 2
order by 1, 2;

-- Q2 · Swift (goblin/efficient) chat TTFT only — the exact number the founder feels
select
  percentile_cont(0.5) within group (order by ttft_ms)::int as swift_chat_ttft_p50_ms,
  percentile_cont(0.9) within group (order by ttft_ms)::int as swift_chat_ttft_p90_ms,
  count(*) as n
from public.completion_costs
where created_at >= now() - interval '7 days'
  and ttft_ms is not null
  and run_id is null
  and model = 'goblin/efficient';

-- Q3 · Before/after split around the merge — paste the merge timestamp (UTC) below.
-- Compares TTFT p50/p90 for the window BEFORE vs AFTER the prefix-caching change.
with merged as (select timestamp '2026-07-11 00:00:00' as merged_at)  -- ← EDIT to real merge time
select
  case when c.created_at < m.merged_at then 'before' else 'after' end as phase,
  count(*) as n,
  percentile_cont(0.5) within group (order by c.ttft_ms)::int as ttft_p50_ms,
  percentile_cont(0.9) within group (order by c.ttft_ms)::int as ttft_p90_ms
from public.completion_costs c, merged m
where c.ttft_ms is not null
  and c.run_id is null
  and c.model = 'goblin/efficient'
  and c.created_at >= m.merged_at - interval '24 hours'
  and c.created_at <  m.merged_at + interval '24 hours'
group by 1
order by 1 desc;
