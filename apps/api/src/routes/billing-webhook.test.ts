/**
 * Stripe webhook route — hardening gates (WH1/WH3), 2026-07-08.
 *
 * Proves the plumbing, not the money logic (side-effects are the processor's job,
 * tested separately). Exercises the real Hono router via `.request()` against a
 * fake Supabase + a spied signature verifier + a mocked processor — no network.
 *
 *   WH1  valid event → 200 fast, side-effects kicked async (processor called,
 *        NOT awaited on the response path); duplicate delivery → idempotency
 *        short-circuit, processor NOT re-invoked.
 *   WH3  a real signature failure → 400 "Invalid signature"; that 400 label is
 *        NEVER produced for a business/infra error. A pre-ACK claim-infra failure
 *        → 500 (Stripe retries), not 400.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Stripe from 'stripe';

// ── Mocks ────────────────────────────────────────────────────────────────────
// Configurable fake Supabase: the webhook does select().eq().maybeSingle() then
// insert(). Tests set `existingRow` (duplicate) and `insertError` / `hang`.
const sb = {
  existingRow: null as Record<string, unknown> | null,
  insertError: null as { message: string } | null,
  hang: false, // simulate a stalled upstream (never resolves) → claim timeout
  inserted: [] as Record<string, unknown>[],
};

function makeBuilder() {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.maybeSingle = () =>
    sb.hang
      ? new Promise(() => {}) // never resolves
      : Promise.resolve({ data: sb.existingRow, error: null });
  builder.insert = (row: Record<string, unknown>) => {
    sb.inserted.push(row);
    return sb.hang
      ? new Promise(() => {})
      : Promise.resolve({ data: null, error: sb.insertError });
  };
  return builder;
}

vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({ from: () => makeBuilder() }),
}));

const processStripeEvent = vi.fn((..._args: unknown[]) => Promise.resolve('done' as const));
vi.mock('../services/stripe-webhook-processor', () => ({
  processStripeEvent: (...args: unknown[]) => processStripeEvent(...args),
  recoverStuckWebhookJobs: vi.fn(),
}));

// Keep the pre-ACK claim timeout short so the "hang → 500" test is fast.
const ORIG = { ...process.env };

import { billing } from './billing';

function post(body: string, headers: Record<string, string> = {}) {
  return billing.request('/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 'sig_test', ...headers },
    body,
  });
}

const EVENT: Stripe.Event = {
  id: 'evt_test_123',
  type: 'customer.subscription.updated',
  data: { object: { id: 'sub_1' } },
} as unknown as Stripe.Event;

beforeEach(() => {
  sb.existingRow = null;
  sb.insertError = null;
  sb.hang = false;
  sb.inserted = [];
  processStripeEvent.mockClear();
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  process.env.STRIPE_WEBHOOK_CLAIM_TIMEOUT_MS = '200'; // fast timeout for the hang test
});
afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIG };
});

describe('POST /api/billing/webhook — WH1 ack-fast async', () => {
  it('valid event → 200 fast, side-effects kicked async, payload claimed pending', async () => {
    vi.spyOn(Stripe.webhooks, 'constructEvent').mockReturnValue(EVENT);

    const t0 = Date.now();
    const res = await post('{}');
    const elapsed = Date.now() - t0;

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    // ACK returned well under the <500ms budget (no side-effects on the path).
    expect(elapsed).toBeLessThan(500);
    // Side-effects handed to the async processor with the verified event.
    expect(processStripeEvent).toHaveBeenCalledTimes(1);
    expect(processStripeEvent).toHaveBeenCalledWith(EVENT);
    // Claimed durably as pending with the raw payload stored for recovery.
    expect(sb.inserted).toHaveLength(1);
    expect(sb.inserted[0]!).toMatchObject({ event_id: 'evt_test_123', status: 'pending' });
    expect(sb.inserted[0]!.payload).toBeTruthy();
  });

  it('duplicate delivery (already claimed) → idempotency no-op, processor NOT invoked', async () => {
    vi.spyOn(Stripe.webhooks, 'constructEvent').mockReturnValue(EVENT);
    sb.existingRow = { event_id: 'evt_test_123' };

    const res = await post('{}');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, duplicate: true });
    expect(processStripeEvent).not.toHaveBeenCalled();
    expect(sb.inserted).toHaveLength(0); // never re-claimed
  });

  it('concurrent duplicate racing the claim (unique-pk conflict) → no-op, no double-process', async () => {
    vi.spyOn(Stripe.webhooks, 'constructEvent').mockReturnValue(EVENT);
    sb.insertError = { message: 'duplicate key value violates unique constraint' };

    const res = await post('{}');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, duplicate: true });
    expect(processStripeEvent).not.toHaveBeenCalled();
  });
});

describe('POST /api/billing/webhook — WH3 honest error surfaces', () => {
  it('real signature failure → 400 "Invalid signature", no claim, no processing', async () => {
    vi.spyOn(Stripe.webhooks, 'constructEvent').mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature');
    });

    const res = await post('{}', { 'stripe-signature': 'bad' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid signature' });
    expect(processStripeEvent).not.toHaveBeenCalled();
    expect(sb.inserted).toHaveLength(0);
  });

  it('pre-ACK claim infra failure (Supabase stall) → 500, NEVER 400', async () => {
    vi.spyOn(Stripe.webhooks, 'constructEvent').mockReturnValue(EVENT);
    sb.hang = true; // idempotency check never resolves → claim timeout

    const res = await post('{}');

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).not.toHaveProperty('error', 'Invalid signature');
    // Nothing claimed, nothing processed → Stripe's retry runs cleanly.
    expect(processStripeEvent).not.toHaveBeenCalled();
  });

  it('a valid, well-signed event is NEVER answered with the 400 signature label', async () => {
    vi.spyOn(Stripe.webhooks, 'constructEvent').mockReturnValue(EVENT);
    const res = await post('{}');
    expect(res.status).not.toBe(400);
  });
});
