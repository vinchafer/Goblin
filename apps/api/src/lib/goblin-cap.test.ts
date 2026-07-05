import { describe, it, expect } from 'vitest';
import {
  computeCapStatus,
  weightedCostUnits,
  monthlyAllowanceForPlan,
  dailyGuardForPlan,
  isOverMonthlyAllowance,
  isOverDailyGuard,
  nextMonthlyResetISO,
  FORGE_WEIGHT,
  GOBLIN_DEFAULT_ALLOWANCE,
  GOBLIN_DEFAULT_DAILY_GUARD,
  GOBLIN_MONTHLY_ALLOWANCE,
  GOBLIN_DAILY_GUARD,
  COST_UNITS_PER_BUILD,
  TRIAL_BUILDS_PER_DAY,
  TRIAL_DAILY_GUARD,
} from './goblin-cap';

// ── Locked constants (Session 3 — must match the founder/financial model) ──────
describe('locked constants', () => {
  it('FORGE_WEIGHT is 4.4', () => {
    expect(FORGE_WEIGHT).toBe(4.4);
  });
  it('monthly allowances per plan (cost units)', () => {
    expect(GOBLIN_MONTHLY_ALLOWANCE.trial).toBe(4_900_000);
    expect(GOBLIN_MONTHLY_ALLOWANCE.build).toBe(17_400_000);
    expect(GOBLIN_MONTHLY_ALLOWANCE.pro).toBe(30_000_000);
    expect(GOBLIN_MONTHLY_ALLOWANCE.power).toBe(61_700_000);
  });
  it('per-plan daily guards (paid ≈ 1/5 monthly; trial raised for 7-day reachability)', () => {
    expect(GOBLIN_DAILY_GUARD.trial).toBe(1_650_000);
    expect(GOBLIN_DAILY_GUARD.none).toBe(1_650_000); // mirrors trial
    expect(GOBLIN_DAILY_GUARD.build).toBe(3_500_000);
    expect(GOBLIN_DAILY_GUARD.pro).toBe(6_000_000);
    expect(GOBLIN_DAILY_GUARD.power).toBe(12_000_000);
  });

  // ── Builds reconcile (CFO single source of truth, 2026-06-27) ─────────────────
  it('COST_UNITS_PER_BUILD reconciled to the CFO 0.15M', () => {
    expect(COST_UNITS_PER_BUILD).toBe(150_000);
  });
  it('displayed builds derive Trial 33 / Build 116 / Pro 200 / Power 411', () => {
    const b = (plan: string) => Math.round(monthlyAllowanceForPlan(plan) / COST_UNITS_PER_BUILD);
    expect(b('trial')).toBe(33);
    expect(b('build')).toBe(116);
    expect(b('pro')).toBe(200);
    expect(b('power')).toBe(411);
  });
  it('trial daily guard = 11 builds/day, full ~33-build cap reachable in 7 days', () => {
    expect(TRIAL_BUILDS_PER_DAY).toBe(11);
    expect(TRIAL_DAILY_GUARD).toBe(1_650_000);
    expect(GOBLIN_DAILY_GUARD.trial).toBe(TRIAL_DAILY_GUARD);
    // 7 days × daily guard ≥ the full monthly trial cap (cap binds, not the guard)
    expect(TRIAL_DAILY_GUARD * 7).toBeGreaterThanOrEqual(monthlyAllowanceForPlan('trial'));
  });
});

// ── The weight itself ──────────────────────────────────────────────────────────
describe('weightedCostUnits', () => {
  it('Swift tokens count 1:1', () => {
    expect(weightedCostUnits(1_000_000, 0)).toBe(1_000_000);
  });
  it('Forge tokens count 4.4×', () => {
    expect(weightedCostUnits(0, 1_000_000)).toBe(4_400_000);
  });
  it('mixed usage adds Swift + Forge×4.4', () => {
    expect(weightedCostUnits(1_000_000, 1_000_000)).toBe(5_400_000);
  });
  it('1 Forge token costs the allowance like 4.4 Swift tokens', () => {
    expect(weightedCostUnits(0, 100)).toBe(weightedCostUnits(440, 0));
  });
  it('is defensive against malformed input', () => {
    expect(weightedCostUnits(Number.NaN, 5)).toBe(22); // 0 + 5×4.4
    expect(weightedCostUnits(-10, -10)).toBe(0);
    expect(weightedCostUnits(Number.POSITIVE_INFINITY, 0)).toBe(0);
  });
});

describe('allowance / guard resolution', () => {
  it('resolves known plans (case-insensitive)', () => {
    expect(monthlyAllowanceForPlan('build')).toBe(17_400_000);
    expect(monthlyAllowanceForPlan('PRO')).toBe(30_000_000);
    expect(monthlyAllowanceForPlan('Power')).toBe(61_700_000);
    expect(monthlyAllowanceForPlan('trial')).toBe(4_900_000);
  });
  it('trial < build < pro < power (the spend ladder)', () => {
    expect(monthlyAllowanceForPlan('trial')).toBeLessThan(monthlyAllowanceForPlan('build'));
    expect(monthlyAllowanceForPlan('build')).toBeLessThan(monthlyAllowanceForPlan('pro'));
    expect(monthlyAllowanceForPlan('pro')).toBeLessThan(monthlyAllowanceForPlan('power'));
  });
  it('falls back to the conservative (trial) allowance for unknown/missing plan', () => {
    expect(monthlyAllowanceForPlan(undefined)).toBe(GOBLIN_DEFAULT_ALLOWANCE);
    expect(monthlyAllowanceForPlan(null)).toBe(GOBLIN_DEFAULT_ALLOWANCE);
    expect(monthlyAllowanceForPlan('enterprise')).toBe(GOBLIN_DEFAULT_ALLOWANCE);
    expect(GOBLIN_DEFAULT_ALLOWANCE).toBe(4_900_000);
  });
  it('daily guard resolves per plan, conservative fallback', () => {
    expect(dailyGuardForPlan('power')).toBe(12_000_000);
    expect(dailyGuardForPlan('nope')).toBe(GOBLIN_DEFAULT_DAILY_GUARD);
    expect(GOBLIN_DEFAULT_DAILY_GUARD).toBe(1_650_000);
  });
});

