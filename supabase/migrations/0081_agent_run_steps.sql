-- FEEL-3a (the agent loop, safe half): persist the per-run execution log so the
-- final report is attestable from tool results and telemetry can read the same
-- agent_runs table it already reads.
--
-- A run is the server-side orchestrator loop (list_files → read_file → write_file
-- → save_draft → finish). Today agent_runs carries only the request lifecycle
-- (status pending|running|success|failed) + tokens/cost. FEEL-3a adds the loop's
-- ground truth:
--   step_log   = ordered jsonb array, one entry per tool step
--                { tool, args, outcome, ms } — args is a short summary string, not
--                the full payload; this is what makes "Schreibt script.js · GEÄNDERT
--                +14 −2" attestable (it IS the execution log, not a performance).
--   tools_used = distinct tool names touched this run (cheap telemetry rollup).
--   iterations = model turns consumed (against the AGENT_MAX_ITERATIONS budget).
--   outcome    = fine-grained terminal reason, ORTHOGONAL to status:
--                  finished = model called finish() cleanly
--                  stopped  = user Stopp ended the loop (partial state persisted)
--                  budget   = iteration / unit budget forced a truthful finish
--                  error    = fatal error aborted the loop
--                status stays truthful (success = loop ended without a fatal error;
--                failed = fatal error); outcome carries the nuance the report needs.
--
-- completion_costs.run_id links each billed model turn back to its run, so the
-- report's cost line ("Σ units consumed") sums the run's real completions rather
-- than an estimate. Nullable: ordinary (non-agent) completions leave it NULL.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS). NOT applied automatically — founder
-- applies via Supabase SQL Editor. Every API write is pre-migration tolerant:
-- run-store retries the insert/update without these columns when they are absent,
-- and trackCompletion retries without run_id, so a pre-0081 DB never crashes and
-- never drops a run or a cost row.

alter table public.agent_runs
  add column if not exists step_log jsonb not null default '[]'::jsonb;

alter table public.agent_runs
  add column if not exists tools_used text[];

alter table public.agent_runs
  add column if not exists iterations integer;

alter table public.agent_runs
  add column if not exists outcome text
  check (outcome is null or outcome in ('finished', 'stopped', 'budget', 'error'));

alter table public.completion_costs
  add column if not exists run_id uuid;

-- Cheap lookup of a run's completions for the report cost line + telemetry.
create index if not exists idx_completion_costs_run on public.completion_costs (run_id);
