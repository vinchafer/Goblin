import { describe, it, expect } from 'vitest';
import { derivePlanTruth } from './plan-truth';

const NOW = new Date('2026-06-25T12:00:00Z');
const future = new Date(NOW.getTime() + 86400000).toISOString();
const past = new Date(NOW.getTime() - 86400000).toISOString();

describe('derivePlanTruth', () => {
  it('comped → full access regardless of plan column', () => {
    const t = derivePlanTruth({ is_comped: true, plan: 'build' }, NOW);
    expect(t.state).toBe('comped');
    expect(t.hasAccess).toBe(true);
    expect(t.allowanceKey).toBe('power');
  });

  it('active subscription → paid, plan from the (webhook-synced) column', () => {
    const t = derivePlanTruth({ stripe_subscription_id: 'sub_1', plan: 'pro' }, NOW);
    expect(t.state).toBe('paid');
    expect(t.allowanceKey).toBe('pro');
    expect(t.hasAccess).toBe(true);
  });

  it('THE leak: default plan=build, NO sub → none (not Build access)', () => {
    const t = derivePlanTruth({ plan: 'build', stripe_subscription_id: null }, NOW);
    expect(t.state).toBe('none');
    expect(t.allowanceKey).toBe('none');
    expect(t.hasAccess).toBe(false);
  });

  it('active trial → trial-level access', () => {
    const t = derivePlanTruth({ plan: 'none', cloud_trial_ends_at: future }, NOW);
    expect(t.state).toBe('trial');
    expect(t.allowanceKey).toBe('trial');
    expect(t.hasAccess).toBe(true);
  });

  it('expired trial, no sub → none / locked', () => {
    const t = derivePlanTruth({ plan: 'none', cloud_trial_ends_at: past }, NOW);
    expect(t.state).toBe('none');
    expect(t.hasAccess).toBe(false);
  });

  it('cancelled subscriber reset to none → locked', () => {
    const t = derivePlanTruth({ plan: 'none', stripe_subscription_id: null }, NOW);
    expect(t.state).toBe('none');
    expect(t.hasAccess).toBe(false);
  });

  it('null/empty row → none', () => {
    expect(derivePlanTruth(null, NOW).state).toBe('none');
    expect(derivePlanTruth(undefined, NOW).state).toBe('none');
  });

  it('sub present but stale neutral plan column → falls back to build (still paid access)', () => {
    const t = derivePlanTruth({ stripe_subscription_id: 'sub_1', plan: 'none' }, NOW);
    expect(t.state).toBe('paid');
    expect(t.allowanceKey).toBe('build');
    expect(t.hasAccess).toBe(true);
  });

  // --- cancel-as-paid + trial-consumed (2026-06-26) ---

  it('cancel-at-period-end sub → still PAID, exposes ending date (not trial)', () => {
    const t = derivePlanTruth({
      stripe_subscription_id: 'sub_1',
      plan: 'pro',
      cancel_at_period_end: true,
      subscription_current_period_end: future,
      // An old trial date lingering on the row must NOT pull this into trial.
      cloud_trial_ends_at: future,
    }, NOW);
    expect(t.state).toBe('paid');
    expect(t.planKey).toBe('pro');
    expect(t.cancelAtPeriodEnd).toBe(true);
    expect(t.endsAt).toBe(future);
    expect(t.hasAccess).toBe(true);
  });

  it('active sub NOT cancelling → paid, no ending date', () => {
    const t = derivePlanTruth({
      stripe_subscription_id: 'sub_1',
      plan: 'pro',
      cancel_at_period_end: false,
      subscription_current_period_end: future,
    }, NOW);
    expect(t.state).toBe('paid');
    expect(t.cancelAtPeriodEnd).toBe(false);
    expect(t.endsAt).toBeNull();
  });

  it('churned: trial consumed + sub gone + old trial date → none, NEVER trial', () => {
    const t = derivePlanTruth({
      plan: 'none',
      stripe_subscription_id: null,
      trial_consumed_at: past,        // has ever subscribed
      cloud_trial_ends_at: future,    // stale trial date still in the future
    }, NOW);
    expect(t.state).toBe('none');
    expect(t.hasAccess).toBe(false);
  });

  it('never-subscribed account with active trial → still trial (not broken), exposes endsAt', () => {
    const t = derivePlanTruth({
      plan: 'none',
      trial_consumed_at: null,
      cloud_trial_ends_at: future,
    }, NOW);
    expect(t.state).toBe('trial');
    expect(t.hasAccess).toBe(true);
    expect(t.endsAt).toBe(future);
  });
});