// ── Monthly cap status (weighted) ───────────────────────────────────────────────
describe('computeCapStatus (weighted)', () => {
  it('Swift-only well below the allowance is ok', () => {
    const s = computeCapStatus(4_350_000, 0, 'build'); // 25% of 17.4M
    expect(s.state).toBe('ok');
    expect(s.percent).toBe(25);
  });

  it('Forge consumes the allowance ~4.4× faster than Swift', () => {
    const swiftOnly = computeCapStatus(1_000_000, 0, 'build');
    const forgeOnly = computeCapStatus(0, 1_000_000, 'build');
    // same raw token count, Forge eats 4.4× the percentage
    expect(forgeOnly.percent).toBeGreaterThan(swiftOnly.percent * 4);
  });

  it('mixed usage warns at >= 80% of the allowance', () => {
    // build allowance 17.4M; push to exactly 80% = 13.92M cost units.
    // 13.0M Swift + 0.209090…M Forge×4.4 ≈ 13.92M
    const s = computeCapStatus(13_920_000, 0, 'build');
    expect(s.state).toBe('warn');
    expect(s.percent).toBe(80);
  });

  it('stays ok just under the warn threshold', () => {
    expect(computeCapStatus(13_919_999, 0, 'build').state).toBe('ok');
  });

  it('reports over at/above the allowance, clamping the bar at 100%', () => {
    expect(computeCapStatus(17_400_000, 0, 'build').state).toBe('over');
    const over = computeCapStatus(0, 10_000_000, 'build'); // 44M cost units >> 17.4M
    expect(over.state).toBe('over');
    expect(over.percent).toBe(100);
    expect(over.ratio).toBe(1);
    expect(over.remainingTokens).toBe(0);
  });

  it('zero usage is a clean empty state with the reset date set', () => {
    const s = computeCapStatus(0, 0, 'pro');
    expect(s.state).toBe('ok');
    expect(s.percent).toBe(0);
    expect(s.usedTokens).toBe(0);
    expect(s.remainingTokens).toBe(s.capTokens);
    expect(s.resetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('trial allowance is the smallest — a little Forge moves the bar fast', () => {
    const s = computeCapStatus(0, 1_100_000, 'trial'); // 1.1M Forge → 4.84M ≈ 99% of 4.9M
    expect(s.state).toBe('warn');
    expect(s.percent).toBeGreaterThanOrEqual(98);
  });

  it('is defensive against malformed input', () => {
    expect(computeCapStatus(Number.NaN, Number.NaN, 'build').usedTokens).toBe(0);
    expect(computeCapStatus(-5, -5, 'build').state).toBe('ok');
  });
});

// ── Enforcement thresholds ──────────────────────────────────────────────────────
describe('isOverMonthlyAllowance', () => {
  it('false below, true at/over the allowance (weighted)', () => {
    expect(isOverMonthlyAllowance(17_399_999, 0, 'build')).toBe(false);
    expect(isOverMonthlyAllowance(17_400_000, 0, 'build')).toBe(true);
    // Forge-only: 17.4M / 4.4 ≈ 3.954M Forge tokens hits the build allowance
    expect(isOverMonthlyAllowance(0, 4_000_000, 'build')).toBe(true);
    expect(isOverMonthlyAllowance(0, 3_000_000, 'build')).toBe(false);
  });
  it('trial caps far sooner than power for identical usage', () => {
    expect(isOverMonthlyAllowance(5_000_000, 0, 'trial')).toBe(true);
    expect(isOverMonthlyAllowance(5_000_000, 0, 'power')).toBe(false);
  });
});

describe('isOverDailyGuard', () => {
  it('fires at/over the per-plan daily guard (weighted)', () => {
    expect(isOverDailyGuard(3_499_999, 0, 'build')).toBe(false);
    expect(isOverDailyGuard(3_500_000, 0, 'build')).toBe(true);
    // a Forge runaway trips the trial guard fast: 1.65M / 4.4 ≈ 375K Forge tokens
    expect(isOverDailyGuard(0, 380_000, 'trial')).toBe(true);
    expect(isOverDailyGuard(0, 370_000, 'trial')).toBe(false);
  });
});

// ── Reset date (calendar month) ─────────────────────────────────────────────────
describe('nextMonthlyResetISO', () => {
  it('returns the first of the following month (UTC)', () => {
    expect(nextMonthlyResetISO(new Date('2026-06-16T12:00:00Z'))).toBe('2026-07-01');
    expect(nextMonthlyResetISO(new Date('2026-12-31T23:59:59Z'))).toBe('2027-01-01');
    expect(nextMonthlyResetISO(new Date('2026-01-01T00:00:00Z'))).toBe('2026-02-01');
  });
});
