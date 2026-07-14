/**
 * D-F (FW5-U5) — auto-refund of remaining credit on cancellation.
 *
 * Drives refundRemainingCreditOnCancel against a fake Stripe (no network). Covers the
 * founder's paths: positive credit → refunded to the card + balance zeroed; partial
 * (remainder-only) credit; credit capped at the charge's refundable room; zero/positive
 * balance → no-op; no refundable charge → failed (admin, no user success); refund error
 * → failed, balance NOT touched; balance-zero fails after a successful refund →
 * refunded_balance_unadjusted; idempotency key stable per subscription (retry-safe).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

type Charge = { id: string; status: string; refunded: boolean; amount: number; amount_refunded: number };

// vi.hoisted → shared, mutable Stripe state that the hoisted vi.mock factory can see.
const S = vi.hoisted(() => ({
  balance: 0,
  currency: 'eur',
  charges: [] as { id: string; status: string; refunded: boolean; amount: number; amount_refunded: number }[],
  refundThrows: false,
  balanceTxnThrows: false,
  calls: { retrieve: 0, listCharges: 0, refundCreate: [] as { params: any; opts: any }[], balanceTxn: [] as any[] },
}));

vi.mock('stripe', () => {
  class FakeStripe {
    constructor(_k: string, _o: unknown) {}
    customers = {
      retrieve: async (id: string) => { S.calls.retrieve++; return { id, balance: S.balance, currency: S.currency, deleted: false }; },
      createBalanceTransaction: async (id: string, params: any) => {
        S.calls.balanceTxn.push({ id, params });
        if (S.balanceTxnThrows) throw new Error('balance txn failed');
        return { id: 'cbtxn_1', ...params };
      },
    };
    charges = { list: async (_p: unknown) => { S.calls.listCharges++; return { data: S.charges }; } };
    refunds = {
      create: async (params: any, opts: any) => {
        S.calls.refundCreate.push({ params, opts });
        if (S.refundThrows) throw new Error('refund failed');
        return { id: 're_1', ...params };
      },
    };
  }
  return { default: FakeStripe };
});
vi.mock('../lib/logger', () => ({ default: { info() {}, warn() {}, error() {} } }));

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';

import { refundRemainingCreditOnCancel } from './billing-service';
import type Stripe from 'stripe';

const sub = (over: Partial<Stripe.Subscription> = {}) =>
  ({ id: 'sub_1', customer: 'cus_1', ...over }) as unknown as Stripe.Subscription;

const succeededCharge = (amount: number, refunded = 0): Charge =>
  ({ id: 'ch_1', status: 'succeeded', refunded: false, amount, amount_refunded: refunded });

beforeEach(() => {
  S.balance = 0; S.currency = 'eur'; S.charges = []; S.refundThrows = false; S.balanceTxnThrows = false;
  S.calls = { retrieve: 0, listCharges: 0, refundCreate: [], balanceTxn: [] };
});

describe('refundRemainingCreditOnCancel (D-F)', () => {
  it('positive credit → refunds full credit to the card and zeroes the balance', async () => {
    S.balance = -1500;                 // €15.00 credit remaining
    S.charges = [succeededCharge(3000)]; // a €30 charge with room
    const r = await refundRemainingCreditOnCancel(sub());
    expect(r.status).toBe('refunded');
    expect(r.refundedCents).toBe(1500);
    expect(S.calls.refundCreate[0].params).toMatchObject({ charge: 'ch_1', amount: 1500 });
    // Balance zeroed with a POSITIVE offset so the credit isn't also applied elsewhere.
    expect(S.calls.balanceTxn[0].params).toMatchObject({ amount: 1500, currency: 'eur' });
  });

  it('partial (remainder-only) credit → refunds just the remainder', async () => {
    S.balance = -500;                  // only €5 remainder left after partial consumption
    S.charges = [succeededCharge(3000)];
    const r = await refundRemainingCreditOnCancel(sub());
    expect(r.status).toBe('refunded');
    expect(r.refundedCents).toBe(500);
  });

  it('credit larger than the charge room → refund is capped at the refundable amount', async () => {
    S.balance = -5000;                 // €50 credit
    S.charges = [succeededCharge(2000, 500)]; // €20 charge, €5 already refunded → €15 room
    const r = await refundRemainingCreditOnCancel(sub());
    expect(r.status).toBe('refunded');
    expect(r.refundedCents).toBe(1500); // min(5000, 2000-500)
  });

  it('zero balance → no-op, no refund attempted', async () => {
    S.balance = 0;
    const r = await refundRemainingCreditOnCancel(sub());
    expect(r.status).toBe('noop');
    expect(S.calls.refundCreate).toHaveLength(0);
    expect(S.calls.listCharges).toBe(0);
  });

  it('positive balance (customer owes) → no-op', async () => {
    S.balance = 2000;
    const r = await refundRemainingCreditOnCancel(sub());
    expect(r.status).toBe('noop');
    expect(S.calls.refundCreate).toHaveLength(0);
  });

  it('no refundable charge → failed (admin-visible), never a user success', async () => {
    S.balance = -1500;
    S.charges = [{ id: 'ch_x', status: 'succeeded', refunded: true, amount: 3000, amount_refunded: 3000 }];
    const r = await refundRemainingCreditOnCancel(sub());
    expect(r.status).toBe('failed');
    expect(r.reason).toBe('no_refundable_charge');
    expect(S.calls.refundCreate).toHaveLength(0);
  });

  it('refund error → failed, balance is NOT zeroed (no phantom success)', async () => {
    S.balance = -1500; S.charges = [succeededCharge(3000)]; S.refundThrows = true;
    const r = await refundRemainingCreditOnCancel(sub());
    expect(r.status).toBe('failed');
    expect(r.reason).toBe('refund_error');
    expect(S.calls.balanceTxn).toHaveLength(0);
  });

  it('refund ok but balance-zero fails → refunded_balance_unadjusted (money returned, admin)', async () => {
    S.balance = -1500; S.charges = [succeededCharge(3000)]; S.balanceTxnThrows = true;
    const r = await refundRemainingCreditOnCancel(sub());
    expect(r.status).toBe('refunded_balance_unadjusted');
    expect(r.refundedCents).toBe(1500);
  });

  it('idempotency key is stable per subscription (retry-safe, no double refund)', async () => {
    S.balance = -1500; S.charges = [succeededCharge(3000)];
    await refundRemainingCreditOnCancel(sub({ id: 'sub_42' } as Partial<Stripe.Subscription>));
    expect(S.calls.refundCreate[0].opts).toMatchObject({ idempotencyKey: 'goblin-cancel-credit-refund-sub_42' });
  });

  it('no Stripe customer → skipped', async () => {
    const r = await refundRemainingCreditOnCancel(sub({ customer: null } as unknown as Partial<Stripe.Subscription>));
    expect(r.status).toBe('skipped');
  });
});
