-- WAVE-J (J3): user feedback.
--
-- One row per feedback submission from the in-app Feedback affordance (chat, code,
-- Hilfe, agent report card). The user CHOOSES to send this — so the free-text
-- `body` is intentional feedback content, not silently harvested chat/file data.
--
-- PRIVACY LAW (WAVE-J): the auto-attached `context` is METADATA ONLY — current
-- page, project id, last error message string — NEVER chat content, file contents,
-- or generated code. The client shows a visible consent line listing exactly what
-- rides along, and the server re-validates that context stays scalar/bounded.
-- The whole row joins the account-deletion purge (account-deletion.ts).
-- No FK to auth.users (like platform_events) → purged explicitly.
--
-- Idempotent. NOT applied automatically — founder applies via Supabase SQL Editor.
-- API is pre-migration tolerant (silent-fail insert): until applied, feedback
-- still emits its metadata-only `feedback_submitted` event and sends the founder
-- email; it just isn't also persisted here.

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  -- 'bug' (Fehler) | 'idea' (Idee) | 'other' (Sonstiges).
  category    text not null check (category in ('bug', 'idea', 'other')),
  -- The user's free-text feedback (bounded). Intentional, user-authored content.
  body        text not null,
  -- Content-free auto-context: { page, project_id, last_error }. Scalars only.
  context     jsonb not null default '{}'::jsonb,
  -- Where the affordance was opened from (chat | code | help | report_card).
  surface     text,
  email_sent  boolean,
  created_at  timestamptz not null default now()
);

create index if not exists feedback_user_idx
  on public.feedback(user_id, created_at desc);

create index if not exists feedback_category_idx
  on public.feedback(category, created_at desc);

alter table public.feedback enable row level security;

drop policy if exists "Service role full access" on public.feedback;
create policy "Service role full access"
  on public.feedback for all
  using (auth.role() = 'service_role');
