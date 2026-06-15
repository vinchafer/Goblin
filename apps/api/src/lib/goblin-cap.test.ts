import { describe, it, expect } from 'vitest';
import {
  computeCapStatus,
  monthlyCapForPlan,
  GOBLIN_DEFAULT_CAP,
  GOBLIN_MONTHLY_TOKEN_CAPS,
} from './goblin-cap';

describe('monthlyCapForPlan', () => {
  it('resolves known plans (case-insensitive)', () => {
    expect(monthlyCapForPlan('build')).toBe(GOBLIN_MONTHLY_TOKEN_CAPS.build);
    expect(monthlyCapForPlan('PRO')).toBe(GOBLIN_MONTHLY_TOKEN_CAPS.pro);
    expect(monthlyCapForPlan('Power')).toBe(GOBLIN_MONTHLY_TOKEN_CAPS.power);
  });

  it('falls back to the base cap for unknown/missing plan', () => {
    expect(monthlyCapForPlan(undefined)).toBe(GOBLIN_DEFAULT_CAP);
    expect(monthlyCapForPlan(null)).toBe(GOBLIN_DEFAULT_CAP);
    expect(monthlyCapForPlan('enterprise')).toBe(GOBLIN_DEFAULT_CAP);
  });

  it('upper tiers carry the heavy tail (build < pro < power)', () => {
    expect(monthlyCapForPlan('build')).toBeLessThan(monthlyCapForPlan('pro'));
    expect(monthlyCapForPlan('pro')).toBeLessThan(monthlyCapForPlan('power'));
  });
});

describe('computeCapStatus', () => {
  it('reports ok well below the cap', () => {
    const s = computeCapStatus(10_000_000, 'build'); // 25% of 40M
    expect(s.state).toBe('ok');
    expect(s.percent).toBe(25);
    expect(s.remainingTokens).toBe(30_000_000);
    expect(s.ratio).toBeCloseTo(0.25);
  });

  it('warns at >= 80% of the cap', () => {
    const s = computeCapStatus(32_000_000, 'build'); // exactly 80%
    expect(s.state).toBe('warn');
    expect(s.percent).toBe(80);
  });

  it('stays ok just under the warn threshold', () => {
    const s = computeCapStatus(31_999_999, 'build');
    expect(s.state).toBe('ok');
  });

  it('reports over at and above the cap, clamping the bar at 100%', () => {
    expect(computeCapStatus(40_000_000, 'build').state).toBe('over');
    const over = computeCapStatus(90_000_000, 'build'); // 225% raw
    expect(over.state).toBe('over');
    expect(over.percent).toBe(100); // clamped
    expect(over.ratio).toBe(1);
    expect(over.remainingTokens).toBe(0);
  });

  it('treats zero usage as a clean empty state', () => {
    const s = computeCapStatus(0, 'build');
    expect(s.state).toBe('ok');
    expect(s.percent).toBe(0);
    expect(s.usedTokens).toBe(0);
    expect(s.remainingTokens).toBe(s.capTokens);
  });

  it('is defensive against malformed input (NaN, negative)', () => {
    expect(computeCapStatus(Number.NaN, 'build').usedTokens).toBe(0);
    expect(computeCapStatus(-5, 'build').state).toBe('ok');
    expect(computeCapStatus(Number.POSITIVE_INFINITY, 'build').usedTokens).toBe(0);
  });

  it('uses the base cap when no plan is given', () => {
    const s = computeCapStatus(20_000_000); // 50% of default 40M
    expect(s.capTokens).toBe(GOBLIN_DEFAULT_CAP);
    expect(s.percent).toBe(50);
  });
});
