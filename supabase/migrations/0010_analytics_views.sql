-- Analytics summary view for admin dashboard
CREATE OR REPLACE VIEW analytics_summary AS
SELECT
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT COUNT(DISTINCT user_id) FROM agent_runs WHERE created_at > now() - interval '7 days') as active_users_7d,
  (SELECT COUNT(*) FROM agent_runs WHERE status = 'success') as total_successful_runs,
  (SELECT COUNT(*) FROM agent_runs WHERE status = 'failed') as total_failed_runs,
  (SELECT COUNT(*) FROM projects) as total_projects,
  (SELECT COUNT(*) FROM users WHERE plan = 'seed') as seed_users,
  (SELECT COUNT(*) FROM users WHERE plan = 'craft') as craft_users,
  (SELECT COUNT(*) FROM users WHERE plan = 'forge') as forge_users;