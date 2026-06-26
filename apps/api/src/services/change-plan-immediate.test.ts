/**
 * Immediate-proration proofs (2026-06-26) — Decision A.
 *
 * changePlan now uses proration_behavior:'always_invoice' so an UPGRADE invoices
 * AND charges the prorated difference NOW (the user gets the higher limits today,
 * so they pay today), while the billing-cycle anchor is left untouched. With
 * payment_behavior:'error_if_incomplete', a declined card on that immediate charge
 * fails the call and leaves the subscription UNCHANGED (never changed-but-unpaid).
 *
 * Stripe: REAL test-mode (sk_test_*) against THROWAWAY customers. Supabase + logger
 * are in-memory fakes — the production DB is never touched.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import Stripe from 'stripe';

function loadTestEnv() {
  const envPath = resolve(__dirname, '../../.env.test');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1]) process.env[m[1]] = (m[2] ?? '').trim();
  }
}
loadTestEnv();

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const HAS_TEST_KEY = STRIPE_KEY.startsWith('sk_test_');
if (STRIPE_KEY && !HAS_TEST_KEY) {
  throw new Error('REFUSING TO RUN: STRIPE_SECRET_KEY is not a test key (sk_test_*).');
}

const PRICE_BUILD_T1 = process.env.STRIPE_PRICE_BUILD_TIER1 ?? '';
const PRICE_PRO_T1 = process.env.STRIPE_PRICE_PRO_TIER1 ?? '';

// ── In-memory fake Supabase (only the surface billing-service touches) ────────
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
  select(_c?: string) { this.op = 'select'; return this; }
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

import { changePlan, previewPlanChange } from './billing-service';

const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2024-06-20' });
const createdCustomers: string[] = [];

async function freshCard(token = 'tok_visa'): Promise<string> {
  const pm = await stripe.paymentMethods.create({ type: 'card', card: { token } });
  return pm.id;
}

/** Throwaway customer with a saved card + an active sub at `price`. */
async function makeSubscriber(
  uid: string, email: string, price: string, planLabel: string, cardToken = 'tok_visa',
): Promise<{ customerId: string; subId: string }> {
  const pmId = await freshCard(cardToken);
  const customer = await stripe.customers.create({
    email, payment_method: pmId,
    invoice_settings: { default_payment_method: pmId },
    metadata: { plan_change_test: 'true' },
  });
  createdCustomers.push(customer.id);
  const sub = await stripe.subscriptions.create({
    customer: customer.id, items: [{ price }],
    metadata: { userId: uid, plan_change_test: 'true' },
  });
  users.push({ id: uid, email, plan: planLabel, stripe_customer_id: customer.id, stripe_subscription_id: sub.id });
  return { customerId: customer.id, subId: sub.id };
}

const skip = HAS_TEST_KEY && PRICE_BUILD_T1 && PRICE_PRO_T1 ? describe : describe.skip;

skip('immediate-proration (always_invoice) — real test-mode Stripe', () => {
  beforeAll(() => {
    expect(PRICE_BUILD_T1).toBeTruthy();
    expect(PRICE_PRO_T1).toBeTruthy();
  });
  afterAll(async () => {
    for (const id of createdCustomers) {
      try { await stripe.customers.del(id); } catch { /* already gone */ }
    }
  }, 30_000);

  it('PROOF A: upgrade Build→Pro → proration invoice created AND PAID NOW; amount==preview; anchor unchanged', async () => {
    const uid = 'imm-up-1';
    const { customerId, subId } = await makeSubscriber(uid, 'immup1@example.test', PRICE_BUILD_T1, 'build');

    const subBefore = await stripe.subscriptions.retrieve(subId);
    const anchorBefore = subBefore.current_period_end;

    const preview = await previewPlanChange(uid, 'pro');
    if (!('newPriceId' in preview)) throw new Error('no preview');
    expect(preview.amountDueNow).toBeGreaterThan(0);

    const r = await changePlan(uid, 'pro', preview.newPriceId);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('upgrade failed');

    // The immediate proration invoice exists AND is already PAID.
    const sub = await stripe.subscriptions.retrieve(subId, { expand: ['latest_invoice'] });
    const inv = sub.latest_invoice as Stripe.Invoice;
    expect(inv).toBeTruthy();
    expect(inv.status).toBe('paid');
    expect(inv.amount_paid).toBeGreaterThan(0);

    // Charged amount equals the previewed figure (preview parity → copy is now TRUE).
    expect(inv.amount_paid / 100).toBeCloseTo(preview.amountDueNow, 2);

    // Sub is Pro; billing anchor (next full invoice date) is unchanged.
    expect(sub.items.data[0]?.price.id).toBe(PRICE_PRO_T1);
    expect(sub.current_period_end).toBe(anchorBefore);
    void customerId;
  }, 90_000);

  it('PROOF B: declined card on the immediate proration → throws; sub left UNCHANGED (still Build)', async () => {
    const uid = 'imm-decline-2';
    // Start on Build with a GOOD card so the first invoice is paid and the sub is active.
    const { customerId, subId } = await makeSubscriber(uid, 'immdecline2@example.test', PRICE_BUILD_T1, 'build');

    // Swap the default payment method to one that DECLINES on charge (attaches fine).
    const failPm = await freshCard('tok_chargeCustomerFail');
    await stripe.paymentMethods.attach(failPm, { customer: customerId });
    await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: failPm } });

    const preview = await previewPlanChange(uid, 'pro');
    if (!('newPriceId' in preview)) throw new Error('no preview');

    // always_invoice + error_if_incomplete → the failed immediate charge throws.
    await expect(changePlan(uid, 'pro', preview.newPriceId)).rejects.toThrow();

    // The subscription must NOT be left changed-but-unpaid — still on Build.
    const sub = await stripe.subscriptions.retrieve(subId);
    expect(sub.items.data[0]?.price.id).toBe(PRICE_BUILD_T1);
  }, 90_000);

  it('PROOF C: downgrade Pro→Build → $0 due now + credit; sub is Build', async () => {
    const uid = 'imm-down-3';
    const { subId } = await makeSubscriber(uid, 'immdown3@example.test', PRICE_PRO_T1, 'pro');

    const down = await previewPlanChange(uid, 'build');
    if (!('newPriceId' in down)) throw new Error('no preview');
    expect(down.amountDueNow).toBe(0);
    expect(down.creditAmount).toBeGreaterThan(0);

    const r = await changePlan(uid, 'build', down.newPriceId);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('downgrade failed');

    const sub = await stripe.subscriptions.retrieve(subId);
    expect(sub.items.data[0]?.price.id).toBe(PRICE_BUILD_T1);

    // Downgrade credit lands on the customer balance (negative = credit), not a refund.
    const cust = (await stripe.customers.retrieve(sub.customer as string)) as Stripe.Customer;
    expect(cust.balance).toBeLessThanOrEqual(0);
  }, 90_000);
});
