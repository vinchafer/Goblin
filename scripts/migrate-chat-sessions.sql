-- Chat sessions (standalone, kein Projekt nötig)
CREATE TABLE IF NOT EXISTS chat_sessions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id   UUID REFERENCES projects(id) ON DELETE CASCADE,  -- NULL = standalone chat
  title        TEXT,
  model_slug   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Messages für chat_sessions (project chats nutzen chat_messages)
CREATE TABLE IF NOT EXISTS standalone_messages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id  UUID REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     TEXT NOT NULL,
  has_code    BOOLEAN DEFAULT false NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated ON chat_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_standalone_messages_session ON standalone_messages(session_id, created_at ASC);

-- RLS
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE standalone_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own chat sessions" ON chat_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own standalone messages" ON standalone_messages
  FOR ALL USING (
    session_id IN (SELECT id FROM chat_sessions WHERE user_id = auth.uid())
  );
