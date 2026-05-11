-- Cloud trial tracking for new users
ALTER TABLE users ADD COLUMN IF NOT EXISTS cloud_trial_started_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cloud_trial_ends_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_extension_used BOOLEAN DEFAULT FALSE;
