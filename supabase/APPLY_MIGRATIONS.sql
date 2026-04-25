-- ============================================================
-- GOBLIN — Combined Migration Script
-- Paste this into: Supabase Dashboard > SQL Editor > New query
-- Run as a single block. Safe to re-run (IF NOT EXISTS guards).
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0001: Extensions
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- 0001: Users
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
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

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 0001: BYOK Keys
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS byok_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT CHECK (provider IN ('anthropic', 'openai', 'together', 'fireworks', 'mistral', 'xai', 'deepseek', 'groq')) NOT NULL,
  label TEXT,
  key_encrypted BYTEA NOT NULL,
  status TEXT CHECK (status IN ('active', 'expired', 'revoked')) DEFAULT 'active',
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE byok_keys ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='byok_keys' AND policyname='Users can manage own BYOK keys'
  ) THEN
    CREATE POLICY "Users can manage own BYOK keys" ON byok_keys FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 0001: Projects
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
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

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='Users can manage own projects'
  ) THEN
    CREATE POLICY "Users can manage own projects" ON projects FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 0001: Chat Messages
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'assistant', 'system')) NOT NULL,
  content TEXT NOT NULL,
  model_used TEXT,
  source_tier TEXT CHECK (source_tier IN ('goblin_hosted', 'free_api', 'byok')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='chat_messages' AND policyname='Users can manage own chat messages'
  ) THEN
    CREATE POLICY "Users can manage own chat messages" ON chat_messages
      FOR ALL USING (
        EXISTS (SELECT 1 FROM projects WHERE projects.id = chat_messages.project_id AND projects.user_id = auth.uid())
      );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 0001: Agent Runs
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_runs (
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

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='agent_runs' AND policyname='Users can view own agent runs'
  ) THEN
    CREATE POLICY "Users can view own agent runs" ON agent_runs FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 0001: Indexes
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_projects_user_last_active ON projects(user_id, last_active DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_project_created ON chat_messages(project_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_user_created ON agent_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_byok_keys_user_status ON byok_keys(user_id, status);

-- ─────────────────────────────────────────────────────────────
-- 0001: Auth trigger (auto-create user profile on signup)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 0002: Storage bucket
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('project-files', 'project-files', false, 52428800, ARRAY['text/*', 'application/json', 'image/*'])
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 0003: GitHub columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_access_token_encrypted BYTEA;
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_connected_at TIMESTAMPTZ;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='Users can read their own github profile'
  ) THEN
    CREATE POLICY "Users can read their own github profile" ON users FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 0004: Missing columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS monthly_limit INTEGER DEFAULT 200;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('idle', 'generating', 'ready', 'generation_failed')) DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS last_generated TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS run_type TEXT CHECK (run_type IN ('chat', 'generate_project', 'edit_file', 'deploy', 'project_generation')) DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS error TEXT;

CREATE INDEX IF NOT EXISTS idx_users_stripe_sub ON users(stripe_subscription_id);

-- ─────────────────────────────────────────────────────────────
-- 0005: Atomic increment function
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_request_count(user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET monthly_requests_used = monthly_requests_used + 1
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- 0006: Fix storage RLS
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can access their own project files" ON storage.objects;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Users can read own project files'
  ) THEN
    CREATE POLICY "Users can read own project files"
    ON storage.objects FOR SELECT
    USING (
      bucket_id = 'project-files'
      AND (storage.foldername(name))[1]::uuid IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Users can insert own project files'
  ) THEN
    CREATE POLICY "Users can insert own project files"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'project-files'
      AND (storage.foldername(name))[1]::uuid IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 0007: OAuth states table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

-- ─────────────────────────────────────────────────────────────
-- 0008: Free API usage tracking
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS free_api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER DEFAULT 0,
  UNIQUE(provider, date)
);

CREATE OR REPLACE FUNCTION increment_free_api_usage(p_provider TEXT)
RETURNS TABLE(request_count INTEGER, daily_limit INTEGER) AS $$
DECLARE
  v_count INTEGER;
  v_limit INTEGER;
BEGIN
  INSERT INTO free_api_usage (provider, date, request_count)
  VALUES (p_provider, CURRENT_DATE, 1)
  ON CONFLICT (provider, date)
  DO UPDATE SET request_count = free_api_usage.request_count + 1
  RETURNING free_api_usage.request_count INTO v_count;

  v_limit := CASE p_provider
    WHEN 'gemini' THEN 1500
    WHEN 'groq' THEN 14000
    ELSE 100
  END;

  RETURN QUERY SELECT v_count, v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE INDEX IF NOT EXISTS idx_free_api_usage_provider_date ON free_api_usage(provider, date);

-- ─────────────────────────────────────────────────────────────
-- 0010: Analytics view
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW analytics_summary AS
SELECT
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT COUNT(DISTINCT user_id) FROM agent_runs WHERE created_at > now() - interval '7 days') as active_users_7d,
  (SELECT COUNT(*) FROM agent_runs WHERE status = 'success') as total_successful_runs,
  (SELECT COUNT(*) FROM agent_runs WHERE status = 'failed') as total_failed_runs,
  (SELECT COUNT(*) FROM projects) as total_projects,
  (SELECT COUNT(*) FROM users WHERE plan = 'seed') as seed_users,
  (SELECT COUNT(*) FROM users WHERE plan = 'craft') as craft_users,
  (SELECT COUNT(*) FROM users WHERE plan = 'forge') as forge_users;

-- ─────────────────────────────────────────────────────────────
-- VERIFY: Show created tables
-- ─────────────────────────────────────────────────────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
