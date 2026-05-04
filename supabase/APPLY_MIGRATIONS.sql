-- ============================================================
-- GOBLIN — Complete Database Setup (Migrations 0001–0021)
-- Paste into: Supabase Dashboard → SQL Editor → New query
-- Run as a single block. Safe to re-run (IF NOT EXISTS guards).
-- Last updated: 2026-05-04
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- 0001: Users
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                           TEXT UNIQUE NOT NULL,
  plan                            TEXT CHECK (plan IN ('seed', 'craft', 'forge')) DEFAULT 'seed',
  stripe_customer_id              TEXT,
  stripe_subscription_id          TEXT,
  subscription_current_period_end TIMESTAMPTZ,
  monthly_requests_used           INTEGER DEFAULT 0,
  monthly_requests_limit          INTEGER DEFAULT 200,
  monthly_limit                   INTEGER DEFAULT 200,
  billing_cycle_start             TIMESTAMPTZ DEFAULT now(),
  github_username                 TEXT,
  github_access_token_encrypted   BYTEA,
  github_connected_at             TIMESTAMPTZ,
  is_admin                        BOOLEAN DEFAULT false,
  created_at                      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='Users can view own profile') THEN
    CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='Users can update own profile') THEN
    CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 0001: BYOK Keys
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS byok_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  label         TEXT,
  key_encrypted BYTEA NOT NULL,
  status        TEXT CHECK (status IN ('active', 'expired', 'revoked')) DEFAULT 'active',
  last_used     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 0013: Expand provider constraint to all v6 providers
ALTER TABLE byok_keys DROP CONSTRAINT IF EXISTS byok_keys_provider_check;
ALTER TABLE byok_keys ADD CONSTRAINT byok_keys_provider_check
  CHECK (provider IN ('anthropic', 'openai', 'google', 'groq', 'mistral', 'deepseek', 'xai', 'together', 'fireworks'));

ALTER TABLE byok_keys ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='byok_keys' AND policyname='Users can manage own BYOK keys') THEN
    CREATE POLICY "Users can manage own BYOK keys" ON byok_keys FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 0001: Projects
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  color            TEXT DEFAULT '#D4A94A',
  github_repo      TEXT,
  model_preferences JSONB DEFAULT '{}',
  status           TEXT CHECK (status IN ('idle', 'generating', 'ready', 'generation_failed')) DEFAULT 'idle',
  last_active      TIMESTAMPTZ DEFAULT now(),
  last_generated   TIMESTAMPTZ,
  last_deployed_at TIMESTAMPTZ,
  storage_path     TEXT,
  preview_url      TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='Users can manage own projects') THEN
    CREATE POLICY "Users can manage own projects" ON projects FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 0001: Chat Messages
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role        TEXT CHECK (role IN ('user', 'assistant', 'system')) NOT NULL,
  content     TEXT NOT NULL,
  model_used  TEXT,
  source_tier TEXT CHECK (source_tier IN ('goblin_hosted', 'free_api', 'byok')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chat_messages' AND policyname='Users can manage own chat messages') THEN
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
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  model_used        TEXT,
  source_tier       TEXT CHECK (source_tier IN ('goblin_hosted', 'free_api', 'byok')),
  run_type          TEXT CHECK (run_type IN ('chat', 'generate_project', 'edit_file', 'deploy', 'project_generation')) DEFAULT 'chat',
  input_tokens      INTEGER,
  output_tokens     INTEGER,
  cost_usd_internal NUMERIC(10, 6),
  status            TEXT CHECK (status IN ('pending', 'running', 'success', 'failed')) NOT NULL,
  error             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  completed_at      TIMESTAMPTZ
);

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='agent_runs' AND policyname='Users can view own agent runs') THEN
    CREATE POLICY "Users can view own agent runs" ON agent_runs FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 0007: OAuth States
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oauth_states (
  state      TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes')
);

