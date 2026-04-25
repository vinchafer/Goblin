-- Add missing columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS monthly_limit INTEGER DEFAULT 200;

-- Add missing columns to projects table
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('idle', 'generating', 'ready', 'generation_failed')) DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS last_generated TIMESTAMPTZ;

-- Add missing columns to agent_runs table
ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS run_type TEXT CHECK (run_type IN ('chat', 'generate_project', 'edit_file', 'deploy')) DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS error TEXT;

-- Index for subscription lookups in webhook handler
CREATE INDEX IF NOT EXISTS idx_users_stripe_sub ON users(stripe_subscription_id);