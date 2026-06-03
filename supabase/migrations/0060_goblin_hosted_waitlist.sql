-- 0060_goblin_hosted_waitlist.sql
-- Sprint 10.5 A-S6: capture interest in Layer 2 (Goblin-Hosted models, Q1 2027)
-- from the onboarding "How Goblin works" step.

CREATE TABLE IF NOT EXISTS goblin_hosted_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- One row per user is enough; re-joining is idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS goblin_hosted_waitlist_user_id_key
  ON goblin_hosted_waitlist (user_id)
  WHERE user_id IS NOT NULL;