-- ─────────────────────────────────────────────────────────────
-- 0008: Free API Usage Tracking
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS free_api_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      TEXT NOT NULL,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER DEFAULT 0,
  UNIQUE(provider, date)
);

-- ─────────────────────────────────────────────────────────────
-- 0009/0019: Models (0019 is authoritative — TEXT PK, full seed)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS models (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  provider    TEXT NOT NULL,
  layer       TEXT NOT NULL DEFAULT 'byok',
  description TEXT,
  tags        TEXT[] DEFAULT '{}',
  requires_key BOOLEAN DEFAULT true,
  available   BOOLEAN DEFAULT true,
  phase       INTEGER DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE models ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='models' AND policyname='Models are publicly readable') THEN
    CREATE POLICY "Models are publicly readable" ON models FOR SELECT USING (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 0011: Code Injections
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS code_injections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  message_id        UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  payload           TEXT NOT NULL,
  payload_type      TEXT CHECK (payload_type IN ('code', 'prompt', 'mixed')) NOT NULL DEFAULT 'code',
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename_hint     TEXT,
  previous_content  TEXT,
  applied_file_path TEXT,
  applied_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE code_injections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='code_injections' AND policyname='Users can manage own code injections') THEN
    CREATE POLICY "Users can manage own code injections" ON code_injections
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 0012/0015: Push Subscriptions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  keys       JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='push_subscriptions' AND policyname='Users manage own subscriptions') THEN
    CREATE POLICY "Users manage own subscriptions" ON push_subscriptions
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 0017: Build Runs
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS build_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  progress_pct INTEGER DEFAULT 0,
  message      TEXT,
  preview_url  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE build_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='build_runs' AND policyname='Users can manage own build runs') THEN
    CREATE POLICY "Users can manage own build runs" ON build_runs
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 0020: Templates
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL,
  description  TEXT,
  category     TEXT CHECK (category IN ('saas','landing','api','tool','blog','ecommerce')),
  tags         TEXT[] DEFAULT '{}',
  preview_url  TEXT,
  thumbnail_url TEXT,
  author_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_official  BOOLEAN NOT NULL DEFAULT false,
  is_public    BOOLEAN NOT NULL DEFAULT true,
  downloads    INTEGER NOT NULL DEFAULT 0,
  files        JSONB NOT NULL DEFAULT '{}',
  tech_stack   TEXT[] DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='templates' AND policyname='Public templates are readable by everyone') THEN
    CREATE POLICY "Public templates are readable by everyone" ON templates FOR SELECT USING (is_public = true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='templates' AND policyname='Authors can update own templates') THEN
    CREATE POLICY "Authors can update own templates" ON templates FOR UPDATE USING (auth.uid() = author_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='templates' AND policyname='Authors can insert templates') THEN
    CREATE POLICY "Authors can insert templates" ON templates FOR INSERT WITH CHECK (auth.uid() = author_id OR author_id IS NULL);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS templates_updated_at ON templates;
CREATE TRIGGER templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_templates_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 0002: Storage Bucket
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('project-files', 'project-files', false, 52428800, ARRAY['text/*', 'application/json', 'image/*'])
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Users can read own project files') THEN
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Users can insert own project files') THEN
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
-- 0001: Auth Trigger — auto-create user profile on signup
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
-- 0005: Atomic request counter
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
-- 0008: Free API usage increment function
-- ─────────────────────────────────────────────────────────────
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
    WHEN 'groq'   THEN 14000
    ELSE 100
  END;

  RETURN QUERY SELECT v_count, v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- 0010: Analytics view
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW analytics_summary AS
SELECT
  (SELECT COUNT(*) FROM users)                                                                           AS total_users,
  (SELECT COUNT(DISTINCT user_id) FROM agent_runs WHERE created_at > now() - interval '7 days')         AS active_users_7d,
  (SELECT COUNT(*) FROM agent_runs WHERE status = 'success')                                             AS total_successful_runs,
  (SELECT COUNT(*) FROM agent_runs WHERE status = 'failed')                                              AS total_failed_runs,
  (SELECT COUNT(*) FROM projects)                                                                         AS total_projects,
  (SELECT COUNT(*) FROM users WHERE plan = 'seed')                                                       AS seed_users,
  (SELECT COUNT(*) FROM users WHERE plan = 'craft')                                                      AS craft_users,
  (SELECT COUNT(*) FROM users WHERE plan = 'forge')                                                      AS forge_users;

