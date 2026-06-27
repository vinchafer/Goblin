/**
 * Canonical "current plan" derivation (Trial-Activation 2026-06-25;
 * cancel-as-paid + trial-consumed 2026-06-26).
 *
 * THE problem this fixes: `users.plan` defaults to 'build' (migration 0033) and
 * 'build' is ALSO a real paid plan name — so the raw column can never be trusted
 * to mean "this user has paid". Every read/enforcement path must derive the real
 * entitlement from this single function instead of reading `users.plan` directly.
 *
 * Precedence (server-side, never the raw `plan` column):
 *   1. is_comped                         → comped  (full access; founder comp path)
 *   2. stripe_subscription_id present    → paid    (plan kept in sync by the webhook;
 *                                                   INCLUDES cancel_at_period_end —
 *                                                   the user keeps paid access, with
 *                                                   an end date, until the period ends)
 *   3. trial — ONLY IF the trial was never consumed (trial_consumed_at IS NULL)
 *              AND cloud_trial_ends_at > now. A trial NEVER reappears once the
 *              account has ever subscribed.
 *   4. else                              → none    (locked / paywall / re-subscribe)
 *
 * Pure + deterministic → unit-testable, reusable on every read path and the gate.
 */

export type PlanState = 'comped' | 'paid' | 'trial' | 'none';

export interface PlanTruth {
  state: PlanState;
  /** Allowance/cap key for goblin-cap. comped→power (most generous), none→none. */
  allowanceKey: string;
  /** UI/label key. */
  planKey: string;
  /** comped | paid | trial all have access; none does not. */
  hasAccess: boolean;
  /** paid + sub set to cancel at period end → access ends on `endsAt`. */
  cancelAtPeriodEnd: boolean;
  /** ISO date access ends (paid+cancelling → period end; trial → trial end); else null. */
  endsAt: string | null;
}

export interface PlanTruthRow {
  plan?: string | null;
  is_comped?: boolean | null;
  stripe_subscription_id?: string | null;
  cloud_trial_ends_at?: string | null;
  /** Stamped on first subscription → the trial is spent and must never reappear. */
  trial_consumed_at?: string | null;
  /** Persisted from customer.subscription.updated when the user cancels at period end. */
  cancel_at_period_end?: boolean | null;
  /** End of the current paid period (also the cancel-at-period-end access cutoff). */
  subscription_current_period_end?: string | null;
}

const PAID_PLAN_KEYS = new Set(['build', 'pro', 'power']);

export function derivePlanTruth(row: PlanTruthRow | null | undefined, now: Date = new Date()): PlanTruth {
  if (!row) return { state: 'none', allowanceKey: 'none', planKey: 'none', hasAccess: false, cancelAtPeriodEnd: false, endsAt: null };

  if (row.is_comped) {
    return { state: 'comped', allowanceKey: 'power', planKey: 'comped', hasAccess: true, cancelAtPeriodEnd: false, endsAt: null };
  }

  if (row.stripe_subscription_id) {
    // The webhook (handleSubscriptionCreated/Updated) writes the real paid plan
    // into `plan` from the Stripe price id, so for an active sub the column IS
    // authoritative. Guard against a stale/neutral value just in case.
    // A cancel-at-period-end sub is STILL paid until current_period_end — we keep
    // stripe_subscription_id set (never null it on cancel) and surface the end date.
    const p = (row.plan ?? '').toLowerCase();
    const paid = PAID_PLAN_KEYS.has(p) ? p : 'build';
    const cancelling = row.cancel_at_period_end === true;
    return {
      state: 'paid',
      allowanceKey: paid,
      planKey: paid,
      hasAccess: true,
      cancelAtPeriodEnd: cancelling,
      endsAt: cancelling ? (row.subscription_current_period_end ?? null) : null,
    };
  }

  // Trial only for an account that has NEVER subscribed (trial not consumed).
  if (!row.trial_consumed_at && row.cloud_trial_ends_at && new Date(row.cloud_trial_ends_at) > now) {
    return { state: 'trial', allowanceKey: 'trial', planKey: 'trial', hasAccess: true, cancelAtPeriodEnd: false, endsAt: row.cloud_trial_ends_at };
  }

  return { state: 'none', allowanceKey: 'none', planKey: 'none', hasAccess: false, cancelAtPeriodEnd: false, endsAt: null };
}
