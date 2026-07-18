-- WAVE-H (Performance & Skalierung) H6 — index the F5 checkpoint-prune cron's hot scan.
--
-- The gap (found in the H6 index audit): the retention cron `pruneAgentAutoCheckpoints`
-- (services/checkpoints/retention.ts, cron 03:45 UTC) runs two GLOBAL queries across the
-- whole project_checkpoints table with NO project_id filter:
--   (1) protected set   — WHERE created_by='agent-run' AND run_id IS NOT NULL
--                         ORDER BY created_at DESC LIMIT <keepRuns>
--   (2) stale candidates — WHERE created_by='agent-run' AND created_at < <cutoff>
-- The 0095 indexes are BOTH project-scoped (`(project_id, created_at desc)` and the partial
-- `... where created_by='publish'`). Neither serves a query that filters `created_by=
-- 'agent-run'` without a project_id, so both prune queries fall back to a SEQUENTIAL SCAN of
-- the entire table. That cost is ~free today (few rows) but grows linearly with total
-- checkpoint volume across ALL users — exactly the scale case Wave H hardens for.
--
-- The fix mirrors the existing publish partial index (0095): a partial index on the
-- agent-run partition, ordered by created_at DESC. It serves the LIMIT scan (1) directly and
-- the range scan (2) as a partitioned created_at index — turning both full scans into index
-- reads over just the agent-run rows.
--
-- Migrationen: authored, NIE angewendet (Gesetz 4). The prune code is pre-index tolerant —
-- it works with or without this index (only the plan changes), so applying it is a pure
-- performance win with no behavioural coupling. Founder applies via the Supabase SQL editor.
-- CONCURRENTLY is intentionally omitted so this can run inside the standard migration
-- transaction; the table is small at apply time. If applied later against a large table,
-- run `CREATE INDEX CONCURRENTLY` manually instead to avoid a write lock.

create index if not exists idx_project_checkpoints_agentrun_created
  on public.project_checkpoints (created_at desc)
  where created_by = 'agent-run';
