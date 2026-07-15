# U5 (D-F) — Downgrade fairness: auto-refund remaining credit on cancel — evidence

## Decision (founder, c)
Keep the prorated downgrade CREDIT; on cancellation, auto-refund any remaining positive
credit to the original payment method.

## Implementation
`apps/api/src/services/billing-service.ts`:
- `refundRemainingCreditOnCancel(subscription)` (new, exported): reads the customer's
  Stripe balance (credit = negative balance, cents); if credit > 0, refunds the amount
  (capped at the latest refundable succeeded charge's room) to the card, then zeroes the
  refunded credit with a balance transaction so it isn't also applied elsewhere.
- Wired into `handleSubscriptionDeleted` AFTER the entitlement reset. Non-throwing — a
  refund failure is logged for admin visibility and never surfaced as user success, and
  must not fail the handler (idempotent, so manual replay is safe).
- Hardened-pattern conformant: every Stripe call wrapped in `withTimeout` (shared
  `STRIPE_WEBHOOK_STRIPE_TIMEOUT_MS`); refund idempotency-keyed on the subscription id so
  a webhook RETRY can't double-refund.

## Edge cases (tested — cancel-refund.test.ts, 10/10)
- positive credit → refunded to card + balance zeroed (POSITIVE offset)
- partial (remainder-only) credit → refunds just the remainder
- credit > charge room → capped at refundable amount
- zero balance / positive balance (owes) → no-op, no refund attempted
- no refundable charge → failed (admin), no user success
- refund error → failed, balance NOT zeroed (no phantom success)
- refund ok but balance-zero fails → refunded_balance_unadjusted (money returned, admin)
- idempotency key stable per subscription (retry-safe)
- no customer → skipped

Regression: `cancel-as-paid.test.ts` 8/8 (handler still resets entitlement; refund is a
no-op there since STRIPE_SECRET_KEY is unset → returns 'skipped', non-throwing).
Full API suite: 818 green.

## UI (DE+EN)
`apps/web/components/settings/BillingPage.tsx`, under the "läuft aus am" cancel line:
DE "Restguthaben wird dir bei Kündigung automatisch zurückerstattet."
EN "Any remaining credit is automatically refunded when you cancel."

## Ledger
FAIRNESS-COST NOTE added (same commit): Stripe keeps the ~1.4% + €0.25 processing fee on
refunds (verified 2026-07-15) — an accepted brand cost, new small Stripe-fee COGS line.

## Founder action
One real downgrade→cancel on the test account post-deploy to see the refund land in Stripe.
