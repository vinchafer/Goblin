-- 0065 — standalone chat persistence (Sprint 10.11 Phase 0, CRITICAL)
--
-- ROOT CAUSE: chat_sessions + standalone_messages were defined only in the
-- manual scripts/migrate-chat-sessions.sql (10.7), never promoted to a formal
-- migration. chat_sessions reached prod; standalone_messages did NOT. Result:
-- every insert/select in routes/chat-sessions.ts failed silently (errors are
-- not checked), so chatHistory was [] on every turn → the model had ZERO
-- conversation memory ("make the heading bigger" → "which heading?"). This is
-- the founder-reported "no conversation is built up" bug.
--
-- Idempotent: safe to re-run. chat_sessions is created here too (IF NOT EXISTS)
-- so a clean DB gets both; existing prod chat_sessions is untouched.

CREATE TABLE IF NOT EXISTS chat_sessions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id   UUID REFERENCES projects(id) ON DELETE CASCADE,  -- NULL = standalone chat
  title        TEXT,
  model_slug   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS standalone_messages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id  UUID REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     TEXT NOT NULL,
  has_code    BOOLEAN DEFAULT false NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated ON chat_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_standalone_messages_session ON standalone_messages(session_id, created_at ASC);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE standalone_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own chat sessions" ON chat_sessions;
CREATE POLICY "Users own chat sessions" ON chat_sessions
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own standalone messages" ON standalone_messages;
CREATE POLICY "Users own standalone messages" ON standalone_messages
  FOR ALL USING (
    session_id IN (SELECT id FROM chat_sessions WHERE user_id = auth.uid())
  );
