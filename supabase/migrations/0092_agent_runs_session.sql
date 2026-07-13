-- F-40 (resumable runs): link an agent run to its code session so a returning client can
-- find the in-flight run to re-attach to.
--
-- agent_runs today carries project_id but NOT session_id — yet a project can have many
-- code sessions, so "the active run for THIS chat/session" is not answerable from the row.
-- The re-attach mount probe (GET …/runs/active) needs exactly that lookup, and it must
-- survive a process restart / a different replica (the in-memory registry cannot), so the
-- linkage has to live in the DB.
--
-- ON DELETE SET NULL: deleting a session must not vaporize its run's billing/telemetry
-- history (the run's tokens/outcome stay attributable to the project); it just loses the
-- session back-reference.
--
-- Idempotent (IF NOT EXISTS). NOT applied automatically — the founder applies it via the
-- Supabase SQL Editor. Pre-migration tolerant: createAgentRun retries the insert WITHOUT
-- session_id when the column is absent, and findActiveRun returns null on a query error,
-- so a pre-0092 DB records runs (minus the session link) and simply offers no re-attach.

alter table public.agent_runs
  add column if not exists session_id uuid references public.code_sessions(id) on delete set null;

-- The re-attach probe: newest running run for a (session, user). Partial-friendly index.
create index if not exists idx_agent_runs_session_status
  on public.agent_runs (session_id, status);
