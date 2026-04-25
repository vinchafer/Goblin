CREATE TABLE oauth_states (
  state TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes')
);

-- Auto-cleanup of expired states
CREATE INDEX idx_oauth_states_expires ON oauth_states(expires_at);