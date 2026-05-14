-- Phase Z1: Rename plans seed→build, craft→pro, forge→power
-- Idempotent: safe to run multiple times

-- 1. Migrate existing user data
UPDATE users SET plan = 'build' WHERE plan = 'seed';
UPDATE users SET plan = 'pro'   WHERE plan = 'craft';
UPDATE users SET plan = 'power' WHERE plan = 'forge';

-- 2. Update CHECK constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_check;
ALTER TABLE users ADD CONSTRAINT users_plan_check
  CHECK (plan IN ('trial', 'build', 'pro', 'power'));

-- 3. Update default value
ALTER TABLE users ALTER COLUMN plan SET DEFAULT 'build';
