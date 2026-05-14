-- Phase Z3.5: Project Secrets Management (all plans equal)

CREATE TABLE IF NOT EXISTS project_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value_encrypted TEXT NOT NULL,
  value_hint TEXT,          -- last 4 chars only
  environment TEXT NOT NULL DEFAULT 'production',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, name, environment)
);

CREATE INDEX IF NOT EXISTS idx_project_secrets_project ON project_secrets(project_id);
CREATE INDEX IF NOT EXISTS idx_project_secrets_user ON project_secrets(user_id);

ALTER TABLE project_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own project secrets" ON project_secrets;
CREATE POLICY "Users manage own project secrets" ON project_secrets
  FOR ALL USING (auth.uid() = user_id);
