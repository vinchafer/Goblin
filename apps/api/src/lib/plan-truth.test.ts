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
});
