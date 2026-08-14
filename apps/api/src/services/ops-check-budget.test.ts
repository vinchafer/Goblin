/**
 * AKT 2 · PHASE 5 · U5.1 gate — "fan-out respects the cron ceiling and the request
 * budget, arithmetic shown".
 *
 * The arithmetic is shown in docs/ACT2_PHASE5_DECISIONS.md §P5-a as a table. This
 * file is the thing that keeps that table true: the band boundaries are asserted
 * from the shipped constants, so a change to the budget breaks the test rather
 * than quietly making the document wrong.
 */

import { describe, it, expect } from 'vitest';
import {
  FLEET_DAILY_REQUEST_LIMIT,
  HEARTBEAT_DAILY_REQUEST_BUDGET,
  MAX_CADENCE_MINUTES,
  MIN_CADENCE_MINUTES,
  cadenceFor,
  requestsPerDayFor,
} from './ops-check-budget';

describe('the shipped constants', () => {
  it('budgets 5% of the fleet ceiling for the heartbeat', () => {
    expect(FLEET_DAILY_REQUEST_LIMIT).toBe(100_000);
    expect(HEARTBEAT_DAILY_REQUEST_BUDGET).toBe(5_000);
    expect(HEARTBEAT_DAILY_REQUEST_BUDGET / FLEET_DAILY_REQUEST_LIMIT).toBeCloseTo(0.05, 10);
  });

  it('never checks faster than 5 minutes or slower than 60', () => {
    expect(MIN_CADENCE_MINUTES).toBe(5);
    expect(MAX_CADENCE_MINUTES).toBe(60);
  });
});

describe('requestsPerDayFor — the formula the ledger and the console both quote', () => {
  it('is apps × (1440 / cadence)', () => {
    expect(requestsPerDayFor(1, 5)).toBe(288);
    expect(requestsPerDayFor(10, 5)).toBe(2_880);
    expect(requestsPerDayFor(34, 10)).toBe(4_896);
    expect(requestsPerDayFor(208, 60)).toBe(4_992);
  });

  it('is zero for an empty fleet or a nonsensical cadence', () => {
    expect(requestsPerDayFor(0, 5)).toBe(0);
    expect(requestsPerDayFor(10, 0)).toBe(0);
    expect(requestsPerDayFor(-3, 5)).toBe(0);
  });
});

describe('cadenceFor — the bands the decisions document tabulates', () => {
  const BANDS: Array<[from: number, to: number, minutes: number]> = [
    [1, 17, 5],
    [18, 34, 10],
    [35, 52, 15],
    [53, 69, 20],
    [70, 86, 25],
    [87, 104, 30],
    [105, 121, 35],
    [122, 138, 40],
    [139, 156, 45],
    [157, 173, 50],
    [174, 190, 55],
    [191, 208, 60],
  ];

  it.each(BANDS)('apps %i…%i check every %i minutes', (from, to, minutes) => {
    expect(cadenceFor(from).cadenceMinutes).toBe(minutes);
    expect(cadenceFor(to).cadenceMinutes).toBe(minutes);
  });

  it('every band stays inside the budget at its widest point', () => {
    for (const [, to, minutes] of BANDS) {
      expect(requestsPerDayFor(to, minutes)).toBeLessThanOrEqual(HEARTBEAT_DAILY_REQUEST_BUDGET);
      expect(cadenceFor(to).overBudget).toBe(false);
    }
  });

  it('the heartbeat never takes more than 5% of the fleet ceiling while inside budget', () => {
    for (const apps of [1, 17, 34, 52, 104, 208]) {
      expect(cadenceFor(apps).shareOfFleetLimit).toBeLessThanOrEqual(0.05);
    }
  });

  it('at 10 apps — the beta radius — it is 5 minutes and 2.9% of the fleet ceiling', () => {
    const plan = cadenceFor(10);
    expect(plan.cadenceMinutes).toBe(5);
    expect(plan.requestsPerDay).toBe(2_880);
    expect(plan.shareOfFleetLimit).toBeCloseTo(0.0288, 6);
  });

  it('past 208 apps it REPORTS over-budget instead of stretching or overrunning silently', () => {
    const plan = cadenceFor(209);
    // It does not stop watching apps because a number went red…
    expect(plan.cadenceMinutes).toBe(MAX_CADENCE_MINUTES);
    // …and it does not pretend the budget still holds. This is founder decision
    // G-P5-1, and the console renders it.
    expect(plan.overBudget).toBe(true);
    expect(plan.requestsPerDay).toBe(5_016);
  });

  it('an empty fleet is the floor cadence and zero requests — never an infinite cadence', () => {
    const plan = cadenceFor(0);
    expect(plan.cadenceMinutes).toBe(MIN_CADENCE_MINUTES);
    expect(plan.requestsPerDay).toBe(0);
    expect(plan.overBudget).toBe(false);
  });

  it('the cadence is monotone: more apps never means more frequent checks', () => {
    let previous = 0;
    for (let apps = 1; apps <= 260; apps += 1) {
      const c = cadenceFor(apps).cadenceMinutes;
      expect(c).toBeGreaterThanOrEqual(previous);
      previous = c;
    }
  });
});
