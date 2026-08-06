/**
 * FOUNDER-WALK-4 · U2 — /admin/insight answered 500, and nothing said why.
 *
 * The founder's report: /admin/insight returned 401 before PR #72 and 500 after it. PR #72
 * was right — the proxy is reached now (`x-matched-path: /api/admin/[...path]` and a 403
 * from the proxy's OWN gate on a logged-out probe, verified against production on 9e92d8e).
 * So the failure moved behind the proxy, to this endpoint.
 *
 * WHAT COULD BE PROVED FROM THE CODE, and is pinned here:
 *
 *  · `/api/admin/insight` is the ONLY admin endpoint that reads `platform_events`
 *    (/telemetry reads completion_costs, /users and /stats read users, /health reads
 *    projects). That is why exactly one admin page 500s and the others do not.
 *  · `buildInsight` was the only admin data path that turned a Supabase read error into a
 *    THROW, and `admin.get('/insight')` the only handler with a blanket catch → 500.
 *  · `platform_events` is supplied by migrations 0078 + 0085, both of which say "NOT
 *    applied automatically — founder applies via Supabase SQL Editor", and which the
 *    consumption ledger records as authored-not-applied. Every OTHER consumer of the table
 *    is pre-migration tolerant by contract; insight was the sole hard-failing one.
 *
 * WHAT COULD NOT BE PROVED FROM HERE: which read actually fails in production. Reading the
 * live schema needs either the admin key or a direct database probe, and this environment
 * has neither. So the fix is not "I guessed the table" — it is that the endpoint now
 * DIAGNOSES ITSELF and hands the founder the actionable sentence, whichever read it was.
 * The retracted 401 verdict is the cautionary case: a confident cause in a report, never
 * observed, cost days. This test locks the honest behaviour, not a guess.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const ADMIN_KEY = 'test-admin-key';

/** What the fake DB does for a given table on this run. */
type TableBehaviour = { rows: unknown[] } | { error: string };
const behaviour: Record<string, TableBehaviour> = {};

function builder(table: string) {
  const settle = () => {
    const b = behaviour[table] ?? { rows: [] };
    return 'error' in b
      ? Promise.resolve({ data: null, error: { message: b.error } })
      : Promise.resolve({ data: b.rows, error: null });
  };
  // Every chained qualifier returns the same thenable builder; awaiting it settles.
  const chain: Record<string, unknown> = {
    select: () => chain, is: () => chain, gte: () => chain, order: () => chain,
    limit: () => settle(), in: () => settle(), eq: () => chain, single: () => settle(),
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => settle().then(res, rej),
  };
  return chain;
}

vi.mock('../lib/supabase', () => ({ getSupabaseAdmin: () => ({ from: (t: string) => builder(t) }) }));
vi.mock('../lib/logger', () => ({ default: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { admin } = await import('./admin');

const call = () =>
  admin.request('/insight?days=7&includeTest=false', { headers: { 'x-admin-key': ADMIN_KEY } });

beforeEach(() => {
  process.env.ADMIN_API_KEY = ADMIN_KEY;
  for (const k of Object.keys(behaviour)) delete behaviour[k];
  behaviour.users = { rows: [] };
  behaviour.platform_events = { rows: [] };
});

describe('/api/admin/insight — a pending migration is a stated fact, not an outage', () => {
  it('answers 200 + the migration to apply when platform_events is not there yet', async () => {
    // The exact shape PostgREST returns for a table the schema cache has never seen.
    behaviour.platform_events = {
      error: "Could not find the table 'public.platform_events' in the schema cache",
    };

    const res = await call();
    const body = await res.json() as Record<string, string | boolean>;

    expect(res.status).toBe(200); // ← was 500, with no way to learn why
    expect(body.available).toBe(false);
    expect(body.reason).toBe('schema_pending');
    expect(body.table).toBe('platform_events');
    // The sentence must name the thing the founder would actually DO.
    expect(String(body.migration)).toContain('0085');
    expect(String(body.detail)).toMatch(/apply migration/i);
  });

  it('names the users read — and its missing column — when THAT is the gap instead', async () => {
    // `users.deleted_at` is filtered on here and in /admin/users, yet no migration in this
    // repo creates it. If it is ever the gap, the answer must say so rather than blame the
    // table everyone assumes.
    behaviour.users = { error: 'column users.deleted_at does not exist' };

    const body = await (await call()).json() as Record<string, string | boolean>;
    expect(body.available).toBe(false);
    expect(body.table).toBe('users');
    expect(String(body.detail)).toContain('deleted_at');
  });

  it('still 500s on a genuine read failure — and says which read failed, in both body keys', async () => {
    // Not a schema gap: a real fault must not be dressed up as a pending migration.
    behaviour.platform_events = { error: 'canceling statement due to statement timeout' };

    const res = await call();
    const body = await res.json() as Record<string, string>;

    expect(res.status).toBe(500);
    expect(body.source).toBe('api/admin/insight');
    expect(body.detail).toContain('platform_events read failed');
    // `error` is what this route always sent; `detail` is what the web page always read.
    // They disagreed, so the page rendered a generic line over a message that existed.
    expect(body.error).toBe(body.detail);
  });

  it('a healthy read is unchanged, and marked available', async () => {
    behaviour.users = { rows: [{ id: 'u1', email: 'a@x.test', created_at: new Date().toISOString() }] };
    behaviour.platform_events = { rows: [] };

    const res = await call();
    const body = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.available).toBe(true);
    expect(body).toHaveProperty('funnel7');
    expect(body).toHaveProperty('journeys');
  });

  it('the admin key is still the gate', async () => {
    const res = await admin.request('/insight', { headers: { 'x-admin-key': 'wrong' } });
    expect(res.status).toBe(401);
  });
});
