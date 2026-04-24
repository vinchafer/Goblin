-- Add GitHub connection fields to users table
ALTER TABLE users
ADD COLUMN github_username TEXT,
ADD COLUMN github_access_token_encrypted BYTEA,
ADD COLUMN github_connected_at TIMESTAMPTZ;

-- RLS policy for github_username
CREATE POLICY "Users can read their own github profile"
ON users
FOR SELECT
USING (auth.uid() = id);