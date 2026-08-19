/**
 * The named internal plan (Founder-Ops) — migration 0105.
 *
 * The unit under test is a THREE-PART claim, and each part has its own block below:
 *
 *   1. The grant lives in the DATABASE. `users.plan = 'internal'` is the entire
 *      entitlement — no e-mail comparison, no env allowlist, no "unset plan means
 *      unlimited". These tests pin that by driving derivePlanTruth with rows only.
 *   2. The plan has EXPLICIT, FINITE limits in the same maps as every other plan, and
 *      goes through the same resolvers. An exemption would show up here as a missing
 *      key falling back to a default; a bypass would show up as an unreachable cap.
 *   3. It is inert until migration 0105 is applied, and it changes NOTHING for anyone
 *      else once it is. The two DB states are modelled explicitly.
 *
 * Existing behaviour is re-asserted here (not just in plan-truth.test.ts) on purpose:
 * this file is the scope armor for the wave. If a later change to the internal plan
 * moves a real user's allowance, one of these fails.
 */

import { describe, it, expect } from 'vitest';
import { derivePlanTruth, type PlanTruthRow } from './plan-truth';
import {
  GOBLIN_MONTHLY_ALLOWANCE,
  GOBLIN_DAILY_GUARD,
  GOBLIN_DEFAULT_ALLOWANCE,
  GOBLIN_DEFAULT_DAILY_GUARD,
  COST_UNITS_PER_BUILD,
  monthlyAllowanceForPlan,
  dailyGuardForPlan,
  isOverMonthlyAllowance,
  isOverDailyGuard,
  computeCapStatus,
  maxProvisionedBackends,
} from './goblin-cap';
import { STORAGE_LIMIT_BYTES, BYTES_PER_GB, storageLimitFor, computeStorageStatus } from './storage-cap';

const NOW = new Date('2026-08-20T12:00:00Z');
const future = new Date(NOW.getTime() + 86400000).toISOString();
const past = new Date(NOW.getTime() - 86400000).toISOString();

/** The row shape the API actually selects for an internal account: the plan column and
 *  nothing else — no subscription, no comp, no trial. */
const INTERNAL_ROW: PlanTruthRow = {
  plan: 'internal',
  is_comped: false,
  stripe_subscription_id: null,
  cloud_trial_ends_at: null,
  trial_consumed_at: null,
};

// ── 1. The grant is the DB row, and only the DB row ──────────────────────────────

