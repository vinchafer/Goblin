-- F-40 (resumable runs): the per-run APPEND-ONLY event log.
--
-- The gap (SPIKE, _sprint/speed-haptics/DIAGNOSIS.md Part B): an agent run is coupled
-- to the HTTP request (code-sessions.ts:676 passes stopSignal = c.req.raw.signal), and
-- agent_runs stores only a start/end lifecycle envelope — no live, ordered record of
-- "what happened in this run". So a client that disconnects both STOPS the run and loses
-- the view of it, and a returning client has nothing to replay.
--
-- This table is the ONE source of truth for a run's progress. The registry appends one
-- row per emitted event AS the run executes; the same rows are what a re-attaching client
-- replays (GET …/runs/:runId/events?since=N). It is deliberately metadata-shaped:
--   seq     = per-run monotonic ordinal (the resume cursor; client asks for seq > N).
--   type    = the event kind: agent_narration | agent_plan | agent_step | agent_report
--             | meta | done | error (the SSE frame types the client already switches on).
--   payload = the event body MINUS its type (jsonb). Scrubbed by the same Wave-D
--             secrets-scrubber the step_log/report use (scrubSecrets) before it is written —
--             narration/report carry the model's own words, which could echo an upstream
--             key. No raw user content beyond what agent_runs already stores (the report
--             card + step log live on agent_runs; this is their ordered, resumable twin).
--
-- user_id / project_id are denormalized so the RLS policy is byte-identical to agent_runs
-- (auth.uid() = user_id) — a viewer sees only their own run events — and so the account-
-- deletion cascade (ON DELETE CASCADE from users/projects) reaches these rows too.
--
-- Idempotent (IF NOT EXISTS). NOT applied automatically — the founder applies it via the
-- Supabase SQL Editor. Every API write is PRE-MIGRATION TOLERANT: the run-events store
-- probes for the table once and silently no-ops (in-memory ring only, same-process
-- re-attach still works) before the founder applies this, so a pre-0091 DB never crashes
-- and never blocks a run.

create table if not exists public.agent_run_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  seq integer not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, seq)
);

alter table public.agent_run_events enable row level security;

-- Same shape as agent_runs' policy: a user reads only their own run events.
create policy "Users can view own agent run events" on public.agent_run_events
  for all using (auth.uid() = user_id);

-- The resume read is always "events for this run with seq > cursor, in order" — this
-- index serves both the replay and the DB-poll live tail.
create index if not exists idx_agent_run_events_run_seq
  on public.agent_run_events (run_id, seq);
