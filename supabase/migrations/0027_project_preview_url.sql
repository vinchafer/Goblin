-- Preview URL + deploy timestamp on projects (migrated from startup-migrations.ts)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS preview_url      TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_deployed_at TIMESTAMPTZ;
