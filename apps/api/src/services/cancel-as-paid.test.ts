/**
 * Cancel-as-paid + trial-consumed proofs (2026-06-26).
 *
 * Bug: a Pro subscriber cancelled via the portal → subscription.deleted nulled the
 * sub id immediately → derive fell through to an OLD cloud_trial_ends_at → "Trial
 * endet" instead of "Pro — läuft aus am …". And the trial could reappear after churn.
 *
 * These drive the real webhook handlers (handleSubscription*) against an in-memory
 * Supabase and assert the resulting row + derivePlanTruth. No network — the handlers
 * only read fields off the Stripe.Subscription object we pass in.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Stripe from 'stripe';

type Row = Record<string, any>;
const users: Row[] = [];

function match(row: Row, filters: [string, any][]): boolean {
  return filters.every(([c, v]) => row[c] === v);
}
class Query {
  filters: [string, any][] = [];
  op: 'select' | 'update' = 'select';
  payload: any = null;
  _single = false;
  select() { this.op = 'select'; return this; }
  update(p: any) { this.op = 'update'; this.payload = p; return this; }
  eq(c: string, v: any) { this.filters.push([c, v]); return this; }
  maybeSingle() { this._single = true; return this._run(); }
  single() { this._single = true; return this._run(); }
  then(res: any, rej: any) { return this._run().then(res, rej); }
  async _run(): Promise<any> {
    if (this.op === 'update') {
      for (const r of users.filter((r) => match(r, this.filters))) Object.assign(r, this.payload);
      return { data: null, error: null };
    }
    const rows = users.filter((r) => match(r, this.filters));
    if (this._single) return { data: rows[0] ?? null, error: rows[0] ? null : { message: 'not found' } };
    return { data: rows, error: null };
  }
}
const fakeSupabase = { from: (_t: string) => new Query() };
vi.mock('../lib/supabase', () => ({ getSupabaseAdmin: () => fakeSupabase }));
vi.mock('../lib/logger', () => ({ default: { info() {}, warn() {}, error() {} } }));

// getPlanFromPriceId() builds the plan map from these env vars (throws if unset).
// Dummy ids are fine — 'price_x' matches none → handler falls back to 'build',
// which still derives to `paid`; this suite asserts STATE, not the exact tier.
process.env.STRIPE_PRICE_BUILD_TIER1 ||= 'price_dummy_build';
process.env.STRIPE_PRICE_PRO_TIER1 ||= 'price_dummy_pro';
process.env.STRIPE_PRICE_POWER_TIER1 ||= 'price_dummy_power';

import {
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} from './billing-service';
import { derivePlanTruth } from '../lib/plan-truth';

const NOW = Math.floor(new Date('2026-06-26T12:00:00Z').getTime() / 1000);
const PERIOD_END = NOW + 30 * 86400; // 30 days out
const FUTURE_ISO = new Date((NOW + 2 * 86400) * 1000).toISOString();

function sub(over: Partial<Stripe.Subscription> & Record<string, any> = {}): Stripe.Subscription {
  return {
    id: 'sub_x',
    customer: 'cus_x',
    metadata: { userId: 'u1' },
    items: { data: [{ price: { id: 'price_x' } } as any] } as any,
    current_period_end: PERIOD_END,
    cancel_at_period_end: false,
    ...over,
  } as unknown as Stripe.Subscription;
}

beforeEach(() => { users.length = 0; });

describe('cancel-as-paid + trial-consumed', () => {
  it('PROOF 1: subscribe → trial_consumed_at set; derives to paid', async () => {
    users.push({ id: 'u1', plan: 'none', cloud_trial_ends_at: FUTURE_ISO, trial_consumed_at: null });
    await handleSubscriptionCreated(sub());
    const row = users[0]!;
    expect(row.stripe_subscription_id).toBe('sub_x');
    expect(row.trial_consumed_at).toBeTruthy();         // trial spent
    expect(derivePlanTruth(row).state).toBe('paid');
  });

  it('PROOF 2: cancel-at-period-end → stays PAID with ending date, NOT trial', async () => {
    users.push({ id: 'u1', plan: 'pro', stripe_subscription_id: 'sub_x', cloud_trial_ends_at: FUTURE_ISO, trial_consumed_at: new Date().toISOString() });
    await handleSubscriptionUpdated(sub({ cancel_at_period_end: true }));
    const row = users[0]!;
    expect(row.stripe_subscription_id).toBe('sub_x');    // NOT nulled mid-period
    expect(row.cancel_at_period_end).toBe(true);
    const t = derivePlanTruth(row);
    expect(t.state).toBe('paid');
    expect(t.cancelAtPeriodEnd).toBe(true);
    expect(t.endsAt).toBe(new Date(PERIOD_END * 1000).toISOString());
  });

  it('PROOF 3: true period end (subscription.deleted) → none/locked, NOT trial', async () => {
    users.push({ id: 'u1', plan: 'pro', stripe_subscription_id: 'sub_x', cloud_trial_ends_at: FUTURE_ISO, trial_consumed_at: new Date().toISOString(), cancel_at_period_end: true });
    await handleSubscriptionDeleted(sub());
    const row = users[0]!;
    expect(row.plan).toBe('none');
    expect(row.stripe_subscription_id).toBeNull();
    expect(row.cancel_at_period_end).toBe(false);
    const t = derivePlanTruth(row);
    expect(t.state).toBe('none');                        // trial does NOT resurrect
    expect(t.hasAccess).toBe(false);
  });

  it('PROOF 4: immediate cancel (deleted, no period_end window) → none, NOT trial', async () => {
    users.push({ id: 'u1', plan: 'pro', stripe_subscription_id: 'sub_x', cloud_trial_ends_at: FUTURE_ISO, trial_consumed_at: new Date().toISOString() });
    await handleSubscriptionDeleted(sub());
    expect(derivePlanTruth(users[0]!).state).toBe('none');
  });

  it('PROOF 5: never-subscribed account with active trial → still trial', () => {
    const row = { plan: 'none', trial_consumed_at: null, cloud_trial_ends_at: FUTURE_ISO };
    expect(derivePlanTruth(row).state).toBe('trial');
  });

  it('PROOF 6: re-subscribe after churn (none → paid) → works, trial stays consumed', async () => {
    users.push({ id: 'u1', plan: 'none', stripe_subscription_id: null, cloud_trial_ends_at: FUTURE_ISO, trial_consumed_at: new Date().toISOString() });
    await handleSubscriptionCreated(sub({ id: 'sub_new' }));
    const row = users[0]!;
    expect(row.stripe_subscription_id).toBe('sub_new');
    expect(row.cancel_at_period_end).toBe(false);
    expect(derivePlanTruth(row).state).toBe('paid');
  });
});