describe('internal plan — the grant is a database fact', () => {
  it('plan=internal alone → full access, with NO subscription, comp or trial on the row', () => {
    const t = derivePlanTruth(INTERNAL_ROW, NOW);
    expect(t.state).toBe('internal');
    expect(t.hasAccess).toBe(true);
    expect(t.allowanceKey).toBe('internal');
    expect(t.planKey).toBe('internal');
  });

  it('is permanent — no end date, never "cancelling", never payment-failing', () => {
    const t = derivePlanTruth(INTERNAL_ROW, NOW);
    expect(t.endsAt).toBeNull();
    expect(t.cancelAtPeriodEnd).toBe(false);
    expect(t.paymentFailing).toBe(false);
    expect(t.paymentDeadline).toBeNull();
  });

  it('does not decay with time — the same row derives identically a decade later', () => {
    const later = new Date('2036-08-20T12:00:00Z');
    expect(derivePlanTruth(INTERNAL_ROW, later)).toEqual(derivePlanTruth(INTERNAL_ROW, NOW));
  });

  it('revoking is one column write: plan back to none → locked again', () => {
    const t = derivePlanTruth({ ...INTERNAL_ROW, plan: 'none' }, NOW);
    expect(t.state).toBe('none');
    expect(t.hasAccess).toBe(false);
    expect(t.allowanceKey).toBe('none');
  });

  it('takes precedence over every other state, so nothing can silently downgrade it', () => {
    // An expired promo comp, an expired trial and a consumed trial all sit on the row.
    // Each of these would resolve to 'none' on its own; internal still wins.
    const t = derivePlanTruth({
      plan: 'internal',
      is_comped: true,
      comped_until: past,
      cloud_trial_ends_at: past,
      trial_consumed_at: past,
    }, NOW);
    expect(t.state).toBe('internal');
    expect(t.hasAccess).toBe(true);
  });

  it('case-insensitive, like every other plan lookup in this codebase', () => {
    expect(derivePlanTruth({ plan: 'INTERNAL' }, NOW).state).toBe('internal');
    expect(derivePlanTruth({ plan: 'Internal' }, NOW).allowanceKey).toBe('internal');
  });

  it('an EMPTY plan is still locked — "no plan" never means unlimited', () => {
    for (const plan of [null, undefined, '']) {
      const t = derivePlanTruth({ plan, stripe_subscription_id: null }, NOW);
      expect(t.state).toBe('none');
      expect(t.hasAccess).toBe(false);
    }
    // And the cap resolvers agree: an unresolvable plan gets the conservative floor,
    // never the internal ceiling.
    expect(monthlyAllowanceForPlan(null)).toBe(GOBLIN_DEFAULT_ALLOWANCE);
    expect(monthlyAllowanceForPlan('')).toBe(GOBLIN_DEFAULT_ALLOWANCE);
    expect(dailyGuardForPlan(null)).toBe(GOBLIN_DEFAULT_DAILY_GUARD);
    expect(storageLimitFor(null)).toBe(0);
  });

  it('near-miss values do NOT grant access (no fuzzy matching on the column)', () => {
    for (const plan of ['internal-ops', 'founder', 'intern', ' internal']) {
      const t = derivePlanTruth({ plan }, NOW);
      expect(t.state).toBe('none');
      expect(t.hasAccess).toBe(false);
    }
  });
});

// ── 2. Explicit, finite limits in the same structure as every other plan ─────────

