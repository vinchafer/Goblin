-- Dunning / failed-payment grace 2026-06-27
--
-- Stripe Smart Retries run ~14 days from the first renewal failure; the sub stays
-- `past_due` (still PAID — access retained) and on final failure Stripe cancels it
-- (customer.subscription.deleted → handleSubscriptionDeleted → 'none').
--
-- During the retry window we keep full access but surface an IN-APP WARNING banner.
-- These columns hold that transient payment-failing state, written by the new
-- invoice.payment_failed handler and cleared by invoice.payment_succeeded
-- (apps/api/src/services/billing-service.ts). derivePlanTruth reads payment_state +
-- next_payment_attempt to expose a paymentFailing flag while still deriving 'paid'.
--
-- APPLY AT/WITH the deploy of that code.
-- Idempotent: safe to run multiple times.

-- payment_state: NULL = healthy; 'past_due' = a renewal charge failed, in retry window.
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_state TEXT;
-- When the failing state began (first failure) — for "seit …" context if needed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_failing_since TIMESTAMPTZ;
-- The next Stripe retry timestamp — the banner deadline ("nächster Versuch am …").
ALTER TABLE users ADD COLUMN IF NOT EXISTS next_payment_attempt TIMESTAMPTZ;
