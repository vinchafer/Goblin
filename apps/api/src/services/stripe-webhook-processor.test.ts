/**
 * Stripe webhook processor — hardening gates (WH2/WH3 async surface), 2026-07-08.
 *
 *   WH2  a stalled handler → withTimeout fires → job marked 'failed' (releasable),
 *        never hangs; processStripeEvent NEVER rejects (fire-and-forget safe).
 *   WH3  a business/processing failure is recorded as a PROCESSING error on the
 *        job row + logged — it is never surfaced as a signature failure.
 *   Recovery: recoverStuckWebhookJobs() replays failed / stale-pending jobs from
 *        the stored payload; a row with no payload is skipped, not fabricated.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Stripe from 'stripe';

// ── Mock billing-service handlers ────────────────────────────────────────────
const handleSubscriptionUpdated = vi.fn((..._a: unknown[]) => Promise.resolve());
vi.mock('./billing-service', () => ({
  handleSubscriptionCreated: vi.fn(() => Promise.resolve()),
  handleSubscriptionUpdated: (...a: unknown[]) => handleSubscriptionUpdated(...a),
  handleSubscriptionDeleted: vi.fn(() => Promise.resolve()),
  handleInvoicePaymentFailed: vi.fn(() => Promise.resolve()),
  handleInvoicePaymentSucceeded: vi.fn(() => Promise.resolve()),
}));

// ── In-memory fake Supabase for the job table ────────────────────────────────
type Row = Record<string, unknown>;
const store: { rows: Row[] } = { rows: [] };

function makeBuilder(table: string) {
  const state: { op: 'select' | 'update'; eqs: [string, unknown][]; payload: Row; orQuery?: string } = {
    op: 'select', eqs: [], payload: {},
  };
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.update = (p: Row) => { state.op = 'update'; state.payload = p; return b; };
  b.eq = (col: string, val: unknown) => { state.eqs.push([col, val]); return b; };
  b.or = (q: string) => { state.orQuery = q; return b; };
  b.order = () => b;
  b.limit = () => resolveList();
  const match = (r: Row) => state.eqs.every(([c, v]) => r[c] === v);
  function resolveOne() {
    if (table !== 'stripe_processed_events') return { data: null, error: null };
    const hit = store.rows.filter(match);
    if (state.op === 'update') { hit.forEach((r) => Object.assign(r, state.payload)); return { data: hit, error: null }; }
    return { data: hit[0] ?? null, error: null };
  }
  function resolveList() {
    // Emulate the recovery .or(failed OR stale-pending) filter loosely: return all
    // failed rows + pending rows (the test controls updated_at so both qualify).
    const hit = store.rows.filter((r) => r.status === 'failed' || r.status === 'pending');
    return Promise.resolve({ data: hit, error: null });
  }
  b.maybeSingle = () => Promise.resolve(resolveOne());
  b.then = (onF: (v: unknown) => unknown) => Promise.resolve(resolveOne()).then(onF);
  return b;
}

vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({ from: (t: string) => makeBuilder(t) }),
}));

const ORIG = { ...process.env };
import { processStripeEvent, recoverStuckWebhookJobs } from './stripe-webhook-processor';

function subUpdatedEvent(id: string): Stripe.Event {
  return { id, type: 'customer.subscription.updated', data: { object: { id: 'sub_1' } } } as unknown as Stripe.Event;
}

beforeEach(() => {
  store.rows = [];
  handleSubscriptionUpdated.mockReset();
  handleSubscriptionUpdated.mockImplementation(() => Promise.resolve());
  process.env = { ...ORIG, STRIPE_WEBHOOK_HANDLER_TIMEOUT_MS: '150', STRIPE_WEBHOOK_STALE_PENDING_MS: '0' };
});
afterEach(() => { process.env = { ...ORIG }; });

describe('processStripeEvent — success path', () => {
  it('applies the handler and marks the job done', async () => {
    store.rows.push({ event_id: 'evt_1', event_type: 'customer.subscription.updated', status: 'pending', attempts: 0 });
    const status = await processStripeEvent(subUpdatedEvent('evt_1'));
    expect(status).toBe('done');
    expect(handleSubscriptionUpdated).toHaveBeenCalledTimes(1);
    expect(store.rows[0]!.status).toBe('done');
    expect(store.rows[0]!.last_error).toBeNull();
  });
});

describe('processStripeEvent — WH2/WH3 failure surface', () => {
  it('handler that throws → job marked failed (releasable), NEVER rejects', async () => {
    store.rows.push({ event_id: 'evt_2', event_type: 'customer.subscription.updated', status: 'pending', attempts: 0 });
    handleSubscriptionUpdated.mockRejectedValueOnce(new Error('supabase write blew up'));

    const status = await processStripeEvent(subUpdatedEvent('evt_2'));

    expect(status).toBe('failed'); // resolved, not thrown
    expect(store.rows[0]!.status).toBe('failed');
    expect(store.rows[0]!.attempts).toBe(1);
    expect(String(store.rows[0]!.last_error)).toContain('supabase write blew up');
  });

  it('handler that STALLS → per-call timeout → job marked failed, no hang', async () => {
    store.rows.push({ event_id: 'evt_3', event_type: 'customer.subscription.updated', status: 'pending', attempts: 0 });
    handleSubscriptionUpdated.mockImplementationOnce(() => new Promise(() => {})); // never resolves

    const status = await processStripeEvent(subUpdatedEvent('evt_3'));

    expect(status).toBe('failed');
    expect(store.rows[0]!.status).toBe('failed');
    expect(String(store.rows[0]!.last_error)).toContain('timeout');
  });
});

describe('recoverStuckWebhookJobs — durability backstop', () => {
  it('replays a failed job from its stored payload and marks it done', async () => {
    store.rows.push({
      event_id: 'evt_4',
      event_type: 'customer.subscription.updated',
      status: 'failed',
      attempts: 1,
      payload: subUpdatedEvent('evt_4'),
      updated_at: new Date(0).toISOString(),
    });

    const result = await recoverStuckWebhookJobs();

    expect(result.recovered).toBe(1);
    expect(handleSubscriptionUpdated).toHaveBeenCalledTimes(1);
    expect(store.rows[0]!.status).toBe('done');
  });

  it('skips (does not fabricate) a releasable row with no stored payload', async () => {
    store.rows.push({
      event_id: 'evt_5',
      event_type: 'customer.subscription.updated',
      status: 'failed',
      attempts: 1,
      payload: null,
      updated_at: new Date(0).toISOString(),
    });

    const result = await recoverStuckWebhookJobs();

    expect(result.recovered).toBe(0);
    expect(handleSubscriptionUpdated).not.toHaveBeenCalled();
    expect(store.rows[0]!.status).toBe('failed'); // untouched
  });
});
