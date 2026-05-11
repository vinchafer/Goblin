-- Onboarding wizard state persistence
CREATE TABLE IF NOT EXISTS onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  goal TEXT,
  ai_provider_choice TEXT,  -- 'byok' | 'no_key' | 'free_tier'
  code_hosting_choice TEXT, -- 'github' | 'goblin_cloud'
  deploy_choice TEXT,       -- 'vercel' | 'preview_only' | 'skip'
  skipped_steps INTEGER[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS
ALTER TABLE onboarding_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own onboarding" ON onboarding_steps FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
