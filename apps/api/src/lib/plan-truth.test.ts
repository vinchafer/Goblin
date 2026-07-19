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

  // --- dunning / failed-payment grace (2026-06-27) ---

  it('past_due renewal → still PAID (access kept) but paymentFailing flag + deadline', () => {
    const t = derivePlanTruth({
      stripe_subscription_id: 'sub_1',
      plan: 'pro',
      payment_state: 'past_due',
      next_payment_attempt: future,
    }, NOW);
    expect(t.state).toBe('paid');
    expect(t.hasAccess).toBe(true);
    expect(t.paymentFailing).toBe(true);
    expect(t.paymentDeadline).toBe(future);
  });

  it('healthy paid sub → paymentFailing false, no deadline', () => {
    const t = derivePlanTruth({ stripe_subscription_id: 'sub_1', plan: 'pro' }, NOW);
    expect(t.paymentFailing).toBe(false);
    expect(t.paymentDeadline).toBeNull();
  });

  it('no-sub states never expose paymentFailing', () => {
    expect(derivePlanTruth({ is_comped: true }, NOW).paymentFailing).toBe(false);
    expect(derivePlanTruth({ plan: 'none', cloud_trial_ends_at: future }, NOW).paymentFailing).toBe(false);
    expect(derivePlanTruth(null, NOW).paymentFailing).toBe(false);
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

  // --- LAUNCH-ASSIST U2: promo comp with expiry (comped_until) ---

  it('permanent comp (comped_until NULL/undefined) → still comped, no end date', () => {
    expect(derivePlanTruth({ is_comped: true }, NOW).state).toBe('comped');
    const t = derivePlanTruth({ is_comped: true, comped_until: null }, NOW);
    expect(t.state).toBe('comped');
    expect(t.allowanceKey).toBe('power');
    expect(t.endsAt).toBeNull();
  });

  it('promo comp not yet expired → comped (top allowance), exposes the end date', () => {
    const t = derivePlanTruth({ is_comped: true, comped_until: future }, NOW);
    expect(t.state).toBe('comped');
    expect(t.allowanceKey).toBe('power');
    expect(t.hasAccess).toBe(true);
    expect(t.endsAt).toBe(future);
  });

  it('EXPIRED promo comp → degrades honestly to none (no access), not comped', () => {
    const t = derivePlanTruth({ is_comped: true, comped_until: past, plan: 'none' }, NOW);
    expect(t.state).toBe('none');
    expect(t.hasAccess).toBe(false);
    expect(t.allowanceKey).toBe('none');
  });

  it('EXPIRED promo comp but user later SUBSCRIBED → paid wins (never stuck comped)', () => {
    const t = derivePlanTruth({
      is_comped: true, comped_until: past, stripe_subscription_id: 'sub_1', plan: 'pro',
    }, NOW);
    expect(t.state).toBe('paid');
    expect(t.allowanceKey).toBe('pro');
    expect(t.hasAccess).toBe(true);
  });

  it('active promo comp takes precedence over a subscription (comp is checked first)', () => {
    const t = derivePlanTruth({
      is_comped: true, comped_until: future, stripe_subscription_id: 'sub_1', plan: 'pro',
    }, NOW);
    expect(t.state).toBe('comped');
    expect(t.allowanceKey).toBe('power');
  });

  it('expired promo comp with a still-valid trial date → falls through to trial', () => {
    const t = derivePlanTruth({
      is_comped: true, comped_until: past, plan: 'none',
      trial_consumed_at: null, cloud_trial_ends_at: future,
    }, NOW);
    expect(t.state).toBe('trial');
    expect(t.hasAccess).toBe(true);
  });
});
