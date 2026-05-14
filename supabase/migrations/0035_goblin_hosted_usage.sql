-- Phase Z3: Goblin-Hosted Fair-Use Tracking

CREATE TABLE IF NOT EXISTS goblin_hosted_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  month TEXT NOT NULL, -- 'YYYY-MM' format
  call_count INTEGER DEFAULT 0,
  last_call_at TIMESTAMPTZ,
  UNIQUE(user_id, month)
);

CREATE INDEX IF NOT EXISTS idx_goblin_hosted_usage_user_month ON goblin_hosted_usage(user_id, month);

ALTER TABLE goblin_hosted_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own hosted usage" ON goblin_hosted_usage;
CREATE POLICY "Users see own hosted usage" ON goblin_hosted_usage
  FOR SELECT USING (auth.uid() = user_id);
