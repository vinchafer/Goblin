-- Onboarding state tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_seen_welcome BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;

-- Manual: run in Supabase Studio if migration runner is not available
