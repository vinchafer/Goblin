/**
 * DD-hardening FW6-U1 — refund RESILIENCE.
 *
 * FW5-U5 auto-refunds remaining downgrade credit on cancellation, but a FAILED
 * refund was only logged — the money owed was never retried and no operator
 * surface showed it. This proves the fix: a failed refund is persisted as a
 * durable, retryable job (refund_jobs), the cron sweep re-runs it, a success
 * resolves the job, and repeated failure is operator-visible past a threshold —
 * all WITHOUT changing computeCancelRefund's return value (F-29: the
 * subscription.deleted handler's success semantics are untouched).
 *
 * Stripe + Supabase + logger are in-memory fakes (no network, no real DB).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── mutable fake-Stripe state (shared with the hoisted vi.mock factory) ──────
type Charge = { id: string; status: string; refunded: boolean; amount: number; amount_refunded: number };
const S = vi.hoisted(() => ({
  balance: 0,
  currency: 'eur',
  charges: [] as { id: string; status: string; refunded: boolean; amount: number; amount_refunded: number }[],
  refundsByCharge: {} as Record<string, any[]>,
  refundThrows: false,
  balanceTxnThrows: false,
  refundCreateCount: 0,
}));

vi.mock('stripe', () => {
  class FakeStripe {
    constructor(_k: string, _o: unknown) {}
    customers = {
      retrieve: async (id: string) => ({ id, balance: S.balance, currency: S.currency, deleted: false }),
      createBalanceTransaction: async (id: string, params: any, _opts?: any) => {
        if (S.balanceTxnThrows) throw new Error('balance txn failed');
        return { id: 'cbtxn_1', ...params };
      },
    };
    charges = { list: async (_p: unknown) => ({ data: S.charges }) };
    refunds = {
      create: async (params: any, _opts: any) => {
        S.refundCreateCount++;
        if (S.refundThrows) throw new Error('refund failed');
        const refund = { id: 're_1', ...params };
        (S.refundsByCharge[params.charge] ??= []).push({ id: refund.id, amount: params.amount, status: 'succeeded', metadata: params.metadata ?? null });
        return refund;
      },
      list: async ({ charge }: { charge: string }) => ({ data: S.refundsByCharge[charge] ?? [] }),
    };
  }
  return { default: FakeStripe };
});

// ── in-memory fake Supabase: just the refund_jobs table ──────────────────────
type Row = Record<string, any>;
const jobs: Row[] = [];

class Query {
  op: 'select' | 'update' | 'upsert' = 'select';
  cols = '';
  payload: any = null;
  conflict = '';
  eqs: [string, any][] = [];
  neqs: [string, any][] = [];
  ins: [string, any[]][] = [];
  _single = false;
  select(cols = '') { this.op = 'select'; this.cols = cols; return this; }
  update(p: any) { this.op = 'update'; this.payload = p; return this; }
  upsert(p: any, opts?: { onConflict?: string }) { this.op = 'upsert'; this.payload = p; this.conflict = opts?.onConflict ?? ''; return this._run(); }
  eq(c: string, v: any) { this.eqs.push([c, v]); return this; }
  neq(c: string, v: any) { this.neqs.push([c, v]); return this; }
  in(c: string, v: any[]) { this.ins.push([c, v]); return this; }
  order() { return this; }
  limit() { return this._run(); }
  maybeSingle() { this._single = true; return this._run(); }
  then(res: any, rej: any) { return this._run().then(res, rej); }
  private matches(r: Row): boolean {
    return this.eqs.every(([c, v]) => r[c] === v)
      && this.neqs.every(([c, v]) => r[c] !== v)
      && this.ins.every(([c, v]) => v.includes(r[c]));
  }
  private _run(): Promise<any> {
    if (this.op === 'upsert') {
      const key = this.conflict || 'subscription_id';
      const existing = jobs.find((r) => r[key] === this.payload[key]);
      if (existing) Object.assign(existing, this.payload);
      else jobs.push({ ...this.payload });
      return Promise.resolve({ error: null });
    }
    if (this.op === 'update') {
      for (const r of jobs) if (this.matches(r)) Object.assign(r, this.payload);
      return Promise.resolve({ error: null });
    }
    const hit = jobs.filter((r) => this.matches(r));
    return Promise.resolve(this._single ? { data: hit[0] ?? null, error: null } : { data: hit, error: null });
  }
}

vi.mock('../lib/supabase', () => ({ getSupabaseAdmin: () => ({ from: (_t: string) => new Query() }) }));

const errorLogs: any[] = [];
vi.mock('../lib/logger', () => ({
  default: { info() {}, warn() {}, error: (...a: any[]) => { errorLogs.push(a); } },
}));

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.REFUND_JOB_ALERT_ATTEMPTS = '3';

// eslint-disable-next-line import/first
import { refundRemainingCreditOnCancel, retryFailedRefunds } from './billing-service';
import type Stripe from 'stripe';

const sub = (id = 'sub_1', customer: string | null = 'cus_1') =>
  ({ id, customer }) as unknown as Stripe.Subscription;
const succeededCharge = (amount: number, refunded = 0): Charge =>
  ({ id: 'ch_1', status: 'succeeded', refunded: false, amount, amount_refunded: refunded });

beforeEach(() => {
  jobs.length = 0;
  errorLogs.length = 0;
  S.balance = 0; S.currency = 'eur'; S.charges = []; S.refundsByCharge = {};
  S.refundThrows = false; S.balanceTxnThrows = false; S.refundCreateCount = 0;
});

describe('refund resilience (FW6-U1)', () => {
  it('a failed refund is persisted as a releasable refund_jobs row (attempts=1)', async () => {
    S.balance = -1500;            // €15 credit owed
    S.charges = [];              // no refundable charge → failed
    const r = await refundRemainingCreditOnCancel(sub('sub_A'));

    // F-29: the return value is exactly computeCancelRefund's — unchanged.
    expect(r.status).toBe('failed');
    expect(r.reason).toBe('no_refundable_charge');

    // …but the obligation is now durable.
    const job = jobs.find((j) => j.subscription_id === 'sub_A');
    expect(job).toBeTruthy();
    expect(job!.status).toBe('failed');
    expect(job!.attempts).toBe(1);
    expect(job!.credit_cents).toBe(1500);
    expect(job!.last_reason).toBe('no_refundable_charge');
  });

  it('a first-try SUCCESS writes no job (common path stays clean)', async () => {
    S.balance = -1500;
    S.charges = [succeededCharge(3000)];
    const r = await refundRemainingCreditOnCancel(sub('sub_ok'));
    expect(r.status).toBe('refunded');
    expect(jobs.find((j) => j.subscription_id === 'sub_ok')).toBeUndefined();
  });

  it('a no-op (no credit) writes no job', async () => {
    S.balance = 0;
    const r = await refundRemainingCreditOnCancel(sub('sub_noop'));
    expect(r.status).toBe('noop');
    expect(jobs).toHaveLength(0);
  });

  it('the cron sweep RETRIES a failed job and marks it done once the refund succeeds', async () => {
    // 1st attempt fails (no charge yet) → job queued.
    S.balance = -1500; S.charges = [];
    await refundRemainingCreditOnCancel(sub('sub_R'));
    const job = jobs.find((j) => j.subscription_id === 'sub_R')!;
    expect(job.status).toBe('failed');

    // The charge lands (e.g. the invoice finally settled). Sweep re-runs the job.
    S.charges = [succeededCharge(3000)];
    const swept = await retryFailedRefunds();

    expect(swept.resolved).toBe(1);
    expect(swept.stillFailing).toBe(0);
    expect(job.status).toBe('done');       // same row, now resolved
    expect(S.refundCreateCount).toBe(1);   // the refund actually happened on retry
  });

  it('repeated failure increments attempts and becomes operator-visible past the threshold', async () => {
    S.balance = -1500; S.charges = []; // permanently no refundable charge

    await refundRemainingCreditOnCancel(sub('sub_L')); // attempt 1
    await retryFailedRefunds();                        // attempt 2
    await retryFailedRefunds();                        // attempt 3 → alert

    const job = jobs.find((j) => j.subscription_id === 'sub_L')!;
    expect(job.attempts).toBe(3);
    expect(job.status).toBe('failed');

    // LOUD operator alert once it has failed N (=3) times.
    const alerted = errorLogs.some(
      (a) => typeof a[1] === 'string' && a[1].includes('cancel_refund_job_alert'),
    );
    expect(alerted).toBe(true);
  });

  it('a refunded_balance_unadjusted outcome persists a job and the sweep resumes the zero to done (E-2)', async () => {
    // Refund succeeds, but zeroing the balance throws → money out, credit retained.
    S.balance = -1500; S.charges = [succeededCharge(3000)]; S.balanceTxnThrows = true;
    const r1 = await refundRemainingCreditOnCancel(sub('sub_BU'));
    expect(r1.status).toBe('refunded_balance_unadjusted');
    const job = jobs.find((j) => j.subscription_id === 'sub_BU')!;
    expect(job.status).toBe('failed'); // now releasable (was terminal before U1)

    // Sweep: the zero now succeeds. The refund already happened (charge room consumed);
    // resume must NOT re-refund — it recognises its own refund via metadata.
    S.balanceTxnThrows = false;
    S.charges = [succeededCharge(3000, 1500)];
    const swept = await retryFailedRefunds();

    expect(swept.resolved).toBe(1);
    expect(swept.stillFailing).toBe(0);
    expect(job.status).toBe('done');
    expect(S.refundCreateCount).toBe(1); // exactly one refund across the whole sequence
  });

  it('sweep is a no-op when there are no releasable jobs', async () => {
    const swept = await retryFailedRefunds();
    expect(swept).toEqual({ resolved: 0, stillFailing: 0 });
  });
});
