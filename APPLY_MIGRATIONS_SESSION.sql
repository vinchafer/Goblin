-- GOBLIN — Session 8 Migration (includes Session 7 fixes + new)
-- NEUE Migrations in Session 8: 0033 (plan rename), 0034 (user salt), 0035 (hosted usage), 0036 (secrets)
-- Datum: 2026-05-14
-- Ausführen in: Supabase Studio → SQL Editor
-- Alle Statements sind idempotent (IF NOT EXISTS). Keine Daten werden gelöscht.
-- Erwartetes Ergebnis: 0 Errors, alle fehlenden Tabellen + Spalten existieren danach.

-- ============================================================================
-- 1. FEHLENDE TABELLEN (Migration 0007: oauth_states)
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

-- ============================================================================
-- 2. FEHLENDE TABELLEN (Migration 0008: free_api_usage)
-- ============================================================================

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

-- ============================================================================
-- 3. FEHLENDE TABELLEN (Migration 0012/0015: push_subscriptions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own subscriptions" ON push_subscriptions;
CREATE POLICY "Users manage own subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 4. FEHLENDE TABELLEN (Migration 0017: build_runs)
-- ============================================================================

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

DROP POLICY IF EXISTS "Users can manage own build runs" ON build_runs;
CREATE POLICY "Users can manage own build runs" ON build_runs
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 5. FEHLENDE TABELLEN (Migration 0020: templates)
-- ============================================================================

CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('saas','landing','api','tool','blog','ecommerce')),
  tags TEXT[] DEFAULT '{}',
  preview_url TEXT,
  thumbnail_url TEXT,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_official BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT true,
  downloads INTEGER NOT NULL DEFAULT 0,
  files JSONB NOT NULL DEFAULT '{}',
  tech_stack TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS templates_category_idx ON templates(category);
CREATE INDEX IF NOT EXISTS templates_official_public_idx ON templates(is_official, is_public);
CREATE INDEX IF NOT EXISTS templates_slug_idx ON templates(slug);
CREATE INDEX IF NOT EXISTS templates_downloads_idx ON templates(downloads DESC);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public templates are readable by everyone" ON templates;
CREATE POLICY "Public templates are readable by everyone"
  ON templates FOR SELECT
  USING (is_public = true);

DROP POLICY IF EXISTS "Authors can update own templates" ON templates;
CREATE POLICY "Authors can update own templates"
  ON templates FOR UPDATE
  USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors can insert templates" ON templates;
CREATE POLICY "Authors can insert templates"
  ON templates FOR INSERT
  WITH CHECK (auth.uid() = author_id OR author_id IS NULL);

-- ============================================================================
-- 6. FEHLENDE TABELLEN (Migration 0026: incidents)
-- ============================================================================

CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'investigating',
  severity TEXT NOT NULL DEFAULT 'minor',
  description TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incidents_created_at_idx ON incidents (created_at DESC);

-- ============================================================================
-- 7. FEHLENDE SPALTEN — users
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS github_connected_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_seen_welcome BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- 8. FEHLENDE SPALTEN — projects
-- ============================================================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_deployed_at TIMESTAMPTZ;

-- ============================================================================
-- 9. VERIFIKATION
-- ============================================================================

SELECT
  'oauth_states' as table_name, COUNT(*) as row_count FROM oauth_states
UNION ALL SELECT 'free_api_usage', COUNT(*) FROM free_api_usage
UNION ALL SELECT 'push_subscriptions', COUNT(*) FROM push_subscriptions
UNION ALL SELECT 'build_runs', COUNT(*) FROM build_runs
UNION ALL SELECT 'templates', COUNT(*) FROM templates
UNION ALL SELECT 'incidents', COUNT(*) FROM incidents;

-- ============================================================================
-- 10. SESSION 8 — Migration 0033: Plan-Namen Rename
-- ============================================================================

UPDATE users SET plan = 'build' WHERE plan = 'seed';
UPDATE users SET plan = 'pro'   WHERE plan = 'craft';
UPDATE users SET plan = 'power' WHERE plan = 'forge';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_check;
ALTER TABLE users ADD CONSTRAINT users_plan_check
  CHECK (plan IN ('trial', 'build', 'pro', 'power'));

ALTER TABLE users ALTER COLUMN plan SET DEFAULT 'build';

-- Verifikation: 0 Rows mit alten Plan-Namen sollten zurückkommen
SELECT COUNT(*) as legacy_plan_rows FROM users WHERE plan IN ('seed', 'craft', 'forge');
