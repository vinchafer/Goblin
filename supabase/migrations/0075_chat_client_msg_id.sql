-- P0.5 (feel-sprint-1): client-generated message id for idempotent chat sends.
-- A retry after a lost response carries the same client_msg_id; the API skips
-- the duplicate insert and the model never sees the message twice.
-- NOT applied automatically — founder applies via Supabase SQL Editor.

alter table chat_messages
  add column if not exists client_msg_id uuid;

-- Partial unique index: only user messages carry a client id; NULLs stay free.
create unique index if not exists chat_messages_client_msg_id_uniq
  on chat_messages (project_id, client_msg_id)
  where client_msg_id is not null;

-- Same for the production chat surface (StandaloneChat → standalone_messages).
alter table standalone_messages
  add column if not exists client_msg_id uuid;

create unique index if not exists standalone_messages_client_msg_id_uniq
  on standalone_messages (session_id, client_msg_id)
  where client_msg_id is not null;
