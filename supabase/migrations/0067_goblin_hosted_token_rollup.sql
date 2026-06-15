-- 0067_goblin_hosted_token_rollup.sql
-- Layer-2 "API-First" pivot (Session 1, Phase 4c).
--
-- Per-user MONTHLY token rollup for the Goblin-bundled (Layer 2) fair-use cap.
-- Builds on completion_costs (mig 0038), which already carries source_tier +
-- tokens_in/tokens_out per completion. We do NOT duplicate that data — this is a
-- thin aggregation view scoped to the goblin_hosted tier (source_tier = 'goblin_hosted').
--
-- The cap reads (tokens_in + tokens_out) summed per user for the current calendar
-- month and compares against the plan's soft cap (~40-60M tok/mo on the base plan,
-- enforced in application code — this migration only exposes the number).
--
-- security_invoker = true → the caller's RLS on completion_costs applies, so a user
-- can only ever read their own rollup. No new RLS policy needed.
--
-- HR-10: migration file only. Founder applies manually via Supabase SQL Editor.
-- Nothing here is executed by the agent.

-- Per-user / per-month Layer-2 token totals.
create or replace view public.goblin_hosted_monthly_tokens
with (security_invoker = true) as
select
  user_id,
  date_trunc('month', created_at) as month,
  sum(tokens_in)                  as tokens_in,
  sum(tokens_out)                 as tokens_out,
  sum(tokens_in + tokens_out)     as tokens_total,
  count(*)                        as completions
from public.completion_costs
where source_tier = 'goblin_hosted'
group by user_id, date_trunc('month', created_at);

comment on view public.goblin_hosted_monthly_tokens is
  'Layer-2 (Goblin-bundled) per-user monthly token rollup for the fair-use cap. '
  'Source: completion_costs where source_tier = ''goblin_hosted''. security_invoker.';

-- Convenience: current-month total for one user (the value the usage bar reads).
-- Returns 0 rows → application treats as zero usage.
create or replace view public.goblin_hosted_current_month_tokens
with (security_invoker = true) as
select
  user_id,
  tokens_in,
  tokens_out,
  tokens_total,
  completions
from public.goblin_hosted_monthly_tokens
where month = date_trunc('month', now());
