-- Trial-Activation 2026-06-25: make 'none' the neutral default plan.
--
-- ROOT BUG: users.plan defaulted to 'build' (0033) AND 'build' is a real PAID
-- plan name. So every fresh/default user looked like a paying Build customer —
-- the trial gate passed them instantly and they got full Build quota for free.
--
-- This migration introduces a neutral 'none' value (no access → paywall/gate)
-- and backfills the leaked default rows. The new API code DERIVES entitlement
-- (see apps/api/src/lib/plan-truth.ts) and expects 'none' to be a valid value,
-- so APPLY THIS AT/WITH THE DEPLOY of that code.
--
-- Idempotent: safe to run multiple times.

-- 1. Allow 'none' in the CHECK constraint (must come BEFORE any UPDATE to 'none').
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_check;
ALTER TABLE users ADD CONSTRAINT users_plan_check
  CHECK (plan IN ('none', 'trial', 'build', 'pro', 'power'));

-- 2. Neutral default for new rows.
ALTER TABLE users ALTER COLUMN plan SET DEFAULT 'none';

-- 3. Backfill the leak: rows sitting on the OLD default ('build') that never
--    actually paid → 'none'. Strictly scoped so we never touch a real paying
--    Build subscriber (stripe_subscription_id present) or a comped account.
--    Pre-launch this only matches throwaway/test accounts.
UPDATE users
   SET plan = 'none'
 WHERE plan = 'build'
   AND stripe_subscription_id IS NULL
   AND COALESCE(is_comped, false) = false;