describe('internal plan — explicit limits, same structure, no exemption', () => {
  it('has its own entry in every per-plan map (not a default fallback)', () => {
    expect(GOBLIN_MONTHLY_ALLOWANCE).toHaveProperty('internal');
    expect(GOBLIN_DAILY_GUARD).toHaveProperty('internal');
    expect(STORAGE_LIMIT_BYTES).toHaveProperty('internal');
  });

  it('the numbers are the locked ones', () => {
    expect(GOBLIN_MONTHLY_ALLOWANCE.internal).toBe(250_000_000);
    expect(GOBLIN_DAILY_GUARD.internal).toBe(25_000_000);
    expect(STORAGE_LIMIT_BYTES.internal).toBe(200 * BYTES_PER_GB);
  });

  it('resolves through the ordinary resolvers — no special-casing at the call sites', () => {
    expect(monthlyAllowanceForPlan('internal')).toBe(GOBLIN_MONTHLY_ALLOWANCE.internal);
    expect(dailyGuardForPlan('internal')).toBe(GOBLIN_DAILY_GUARD.internal);
    expect(storageLimitFor('internal')).toBe(STORAGE_LIMIT_BYTES.internal);
  });

  it('is FINITE: the cap is reachable and, once reached, refuses like any other plan', () => {
    const cap = GOBLIN_MONTHLY_ALLOWANCE.internal!;
    expect(Number.isFinite(cap)).toBe(true);
    expect(isOverMonthlyAllowance(cap - 1, 0, 'internal')).toBe(false);
    expect(isOverMonthlyAllowance(cap, 0, 'internal')).toBe(true);

    const guard = GOBLIN_DAILY_GUARD.internal!;
    expect(isOverDailyGuard(guard - 1, 0, 'internal')).toBe(false);
    expect(isOverDailyGuard(guard, 0, 'internal')).toBe(true);
  });

  it('Forge is weighted on internal exactly as on a paid plan (4.4×, same bar)', () => {
    const cap = GOBLIN_MONTHLY_ALLOWANCE.internal!;
    // Forge-only spend reaches the cap 4.4× sooner — the shared weighting, not a
    // per-plan rule.
    expect(isOverDailyGuard(0, Math.ceil(GOBLIN_DAILY_GUARD.internal! / 4.4), 'internal')).toBe(true);
    const status = computeCapStatus(cap / 2, 0, 'internal');
    expect(status.capTokens).toBe(cap);
    expect(status.percent).toBe(50);
    expect(status.state).toBe('ok');
  });

  it('the storage cap is real too — an internal account can fill it', () => {
    const limit = STORAGE_LIMIT_BYTES.internal!;
    expect(computeStorageStatus(limit - 1, 'internal').over).toBe(false);
    expect(computeStorageStatus(limit, 'internal').over).toBe(true);
  });

  it('sits above every purchasable plan, which is the point of it', () => {
    expect(GOBLIN_MONTHLY_ALLOWANCE.internal!).toBeGreaterThan(GOBLIN_MONTHLY_ALLOWANCE.power!);
    expect(GOBLIN_DAILY_GUARD.internal!).toBeGreaterThan(GOBLIN_DAILY_GUARD.power!);
    expect(STORAGE_LIMIT_BYTES.internal!).toBeGreaterThan(STORAGE_LIMIT_BYTES.power!);
  });

  it('the ceiling is a documented build figure, not a magic number', () => {
    // ≈1,667 builds/month, ≈167 builds/day — the figures the migration + ledger quote.
    expect(Math.round(GOBLIN_MONTHLY_ALLOWANCE.internal! / COST_UNITS_PER_BUILD)).toBe(1667);
    expect(Math.round(GOBLIN_DAILY_GUARD.internal! / COST_UNITS_PER_BUILD)).toBe(167);
  });

  it('counts as a paid-class account for the full-stack backend guard (not trial)', () => {
    expect(maxProvisionedBackends('internal')).toBe(maxProvisionedBackends('power'));
  });
});

// ── 3. Both DB states: before migration 0105, and after ─────────────────────────
//
// The only difference the migration makes is whether a row CAN hold 'internal'. The
// code path is identical in both states, which is what "pre-migration tolerant" means
// here — there is no new column to select and nothing to fail on.

describe('internal plan — pre-migration DB (0105 NOT applied)', () => {
  // Pre-0105 the CHECK constraint from 0070 is in force, so the reachable value set is
  // exactly this. Every account in the database is one of these rows.
  const PRE_MIGRATION_PLANS = ['none', 'trial', 'build', 'pro', 'power'] as const;

  it('every reachable row derives exactly as it did before the wave', () => {
    const cases: Array<[PlanTruthRow, string, string, boolean]> = [
      // row, expected state, expected allowanceKey, expected hasAccess
      [{ plan: 'none' }, 'none', 'none', false],
      [{ plan: 'build', stripe_subscription_id: null }, 'none', 'none', false],
      [{ plan: 'pro', stripe_subscription_id: 'sub_1' }, 'paid', 'pro', true],
      [{ plan: 'none', stripe_subscription_id: 'sub_1' }, 'paid', 'build', true],
      [{ plan: 'none', cloud_trial_ends_at: future }, 'trial', 'trial', true],
      [{ plan: 'none', cloud_trial_ends_at: past }, 'none', 'none', false],
      [{ plan: 'build', is_comped: true }, 'comped', 'power', true],
    ];
    for (const [row, state, allowanceKey, hasAccess] of cases) {
      const t = derivePlanTruth(row, NOW);
      expect([row.plan, t.state]).toEqual([row.plan, state]);
      expect(t.allowanceKey).toBe(allowanceKey);
      expect(t.hasAccess).toBe(hasAccess);
    }
  });

  it('no pre-migration plan value can reach the internal branch', () => {
    for (const plan of PRE_MIGRATION_PLANS) {
      expect(derivePlanTruth({ plan }, NOW).state).not.toBe('internal');
      expect(derivePlanTruth({ plan }, NOW).allowanceKey).not.toBe('internal');
    }
  });

  it('deriving a pre-migration row never throws and never reads a 0105-only field', () => {
    // PlanTruthRow gained no field in this wave; a row selected by pre-0105 code is
    // still a complete input.
    expect(() => derivePlanTruth({ plan: 'none' }, NOW)).not.toThrow();
    expect(() => derivePlanTruth(null, NOW)).not.toThrow();
    expect(() => derivePlanTruth(undefined, NOW)).not.toThrow();
  });
});

