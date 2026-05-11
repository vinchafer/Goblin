-- ============================================================
-- GOBLIN — Session Migrations 2026-05-11
-- Apply in Supabase Studio → SQL Editor
-- All statements are idempotent (IF NOT EXISTS / DO $$ ... $$)
-- ============================================================

-- ── Migration 0028: BYOK label + validation_error ──────────────────────────
ALTER TABLE byok_keys ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE byok_keys ADD COLUMN IF NOT EXISTS validation_error TEXT;

-- ── Migration 0029: Project storage_path ────────────────────────────────────
ALTER TABLE projects ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- ── Migration 0030: Cloud trial tracking ────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS cloud_trial_started_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cloud_trial_ends_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_extension_used BOOLEAN DEFAULT FALSE;

-- ── Migration 0031: Onboarding wizard state ─────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  goal TEXT,
  ai_provider_choice TEXT,
  code_hosting_choice TEXT,
  deploy_choice TEXT,
  skipped_steps INTEGER[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'onboarding_steps' AND policyname = 'Users manage own onboarding'
  ) THEN
    ALTER TABLE onboarding_steps ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users manage own onboarding" ON onboarding_steps
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── Done ────────────────────────────────────────────────────────────────────
-- After running: verify with:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'byok_keys' AND column_name IN ('label', 'validation_error');
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'storage_path';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('cloud_trial_started_at', 'cloud_trial_ends_at');
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'onboarding_steps';
