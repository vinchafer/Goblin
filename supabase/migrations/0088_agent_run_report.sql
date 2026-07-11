-- A-6 (WAVE-A, stop-report fix): persist the orchestrator's final report card on the
-- run row so it survives a client abort.
--
-- Root cause (FEEL-3a finding): the agent_report frame is emitted over SSE at the end of
-- the loop. When the user hits stop, the client aborts the fetch and the SSE closes, so
-- the client never receives that frame — the partial report renders "only by luck". The
-- server still finishes the loop (outcome 'stopped') and assembles a truthful partial
-- report; we now STORE it here, and the client re-fetches it via REST after aborting.
--
-- report jsonb = the full ReportCard (state, files[], unitsConsumed, modelText, followUps,
-- publishedUrl, failureReason). Nullable — pre-migration rows and runs that never reached
-- finalize stay NULL. The API write is pre-migration tolerant: finalizeAgentRun retries
-- the update WITHOUT this column when it is absent, so a pre-0088 DB never drops the run.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS). NOT applied automatically — founder applies via
-- the Supabase SQL Editor.

alter table public.agent_runs
  add column if not exists report jsonb;
