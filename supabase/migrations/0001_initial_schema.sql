-- Goblin Initial Database Schema
-- Supabase PostgreSQL Migration

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS uuid-ossp;

-- ============================================================================
-- 1. Users Table (extends Supabase auth.users)
-- ============================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  plan TEXT CHECK (plan IN ('seed', 'craft', 'forge')) DEFAULT 'seed',
  stripe_customer_id TEXT,
  monthly_requests_used INTEGER DEFAULT 0,
  monthly_requests_limit INTEGER DEFAULT 200,
  billing_cycle_start TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- ============================================================================
-- 2. BYOK Keys Table
-- ============================================================================
CREATE TABLE byok_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT CHECK (provider IN ('anthropic', 'openai', 'together', 'fireworks')) NOT NULL,
  label TEXT,
  key_encrypted BYTEA NOT NULL,
  status TEXT CHECK (status IN ('active', 'expired', 'revoked')) DEFAULT 'active',
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE byok_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own BYOK keys" ON byok_keys
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 3. Projects Table
-- ============================================================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#D4A94A',
  github_repo TEXT,
  model_preferences JSONB DEFAULT '{}',
  last_active TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own projects" ON projects
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 4. Chat Messages Table
-- ============================================================================
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'assistant', 'system')) NOT NULL,
  content TEXT NOT NULL,
  model_used TEXT,
  source_tier TEXT CHECK (source_tier IN ('goblin_hosted', 'free_api', 'byok')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chat messages" ON chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = chat_messages.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. Agent Runs Table
-- ============================================================================
CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  model_used TEXT,
  source_tier TEXT CHECK (source_tier IN ('goblin_hosted', 'free_api', 'byok')),
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd_internal NUMERIC(10, 6),
  status TEXT CHECK (status IN ('pending', 'running', 'success', 'failed')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent runs" ON agent_runs
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX idx_projects_user_last_active ON projects(user_id, last_active DESC);
CREATE INDEX idx_chat_messages_project_created ON chat_messages(project_id, created_at ASC);
CREATE INDEX idx_agent_runs_user_created ON agent_runs(user_id, created_at DESC);
CREATE INDEX idx_byok_keys_user_status ON byok_keys(user_id, status);

-- ============================================================================
-- Supabase Auth Trigger - Auto create user profile on signup
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();