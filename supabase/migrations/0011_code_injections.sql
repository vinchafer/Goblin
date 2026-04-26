-- code_injections table for "Send to Code" feature
CREATE TABLE IF NOT EXISTS code_injections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  payload TEXT NOT NULL,
  payload_type TEXT CHECK (payload_type IN ('code', 'prompt', 'mixed')) NOT NULL DEFAULT 'code',
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_code_injections_project ON code_injections(project_id, applied_at);
CREATE INDEX IF NOT EXISTS idx_code_injections_user ON code_injections(user_id);