describe('internal plan — post-migration DB (0105 applied)', () => {
  it('the granted account resolves to internal', () => {
    expect(derivePlanTruth(INTERNAL_ROW, NOW).state).toBe('internal');
  });

  it('SCOPE ARMOR: no other plan moves — allowances and guards are byte-for-byte the locked values', () => {
    expect(GOBLIN_MONTHLY_ALLOWANCE.none).toBe(4_900_000);
    expect(GOBLIN_MONTHLY_ALLOWANCE.trial).toBe(4_900_000);
    expect(GOBLIN_MONTHLY_ALLOWANCE.build).toBe(17_400_000);
    expect(GOBLIN_MONTHLY_ALLOWANCE.pro).toBe(30_000_000);
    expect(GOBLIN_MONTHLY_ALLOWANCE.power).toBe(61_700_000);
    expect(GOBLIN_DEFAULT_ALLOWANCE).toBe(4_900_000);

    expect(GOBLIN_DAILY_GUARD.none).toBe(1_650_000);
    expect(GOBLIN_DAILY_GUARD.trial).toBe(1_650_000);
    expect(GOBLIN_DAILY_GUARD.build).toBe(3_500_000);
    expect(GOBLIN_DAILY_GUARD.pro).toBe(6_000_000);
    expect(GOBLIN_DAILY_GUARD.power).toBe(12_000_000);
    expect(GOBLIN_DEFAULT_DAILY_GUARD).toBe(1_650_000);

    expect(STORAGE_LIMIT_BYTES.none).toBe(0);
    expect(STORAGE_LIMIT_BYTES.trial).toBe(2 * BYTES_PER_GB);
    expect(STORAGE_LIMIT_BYTES.build).toBe(10 * BYTES_PER_GB);
    expect(STORAGE_LIMIT_BYTES.pro).toBe(40 * BYTES_PER_GB);
    expect(STORAGE_LIMIT_BYTES.power).toBe(100 * BYTES_PER_GB);
  });

  it('SCOPE ARMOR: a real user on the same database is unaffected by the grant existing', () => {
    // The internal grant is per-row. Deriving a paying customer next to it is unchanged.
    const paying = derivePlanTruth({ plan: 'pro', stripe_subscription_id: 'sub_9' }, NOW);
    expect(paying.state).toBe('paid');
    expect(paying.allowanceKey).toBe('pro');
    expect(monthlyAllowanceForPlan(paying.allowanceKey)).toBe(30_000_000);
  });

  it('KNOWN INTERACTION: a Stripe subscription on the internal account would win, because the webhook overwrites the column', () => {
    // Documented in migration 0105 rather than defended against in code: the grant IS
    // the column, so whatever last wrote the column holds it. This test exists so the
    // behaviour is pinned and visible, not discovered later.
    const t = derivePlanTruth({ plan: 'pro', stripe_subscription_id: 'sub_1' }, NOW);
    expect(t.state).toBe('paid');
    // ...and re-running 0105 PART 2 is what restores it (guarded on no subscription).
    expect(derivePlanTruth({ plan: 'internal', stripe_subscription_id: null }, NOW).state).toBe('internal');
  });
});
