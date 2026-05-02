-- Performance indexes for frequently queried columns

-- chat_messages: most queries filter by project_id
CREATE INDEX IF NOT EXISTS idx_chat_messages_project
  ON chat_messages(project_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created
  ON chat_messages(created_at DESC);

-- code_injections: filter by project_id
CREATE INDEX IF NOT EXISTS idx_code_injections_project
  ON code_injections(project_id);

CREATE INDEX IF NOT EXISTS idx_code_injections_status
  ON code_injections(status);

-- byok_keys: all queries filter by user_id
CREATE INDEX IF NOT EXISTS idx_byok_keys_user
  ON byok_keys(user_id);

CREATE INDEX IF NOT EXISTS idx_byok_keys_provider
  ON byok_keys(user_id, provider);

-- projects: user_id + last_active ordering
CREATE INDEX IF NOT EXISTS idx_projects_user_active
  ON projects(user_id, last_active DESC);

-- build_runs: project + status for polling
CREATE INDEX IF NOT EXISTS idx_build_runs_project_status
  ON build_runs(project_id, status);

CREATE INDEX IF NOT EXISTS idx_build_runs_user_created
  ON build_runs(user_id, created_at DESC);

-- users: stripe lookups
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer
  ON users(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription
  ON users(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- free_api_usage: user + provider lookups
CREATE INDEX IF NOT EXISTS idx_free_api_usage_user_provider
  ON free_api_usage(user_id, provider);
