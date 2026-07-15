/**
 * F-32 (FW5-U6) — server-side "purchase confirmation seen" flag.
 *
 * Proves the read (/status returns lastConfirmedPlan + planConfirmationServer) and the
 * write (POST /confirm-plan stores the RESOLVED plan key, never a client value), plus
 * pre-migration tolerance: a missing `last_confirmed_plan` column must NOT break /status
 * (flag reads null / server:false) and must make /confirm-plan return {ok:false} rather
 * than a 500 — so the client keeps its localStorage fallback and never falsely reports
 * the celebration as persisted.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// A fake users row + a switch to simulate the column being absent (pre-migration).
const store = {
  user: {
    plan: 'pro',
    subscription_current_period_end: null,
    cloud_trial_ends_at: null,
    is_comped: false,
    comp_reason: null,
    stripe_customer_id: null,
    stripe_subscription_id: 'sub_1',
    cancel_at_period_end: false,
    trial_consumed_at: null,
    payment_state: null,
    next_payment_attempt: null,
    last_confirmed_plan: null as string | null,
  },
  columnMissing: false,
  updated: [] as Record<string, unknown>[],
};

const COLUMN_ERR = { message: 'column users.last_confirmed_plan does not exist' };

function makeBuilder() {
  let selectedCols = '';
  const b: Record<string, unknown> = {};
  b.select = (cols: string) => { selectedCols = cols; return b; };
  b.eq = () => b;
  b.single = () => {
    // The flag-only read is a separate query selecting exactly 'last_confirmed_plan'.
    if (selectedCols.trim() === 'last_confirmed_plan') {
      if (store.columnMissing) return Promise.resolve({ data: null, error: COLUMN_ERR });
      return Promise.resolve({ data: { last_confirmed_plan: store.user.last_confirmed_plan }, error: null });
    }
    return Promise.resolve({ data: store.user, error: null });
  };
  b.update = (row: Record<string, unknown>) => {
    return {
      eq: () => {
        if (store.columnMissing) return Promise.resolve({ error: COLUMN_ERR });
        store.updated.push(row);
        store.user.last_confirmed_plan = String(row.last_confirmed_plan);
        return Promise.resolve({ error: null });
      },
    };
  };
  return b;
}

vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({ from: () => makeBuilder() }),
}));

// Auth middleware → inject a fixed userId, no real token needed.
vi.mock('../middleware/auth', () => ({
  authMiddleware: async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
    c.set('userId', 'user-1');
    await next();
  },
}));

// getStripe is only touched by /status when stripe_customer_id is set (it isn't here).
vi.mock('../services/billing-service', async (orig) => {
  const actual = await orig<typeof import('../services/billing-service')>();
  return { ...actual, getStripe: () => ({ customers: { retrieve: () => Promise.reject(new Error('no')) } }) };
});

import { billing } from './billing';

beforeEach(() => {
  store.user.last_confirmed_plan = null;
  store.user.plan = 'pro';
  store.columnMissing = false;
  store.updated = [];
});

describe('F-32 — server-side purchase-confirmation flag', () => {
  it('GET /status surfaces lastConfirmedPlan + planConfirmationServer when the column is live', async () => {
    store.user.last_confirmed_plan = 'pro';
    const res = await billing.request('/status', { method: 'GET' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.planConfirmationServer).toBe(true);
    expect(body.lastConfirmedPlan).toBe('pro');
  });

  it('POST /confirm-plan stores the RESOLVED plan key (server truth, not a client value)', async () => {
    const res = await billing.request('/confirm-plan', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.plan).toBe('pro');            // derived from users.plan, not supplied
    expect(store.updated).toEqual([{ last_confirmed_plan: 'pro' }]);
  });

  it('no re-fire: after confirm, /status reports the flag equal to the plan', async () => {
    await billing.request('/confirm-plan', { method: 'POST' });
    const res = await billing.request('/status', { method: 'GET' });
    const body = await res.json();
    expect(body.lastConfirmedPlan).toBe(body.plan); // gate → show:false on next load
  });

  it('pre-migration tolerance: missing column → /status still 200 with server:false', async () => {
    store.columnMissing = true;
    const res = await billing.request('/status', { method: 'GET' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.planConfirmationServer).toBe(false);
    expect(body.lastConfirmedPlan).toBeNull();
  });

  it('pre-migration tolerance: missing column → /confirm-plan returns {ok:false}, never 500', async () => {
    store.columnMissing = true;
    const res = await billing.request('/confirm-plan', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.reason).toBe('flag_unavailable');
  });
});
