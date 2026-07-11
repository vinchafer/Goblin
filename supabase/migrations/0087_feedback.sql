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
-- FULLY IDEMPOTENT + SELF-UPGRADING (same pattern as 0086): safe to re-run and safe
-- when a partial/older feedback table already exists. NOT applied automatically —
-- founder applies via Supabase SQL Editor. API is pre-migration tolerant.

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,
  created_at  timestamptz not null default now()
);

alter table public.feedback add column if not exists user_id    uuid;
alter table public.feedback add column if not exists category   text not null default 'other';
alter table public.feedback add column if not exists body       text not null default '';
alter table public.feedback add column if not exists context    jsonb not null default '{}'::jsonb;
alter table public.feedback add column if not exists surface    text;
alter table public.feedback add column if not exists email_sent boolean;
alter table public.feedback add column if not exists created_at timestamptz not null default now();

-- category CHECK (guarded).
do $$ begin
  alter table public.feedback
    add constraint feedback_category_chk check (category in ('bug', 'idea', 'other'));
exception
  when duplicate_object then null;
  when others then null;
end $$;

create index if not exists feedback_user_idx
  on public.feedback(user_id, created_at desc);
create index if not exists feedback_category_idx
  on public.feedback(category, created_at desc);

alter table public.feedback enable row level security;
do $$ begin
  drop policy if exists "Service role full access" on public.feedback;
  create policy "Service role full access"
    on public.feedback for all
    using (auth.role() = 'service_role');
exception
  when others then null;
end $$;
