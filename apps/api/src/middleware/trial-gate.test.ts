import { describe, it, expect } from 'vitest';
import { TRIAL_DAYS, trialEndFrom } from './trial-gate';
import { derivePlanTruth } from '../lib/plan-truth';

// TRIAL-7 T1: the trial is a 7-day window. The single authoritative computation is
// trialEndFrom(start) = start + TRIAL_DAYS days, stamped into cloud_trial_ends_at.
// Access is then derived by derivePlanTruth (trial active only while ends_at > now).

const START = new Date('2026-07-07T00:00:00Z');
const DAY = 86400000;

describe('trial duration (7-day)', () => {
  it('TRIAL_DAYS is 7', () => {
    expect(TRIAL_DAYS).toBe(7);
  });

  it('trialEndFrom stamps exactly a 7-day window', () => {
    const end = trialEndFrom(START);
    expect(end.getTime() - START.getTime()).toBe(7 * DAY);
  });

  it('boundary: day 7 still active, day 8 expired', () => {
    const endsAt = trialEndFrom(START).toISOString();
    const row = { plan: 'none' as const, cloud_trial_ends_at: endsAt, trial_consumed_at: null };

    // Day 7 — one hour before the window closes → still a trial.
    const day7 = new Date(START.getTime() + 7 * DAY - 3600000);
    expect(derivePlanTruth(row, day7).state).toBe('trial');
    expect(derivePlanTruth(row, day7).hasAccess).toBe(true);

    // Day 8 — a full day past the window → no longer a trial.
    const day8 = new Date(START.getTime() + 8 * DAY);
    expect(derivePlanTruth(row, day8).state).not.toBe('trial');
    expect(derivePlanTruth(row, day8).hasAccess).toBe(false);
  });
});
