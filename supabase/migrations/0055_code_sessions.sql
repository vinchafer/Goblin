-- Sprint 7: Multi-session Code Tab.
-- A Session = a chat-thread + a work surface, scoped to a project, with its own model.
-- A project holds several sessions in parallel. Each session owns a thread of messages
-- and a set of draft/saved files (the change-state machine Entwurf → Gesichert → Veröffentlicht).
--
-- Idempotent (CREATE TABLE IF NOT EXISTS, drop-then-create policies). Safe to re-run.
-- Service-role API (getSupabaseAdmin) bypasses RLS; policies are defense-in-depth so a
-- leaked anon/user token can only ever reach its own rows. user_id denormalized onto
-- child tables to keep RLS predicates simple (no cross-table subqueries).

-- ─── code_sessions ──────────────────────────────────────────────────────────────
create table if not exists public.code_sessions (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id)  on delete cascade,
  user_id     uuid not null references auth.users(id)       on delete cascade,
  name        text not null default 'Neue Session',
  model_id    text,                       -- references a model slug (models.slug); nullable = inherit default
  state       text not null default 'active'
              check (state in ('active', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_code_sessions_project
  on public.code_sessions(project_id, state, updated_at desc);
create index if not exists idx_code_sessions_user
  on public.code_sessions(user_id, updated_at desc);

-- ─── code_session_messages (the thread) ─────────────────────────────────────────
create table if not exists public.code_session_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.code_sessions(id) on delete cascade,
  user_id     uuid not null references auth.users(id)           on delete cascade,
  role        text not null check (role in ('user', 'assistant', 'system')),
  content     text not null default '',
  model_used  text,                       -- model that produced an assistant turn
  state       text not null default 'complete'
              check (state in ('streaming', 'complete', 'error')),
  created_at  timestamptz not null default now()
);

create index if not exists idx_code_session_messages_session
  on public.code_session_messages(session_id, created_at asc);

-- ─── code_session_files (draft → saved → deployed) ──────────────────────────────
create table if not exists public.code_session_files (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.code_sessions(id) on delete cascade,
  user_id       uuid not null references auth.users(id)           on delete cascade,
  path          text not null,
  content       text not null default '',
  change_state  text not null default 'draft'
                check (change_state in ('draft', 'saved', 'deployed')),
  updated_at    timestamptz not null default now(),
  unique (session_id, path)
);

create index if not exists idx_code_session_files_session
  on public.code_session_files(session_id, change_state);

-- ─── RLS ────────────────────────────────────────────────────────────────────────
alter table public.code_sessions          enable row level security;
alter table public.code_session_messages  enable row level security;
alter table public.code_session_files     enable row level security;

drop policy if exists "own code sessions" on public.code_sessions;
create policy "own code sessions"
  on public.code_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own code session messages" on public.code_session_messages;
create policy "own code session messages"
  on public.code_session_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own code session files" on public.code_session_files;
create policy "own code session files"
  on public.code_session_files for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
