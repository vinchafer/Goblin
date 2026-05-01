CREATE TABLE IF NOT EXISTS build_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  progress_pct INTEGER DEFAULT 0,
  message TEXT,
  preview_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_build_runs_project ON build_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_build_runs_user ON build_runs(user_id);

ALTER TABLE build_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own build runs" ON build_runs
  FOR ALL USING (auth.uid() = user_id);