-- ─────────────────────────────────────────────────────────────
-- 0019: Seed models
-- ─────────────────────────────────────────────────────────────
INSERT INTO models (id, name, slug, provider, layer, description, tags, requires_key, available, phase) VALUES
  -- Anthropic
  ('claude-opus-4-5',   'Claude Opus 4.5',   'anthropic/claude-opus-4-5',   'anthropic', 'byok', 'Most powerful Claude. Best for complex reasoning.',   ARRAY['reasoning','coding','powerful'],   true,  true,  1),
  ('claude-sonnet-4-6', 'Claude Sonnet 4.6', 'anthropic/claude-sonnet-4-6', 'anthropic', 'byok', 'Fast, highly capable. Best for most coding tasks.',   ARRAY['coding','fast','balanced'],        true,  true,  1),
  ('claude-haiku-4-5',  'Claude Haiku 4.5',  'anthropic/claude-haiku-4-5',  'anthropic', 'byok', 'Fastest, cheapest Claude.',                           ARRAY['fast','cheap'],                    true,  true,  1),
  -- OpenAI
  ('gpt-4o',            'GPT-4o',            'openai/gpt-4o',               'openai',    'byok', 'OpenAI flagship. Strong at code and instruction following.', ARRAY['coding','fast','balanced'], true,  true,  1),
  ('gpt-4o-mini',       'GPT-4o Mini',       'openai/gpt-4o-mini',          'openai',    'byok', 'Small, fast, cheap.',                                 ARRAY['fast','cheap'],                    true,  true,  1),
  ('o1',                'o1',                'openai/o1',                   'openai',    'byok', 'Extended reasoning model.',                           ARRAY['reasoning','powerful'],            true,  true,  1),
  ('o3-mini',           'o3-mini',           'openai/o3-mini',              'openai',    'byok', 'Efficient reasoning model.',                          ARRAY['reasoning','fast'],                true,  true,  1),
  -- Google
  ('gemini-2.0-flash',  'Gemini 2.0 Flash',  'gemini/gemini-2.0-flash',     'google',    'byok', 'Very fast. Great for quick iterations.',              ARRAY['fast'],                            true,  true,  1),
  ('gemini-1.5-pro',    'Gemini 1.5 Pro',    'gemini/gemini-1.5-pro',       'google',    'byok', 'Long context (1M tokens).',                           ARRAY['long-context','coding'],           true,  true,  1),
  -- Groq
  ('llama-3.3-70b',     'Llama 3.3 70B',     'groq/llama-3.3-70b-versatile','groq',      'byok', 'Extremely fast via Groq inference.',                  ARRAY['fast','coding','open-source'],     true,  true,  1),
  ('mixtral-8x7b',      'Mixtral 8x7B',      'groq/mixtral-8x7b-32768',     'groq',      'byok', 'Fast and multilingual.',                              ARRAY['fast','multilingual'],             true,  true,  1),
  -- Mistral
  ('mistral-large',     'Mistral Large',     'mistral/mistral-large-latest','mistral',   'byok', 'Flagship Mistral. Strong multilingual support.',      ARRAY['multilingual','coding'],           true,  true,  1),
  ('mistral-small',     'Mistral Small',     'mistral/mistral-small-latest','mistral',   'byok', 'Cost-effective for most tasks.',                      ARRAY['fast','cheap'],                    true,  true,  1),
  -- xAI
  ('grok-3',            'Grok 3',            'xai/grok-3',                  'xai',       'byok', 'Latest Grok. Powerful reasoning.',                    ARRAY['reasoning','knowledge'],           true,  true,  1),
  ('grok-3-mini',       'Grok 3 Mini',       'xai/grok-3-mini',             'xai',       'byok', 'Compact Grok. Fast and cost-effective.',              ARRAY['fast','cheap'],                    true,  true,  1),
  -- DeepSeek
  ('deepseek-v3',       'DeepSeek V3',       'deepseek/deepseek-chat',      'deepseek',  'byok', 'Best price/performance for coding.',                  ARRAY['coding','cheap','fast'],           true,  true,  1),
  ('deepseek-r1',       'DeepSeek R1',       'deepseek/deepseek-reasoner',  'deepseek',  'byok', 'Chain-of-thought reasoning.',                         ARRAY['reasoning','open-source'],         true,  true,  1),
  -- Together
  ('llama-3.3-70b-turbo','Llama 3.3 70B (Together)','together_ai/meta-llama/Llama-3.3-70B-Instruct-Turbo','together','byok','Open-source 70B via Together AI.',ARRAY['open-source','coding'], true,  true,  1),
  -- Fireworks
  ('llama-v3p3-70b',    'Llama 3.3 70B (Fireworks)','fireworks_ai/accounts/fireworks/models/llama-v3p3-70b-instruct','fireworks','byok','Fast open-source 70B via Fireworks.',ARRAY['fast','open-source','coding'],true,true,1),
  -- Free API
  ('gemini-2.0-flash-free','Gemini 2.0 Flash','free/gemini-flash',          'google',    'free_api','Fast, generous free tier. No key required.',      ARRAY['fast','free'],                     false, true,  1),
  ('llama-3.3-70b-free','Llama 3.3 70B',     'free/llama-70b',              'groq',      'free_api','Extremely fast inference. Free tier available.',  ARRAY['fast','free','coding'],            false, true,  1)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  slug        = EXCLUDED.slug,
  description = EXCLUDED.description,
  tags        = EXCLUDED.tags,
  available   = EXCLUDED.available;

