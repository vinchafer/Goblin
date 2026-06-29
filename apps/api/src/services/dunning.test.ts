/**
 * Dunning / failed-payment grace proofs (2026-06-27).
 *
 * Drives the REAL webhook handlers (handleInvoicePaymentFailed /
 * handleInvoicePaymentSucceeded / handleSubscriptionDeleted) against an in-memory
 * Supabase, using invoice payloads in the EXACT 2026-05-27.dahlia shape captured
 * from a real test-mode renewal failure:
 *   - invoice.parent.subscription_details.subscription  (NOT invoice.subscription)
 *   - invoice.billing_reason = 'subscription_cycle'     (a renewal)
 *   - invoice.next_payment_attempt = <unix secs>        (banner deadline)
 * No network — the handlers only read fields off the invoice object we pass in.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

process.env.STRIPE_PRICE_BUILD_TIER1 ||= 'price_dummy_build';
process.env.STRIPE_PRICE_PRO_TIER1 ||= 'price_dummy_pro';
process.env.STRIPE_PRICE_POWER_TIER1 ||= 'price_dummy_power';

import {
  handleInvoicePaymentFailed,
  handleInvoicePaymentSucceeded,
  handleSubscriptionDeleted,
} from './billing-service';
import { derivePlanTruth } from '../lib/plan-truth';

const SUB = 'sub_dun';
const NEXT_ATTEMPT = Math.floor(new Date('2026-07-10T12:00:00Z').getTime() / 1000);

// Dahlia-shaped invoice (matches the captured real payload).
function dahliaInvoice(over: { billing_reason?: string; next_payment_attempt?: number | null; sub?: string } = {}): any {
  return {
    id: 'in_x',
    object: 'invoice',
    customer: 'cus_x',
    status: 'open',
    attempt_count: 1,
    billing_reason: over.billing_reason ?? 'subscription_cycle',
    next_payment_attempt: over.next_payment_attempt ?? NEXT_ATTEMPT,
    subscription: undefined, // dahlia: the old top-level field is GONE
    parent: { type: 'subscription_details', subscription_details: { subscription: over.sub ?? SUB } },
  };
}

function seedPaidUser() {
  users.length = 0;
  users.push({ id: 'u1', plan: 'pro', stripe_subscription_id: SUB, stripe_customer_id: 'cus_x', cancel_at_period_end: false });
}

describe('dunning: invoice.payment_failed / payment_succeeded (dahlia)', () => {
  beforeEach(seedPaidUser);

  it('PROOF 2: renewal fails → past_due flagged, deadline set; derive stays PAID + paymentFailing', async () => {
    await handleInvoicePaymentFailed(dahliaInvoice());
    const row = users[0]!;
    expect(row.payment_state).toBe('past_due');
    expect(row.next_payment_attempt).toBe(new Date(NEXT_ATTEMPT * 1000).toISOString());
    expect(row.payment_failing_since).toBeTruthy();
    // Plan untouched → access retained.
    expect(row.plan).toBe('pro');
    expect(row.stripe_subscription_id).toBe(SUB);
    const truth = derivePlanTruth(row);
    expect(truth.state).toBe('paid');
    expect(truth.hasAccess).toBe(true);
    expect(truth.paymentFailing).toBe(true);
    expect(truth.paymentDeadline).toBe(new Date(NEXT_ATTEMPT * 1000).toISOString());
  });

  it('PROOF 3: retry succeeds → state cleared; derive healthy (no flag)', async () => {
    await handleInvoicePaymentFailed(dahliaInvoice());
    await handleInvoicePaymentSucceeded(dahliaInvoice({ billing_reason: 'subscription_cycle' }));
    const row = users[0]!;
    expect(row.payment_state).toBeNull();
    expect(row.payment_failing_since).toBeNull();
    expect(row.next_payment_attempt).toBeNull();
    const truth = derivePlanTruth(row);
    expect(truth.state).toBe('paid');
    expect(truth.paymentFailing).toBe(false);
  });

  it('PROOF 4: final cancel → deleted → none/locked (not trial), failing state cleared', async () => {
    await handleInvoicePaymentFailed(dahliaInvoice());
    await handleSubscriptionDeleted({ id: SUB } as any);
    const row = users[0]!;
    expect(row.plan).toBe('none');
    expect(row.stripe_subscription_id).toBeNull();
    expect(row.payment_state).toBeNull();
    const truth = derivePlanTruth(row);
    expect(truth.state).toBe('none');
    expect(truth.hasAccess).toBe(false);
  });

  it('PROOF 5: idempotent re-delivery — failing_since stamped ONCE, no double-apply', async () => {
    await handleInvoicePaymentFailed(dahliaInvoice());
    const firstSince = users[0]!.payment_failing_since;
    await handleInvoicePaymentFailed(dahliaInvoice()); // re-delivery
    expect(users[0]!.payment_failing_since).toBe(firstSince); // unchanged
    expect(users[0]!.payment_state).toBe('past_due');
    // succeeded twice → still cleanly cleared
    await handleInvoicePaymentSucceeded(dahliaInvoice());
    await handleInvoicePaymentSucceeded(dahliaInvoice());
    expect(users[0]!.payment_state).toBeNull();
  });

  it('PROOF 6: a FIRST payment (subscription_create) is NOT treated as a failed renewal', async () => {
    await handleInvoicePaymentFailed(dahliaInvoice({ billing_reason: 'subscription_create' }));
    const row = users[0]!;
    expect(row.payment_state).toBeUndefined(); // never flagged
    expect(derivePlanTruth(row).paymentFailing).toBe(false);
  });

  it('guard: an invoice with no subscription parent is ignored', async () => {
    const orphan = dahliaInvoice();
    orphan.parent = { type: 'manual_details' };
    await handleInvoicePaymentFailed(orphan);
    expect(users[0]!.payment_state).toBeUndefined();
  });
});
