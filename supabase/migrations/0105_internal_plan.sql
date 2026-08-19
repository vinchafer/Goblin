-- ═══════════════════════════════════════════════════════════════════════════════
-- 0105 — THE NAMED INTERNAL PLAN ('internal')
-- Founder-Ops access without a Stripe subscription. 2026-08-20.
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- WHY THIS EXISTS. Founder-Ops needs permanent full access to the product without a
-- Stripe subscription. Two shapes were rejected before this one:
--
--   • an e-mail allowlist in the API (like OPS_FOUNDER_ACCOUNTS for the ops plane) —
--     the entitlement would then live in an env var, invisible in the database, and
--     `users.plan` would keep saying something untrue about the account;
--   • "no plan = unlimited" — a fail-OPEN default. Every existing limit in this
--     product fails safe (goblin-cap.ts GOBLIN_DEFAULT_ALLOWANCE = trial floor,
--     storage-cap.ts STORAGE_DEFAULT_LIMIT = 0). Making absence mean abundance would
--     invert that for every unresolvable row, not just the founder's.
--
-- So the access is a PLAN, with a name and explicit numbers, exactly like the paid
-- plans — just not sold. `users.plan = 'internal'` is the whole grant: readable in
-- Studio, revocable with one UPDATE, and derived by the same single function every
-- other entitlement goes through (apps/api/src/lib/plan-truth.ts derivePlanTruth).
--
-- WHAT IT IS NOT. It is NOT comped. `is_comped` already grants 'power'-level access
-- (0048, and 0098 turned it into the promo-grant mechanism with an expiry). Reusing it
-- for the founder would have made permanent internal access indistinguishable from an
-- expiring promo grant in every read, report and admin list. The two are different
-- facts and now have different values.
--
-- THE LIMITS ARE EXPLICIT AND FINITE — see apps/api/src/lib/goblin-cap.ts
-- (GOBLIN_MONTHLY_ALLOWANCE.internal / GOBLIN_DAILY_GUARD.internal) and
-- apps/api/src/lib/storage-cap.ts (STORAGE_LIMIT_BYTES.internal). "Full access" here
-- means "above every paid plan", not "uncapped": a runaway loop on the founder's own
-- account still hits a ceiling, and the ledger can still put a number on it.
--
-- ── APPLY ORDER ───────────────────────────────────────────────────────────────
-- PART 1 (the plan) is safe to apply on its own and grants NOBODY anything — it only
-- widens a CHECK constraint. PART 2 (the assignment) is the actual grant and is kept
-- separate on purpose, so applying the schema and handing out the access are two
-- deliberate acts.
--
-- The API code is PRE-MIGRATION TOLERANT: it reads only the long-existing `users.plan`
-- column, so before this file is applied nothing changes (the constraint rejects the
-- value, no row can hold it, the 'internal' branch is unreachable) and after it is
-- applied the branch goes live. Nothing needs to be deployed in a particular order.
--
-- Idempotent: safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── PART 1 — the plan itself (schema only; grants nobody anything) ─────────────
--
-- Adds 'internal' to the allowed set from 0070. Every other value and the DEFAULT
-- ('none', set in 0070) are carried over UNCHANGED — this migration must not move a
-- single existing user between plans.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_check;
ALTER TABLE users ADD CONSTRAINT users_plan_check
  CHECK (plan IN ('none', 'trial', 'build', 'pro', 'power', 'internal'));

COMMENT ON COLUMN users.plan IS
  'Plan key. Paid: build|pro|power (written by the Stripe webhook). none = neutral '
  'default (no access). trial = legacy/unused as a stored value (the trial is derived '
  'from cloud_trial_ends_at). internal = named Founder-Ops plan, granted by hand in '
  'PART 2 of migration 0105, never by Stripe. Entitlement is DERIVED from this column '
  'plus is_comped / stripe_subscription_id / cloud_trial_ends_at — see '
  'apps/api/src/lib/plan-truth.ts derivePlanTruth().';


-- ── PART 2 — THE GRANT: assign Founder-Ops to the internal plan ────────────────
--
--   ⚠ THIS IS THE STATEMENT THAT ACTUALLY HANDS OUT ACCESS. ⚠
--
-- Everything above is schema. This one UPDATE is the entitlement, and it names exactly
-- one account: vinc.hafner2@gmail.com (Founder-Ops). Run it only when that access is
-- meant to exist.
--
-- It is deliberately narrow:
--   • matched on the unique users.email (0001: TEXT UNIQUE NOT NULL), case-insensitively;
--   • guarded on stripe_subscription_id IS NULL, so if this account ever holds a real
--     paid subscription the statement does nothing rather than overwriting the plan the
--     Stripe webhook is keeping in sync;
--   • it touches NO other column — not is_comped, not the trial dates, not billing.
--
-- If the account does not exist yet (never signed up), this updates 0 rows and is a
-- no-op — re-run it after the sign-up.
--
-- TO REVOKE:  UPDATE users SET plan = 'none' WHERE lower(email) = 'vinc.hafner2@gmail.com';
--
-- KNOWN INTERACTION (write it down rather than guard against it in code): if this
-- account ever completes a Stripe checkout, handleSubscriptionCreated
-- (apps/api/src/services/billing-service.ts) writes the purchased plan into this same
-- column and the internal grant is gone. Re-run this statement after cancellation.

UPDATE users
   SET plan = 'internal'
 WHERE lower(email) = 'vinc.hafner2@gmail.com'
   AND stripe_subscription_id IS NULL;


-- ── VERIFY (read-only; run after PART 2) ──────────────────────────────────────
--
-- select email, plan, is_comped, stripe_subscription_id
--   from users
--  where lower(email) = 'vinc.hafner2@gmail.com';
--
-- Expected: plan = 'internal', is_comped = false, stripe_subscription_id = null.