-- ─────────────────────────────────────────────────────────────
-- 0021: Performance indexes
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_projects_user_last_active        ON projects(user_id, last_active DESC);
CREATE INDEX IF NOT EXISTS idx_projects_user_active             ON projects(user_id, last_active DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_project_created    ON chat_messages(project_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_project            ON chat_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created            ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_user_created          ON agent_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_byok_keys_user_status            ON byok_keys(user_id, status);
CREATE INDEX IF NOT EXISTS idx_byok_keys_user                   ON byok_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_byok_keys_provider               ON byok_keys(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_code_injections_project          ON code_injections(project_id, applied_at);
CREATE INDEX IF NOT EXISTS idx_code_injections_user             ON code_injections(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires             ON oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_free_api_usage_provider_date     ON free_api_usage(provider, date);
CREATE INDEX IF NOT EXISTS idx_build_runs_project               ON build_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_build_runs_user                  ON build_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_build_runs_project_status        ON build_runs(project_id, status);
CREATE INDEX IF NOT EXISTS idx_build_runs_user_created          ON build_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_stripe_sub                 ON users(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer            ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription        ON users(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_templates_category               ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_official_public        ON templates(is_official, is_public);
CREATE INDEX IF NOT EXISTS idx_templates_downloads              ON templates(downloads DESC);

-- ─────────────────────────────────────────────────────────────
-- VERIFY: Show created tables, policies, triggers
-- ─────────────────────────────────────────────────────────────
SELECT
  t.table_name,
  COUNT(p.policyname) AS rls_policy_count
FROM information_schema.tables t
LEFT JOIN pg_policies p ON p.tablename = t.table_name
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
GROUP BY t.table_name
ORDER BY t.table_name;
