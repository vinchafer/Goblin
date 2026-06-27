-- Cancellation-as-paid + Trial-consumed 2026-06-26
--
-- ROOT BUG: a Pro subscriber cancelled via the Stripe portal. The portal fired
-- customer.subscription.deleted → handleSubscriptionDeleted nulled
-- stripe_subscription_id immediately → the paid rest-of-month vanished →
-- derivePlanTruth fell through to the trial branch (an OLD cloud_trial_ends_at was
-- still set) → the UI showed "Trial endet 28.06" instead of "Pro — läuft aus am …".
--
-- Two new columns close this:
--   1. cancel_at_period_end — persisted from customer.subscription.updated so a
--      cancel-at-period-end sub stays PAID (with an end date) until it truly ends.
--   2. trial_consumed_at    — stamped on the first subscription so the trial can
--      NEVER reappear for an account that has ever subscribed. After the paid
--      period ends → 'none'/locked (re-subscribe), never trial.
--
-- The new API code (apps/api/src/lib/plan-truth.ts + billing-service.ts) DERIVES
-- entitlement from these columns, so APPLY THIS AT/WITH THE DEPLOY of that code.
--
-- Idempotent: safe to run multiple times.

-- 1. New columns (nullable / defaulted → no rewrite of existing rows required).
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_consumed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;

-- 2. Backfill: any account that has ever had a Stripe customer has, by definition,
--    subscribed at least once → its trial is consumed. This stops already-churned
--    accounts (sub cancelled/deleted, sub_id null, old trial date still set) from
--    showing a resurrected "Trial" badge. Strictly additive: only stamps rows that
--    are not already stamped. Pre-launch this matches throwaway/test accounts.
UPDATE users
   SET trial_consumed_at = now()
 WHERE trial_consumed_at IS NULL
   AND stripe_customer_id IS NOT NULL;
