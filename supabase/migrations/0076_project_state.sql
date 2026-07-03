-- U3 (feel-sprint-2): per-project rolling memory. After each completed
-- assistant turn in a project chat, a budget-capped summarizer merges the
-- project's current state into this table; the chat system prompt injects it
-- as "Bisheriger Stand & Entscheidungen", so a NEW chat in the same project
-- can answer "Wo waren wir?" truthfully instead of inventing history.
--
-- Idempotent (CREATE TABLE IF NOT EXISTS, drop-then-create policy). Safe to
-- re-run. Service-role API bypasses RLS; the policy is defense-in-depth.
-- NOT applied automatically — founder applies via Supabase SQL Editor.

create table if not exists public.project_state (
  project_id  uuid primary key references public.projects(id) on delete cascade,
  -- Current state: what the app is, what was last changed/deployed.
  summary     text not null default '',
  -- Durable choices, e.g. "localStorage, kein Backend, deutsche UI".
  decisions   text not null default '',
  updated_at  timestamptz not null default now()
);

alter table public.project_state enable row level security;

drop policy if exists "own project state" on public.project_state;
create policy "own project state"
  on public.project_state for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_state.project_id and p.user_id = auth.uid()
    )
  );
