-- 12-3: Pin / archive / share / rename actions on chat_sessions.

alter table public.chat_sessions
  add column if not exists pinned boolean not null default false,
  add column if not exists pinned_at timestamptz,
  add column if not exists archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists share_token text,
  add column if not exists share_enabled_at timestamptz,
  add column if not exists renamed_at timestamptz;

create unique index if not exists idx_chat_sessions_share_token
  on public.chat_sessions(share_token) where share_token is not null;

create index if not exists idx_chat_sessions_user_pinned
  on public.chat_sessions(user_id, pinned, archived, updated_at desc)
  where archived = false;
