/**
 * Canonical "current plan" derivation (Trial-Activation 2026-06-25).
 *
 * THE problem this fixes: `users.plan` defaults to 'build' (migration 0033) and
 * 'build' is ALSO a real paid plan name — so the raw column can never be trusted
 * to mean "this user has paid". Every read/enforcement path must derive the real
 * entitlement from this single function instead of reading `users.plan` directly.
 *
 * Precedence (server-side, never the raw `plan` column):
 *   1. is_comped                         → comped  (full access; founder comp path)
 *   2. stripe_subscription_id present    → paid    (plan kept in sync by the webhook)
 *   3. cloud_trial_ends_at > now         → trial   (active free trial)
 *   4. else                              → none    (locked / paywall)
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
}

export interface PlanTruthRow {
  plan?: string | null;
  is_comped?: boolean | null;
  stripe_subscription_id?: string | null;
  cloud_trial_ends_at?: string | null;
}

const PAID_PLAN_KEYS = new Set(['build', 'pro', 'power']);

export function derivePlanTruth(row: PlanTruthRow | null | undefined, now: Date = new Date()): PlanTruth {
  if (!row) return { state: 'none', allowanceKey: 'none', planKey: 'none', hasAccess: false };

  if (row.is_comped) {
    return { state: 'comped', allowanceKey: 'power', planKey: 'comped', hasAccess: true };
  }

  if (row.stripe_subscription_id) {
    // The webhook (handleSubscriptionCreated/Updated) writes the real paid plan
    // into `plan` from the Stripe price id, so for an active sub the column IS
    // authoritative. Guard against a stale/neutral value just in case.
    const p = (row.plan ?? '').toLowerCase();
    const paid = PAID_PLAN_KEYS.has(p) ? p : 'build';
    return { state: 'paid', allowanceKey: paid, planKey: paid, hasAccess: true };
  }

  if (row.cloud_trial_ends_at && new Date(row.cloud_trial_ends_at) > now) {
    return { state: 'trial', allowanceKey: 'trial', planKey: 'trial', hasAccess: true };
  }

  return { state: 'none', allowanceKey: 'none', planKey: 'none', hasAccess: false };
}
