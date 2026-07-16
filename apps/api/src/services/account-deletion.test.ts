/**
 * Billing-safety proofs for the canonical account-deletion service.
 *
 * Stripe: REAL test-mode (sk_test_*) — proves cancel_at_period_end, retry,
 * un-cancel, customer/PM deletion against the real API with THROWAWAY test
 * customers/subscriptions only. Hard-fails if the key is not a test key.
 * Supabase + email + storage: in-memory fakes, so the production DB is never
 * touched and nothing real is deleted.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import Stripe from 'stripe';

// ── Load the test Stripe key from .env.test BEFORE importing the service ──────
function loadTestEnv() {
  const envPath = resolve(__dirname, '../../.env.test');
  // CI has no .env.test (gitignored) — skip loading rather than throwing ENOENT.
  // The Stripe suite below self-skips when no sk_test_ key is present
  // (HAS_TEST_KEY === false ⇒ describe.skip), so no live call is attempted.
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && m[1]) process.env[m[1]] = (m[2] ?? '').trim();
  }
}
loadTestEnv();

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const HAS_TEST_KEY = STRIPE_KEY.startsWith('sk_test_');
if (STRIPE_KEY && !HAS_TEST_KEY) {
  throw new Error('REFUSING TO RUN: STRIPE_SECRET_KEY is not a test key (sk_test_*).');
}

// ── In-memory fake Supabase ──────────────────────────────────────────────────
type Row = Record<string, any>;
interface Tables {
  users: Row[];
  account_deletions: Row[];
  deletion_audit_log: Row[];
  build_runs: Row[];
  goblin_hosted_waitlist: Row[];
  projects: Row[];
  platform_events: Row[];
}
const tables: Tables = {
  users: [],
  account_deletions: [],
  deletion_audit_log: [],
  build_runs: [],
  goblin_hosted_waitlist: [],
  projects: [],
  platform_events: [],
};
const authUsers = new Map<string, Row>();
const deletedAuthIds: string[] = [];

function match(row: Row, filters: any[]): boolean {
  return filters.every((f) => {
    if (f[0] === '__lte') return new Date(row[f[1]]) <= new Date(f[2]);
    return row[f[0]] === f[1];
  });
}

class Query {
  filters: any[] = [];
  op = 'select';
  payload: any = null;
  conflict: string | null = null;
  _single = false;
  constructor(private table: string) {}
  select() { this.op = 'select'; return this; }
  insert(p: any) { this.op = 'insert'; this.payload = p; return this._run(); }
  update(p: any) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  upsert(p: any, opts?: any) { this.op = 'upsert'; this.payload = p; this.conflict = opts?.onConflict ?? null; return this._run(); }
  eq(c: string, v: any) { this.filters.push([c, v]); return this; }
  lte(c: string, v: any) { this.filters.push(['__lte', c, v]); return this; }
  maybeSingle() { this._single = true; return this._run(); }
  then(res: any, rej: any) { return this._run().then(res, rej); }
  async _run(): Promise<any> {
    // The real Supabase query builder accepts ANY table name. The production
    // deletion service purges tables this fake doesn't pre-declare in `Tables`
    // (e.g. support_tickets, feedback). Resolve the backing store tolerant of
    // unknown tables — lazily create an empty array — so a delete/select on an
    // un-seeded table returns a well-formed result instead of `undefined.filter`.
    const registry = tables as unknown as Record<string, Row[]>;
    const store = (registry[this.table] ??= []);
    if (this.op === 'select') {
      const rows = store.filter((r) => match(r, this.filters));
      if (this._single) return { data: rows[0] ?? null, error: null };
      return { data: rows, error: null };
    }
    if (this.op === 'insert') { store.push({ ...this.payload }); return { error: null }; }
    if (this.op === 'upsert') {
      const key = this.conflict ?? 'id';
      const idx = store.findIndex((r) => r[key] === this.payload[key]);
      if (idx >= 0) store[idx] = { ...store[idx], ...this.payload };
      else store.push({ ...this.payload });
      return { error: null };
    }
    if (this.op === 'update') {
      for (const r of store) if (match(r, this.filters)) Object.assign(r, this.payload);
      return { error: null };
    }
    if (this.op === 'delete') {
      registry[this.table] = store.filter((r) => !match(r, this.filters));
      return { data: [], error: null };
    }
    return { data: [], error: null };
  }
}

const fakeSupabase = {
  from: (t: string) => new Query(t),
  auth: {
    admin: {
      getUserById: async (id: string) => ({ data: { user: authUsers.get(id) ?? null }, error: null }),
      updateUserById: async (id: string, patch: any) => {
        const u = authUsers.get(id);
        if (u) authUsers.set(id, { ...u, ...patch, user_metadata: { ...(u.user_metadata ?? {}), ...(patch.user_metadata ?? {}) } });
        return { data: { user: authUsers.get(id) }, error: null };
      },
      deleteUser: async (id: string) => { deletedAuthIds.push(id); authUsers.delete(id); return { error: null }; },
    },
  },
};

// Spy on the project-storage purge so tests can assert the GDPR wiring (H1)
// without touching real object storage. Hoisted so vi.mock's factory can see it.
const { purgeSpy } = vi.hoisted(() => ({ purgeSpy: vi.fn() }));

vi.mock('../lib/supabase', () => ({ getSupabaseAdmin: () => fakeSupabase }));
vi.mock('../lib/email', () => ({ sendEmail: async () => undefined }));
vi.mock('./file-storage', () => ({
  deleteUserStorage: async () => 3,
  purgeProjectStorage: async (ids: string[]) => {
    purgeSpy(ids);
    return { requested: ids.length, purged: [...ids], failed: [], objectsDeleted: ids.length };
  },
}));
vi.mock('../lib/logger', () => ({ default: { info() {}, warn() {}, error() {} } }));

// Import AFTER mocks + env are set.
import {
  requestAccountDeletion,
  reactivateByToken,
  reactivateByUserId,
  hardDeleteUser,
  GRACE_PERIOD_DAYS,
} from './account-deletion';

const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2024-06-20' });

// ── Test fixtures: real throwaway test-mode customer + subscription ──────────
let priceId = '';
const createdCustomers: string[] = [];

async function ensurePrice(): Promise<string> {
  if (priceId) return priceId;
  const product = await stripe.products.create({ name: 'Goblin DELETE-TEST (throwaway)' });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 1900,
    currency: 'eur',
    recurring: { interval: 'month' },
  });
  priceId = price.id;
  return priceId;
}

async function makeUserWithSub(uid: string, email: string): Promise<{ customerId: string; subId: string }> {
  const customer = await stripe.customers.create({
    email,
    payment_method: 'pm_card_visa',
    invoice_settings: { default_payment_method: 'pm_card_visa' },
    metadata: { delete_test: 'true' },
  });
  createdCustomers.push(customer.id);
  const sub = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: await ensurePrice() }],
    metadata: { userId: uid, delete_test: 'true' },
  });
  authUsers.set(uid, { id: uid, email, user_metadata: {} });
  tables.users.push({ id: uid, email, stripe_customer_id: customer.id, stripe_subscription_id: sub.id, deleted_at: null });
  return { customerId: customer.id, subId: sub.id };
}

function seedDeletionDue(uid: string) {
  // Force the grace period into the past so the hard-delete cron treats it as due.
  const d = tables.account_deletions.find((r) => r.user_id === uid);
  if (d) d.scheduled_hard_delete_at = new Date(Date.now() - 1000).toISOString();
}

const skip = HAS_TEST_KEY ? describe : describe.skip;

skip('account-deletion canonical service (real test-mode Stripe)', () => {
  beforeAll(async () => {
    await ensurePrice();
  }, 30_000);

  it('PROOF 1: request → sub set to cancel_at_period_end; soft-delete + 10d schedule; account banned', async () => {
    const uid = 'del-test-1';
    const { subId } = await makeUserWithSub(uid, 'del1@example.test');

    const res = await requestAccountDeletion(uid);
    expect(res.ok).toBe(true);
    expect(res.stripeCancelConfirmed).toBe(true);

    const sub = await stripe.subscriptions.retrieve(subId);
    expect(sub.cancel_at_period_end).toBe(true); // ③ cancel at period end

    const dr = tables.account_deletions.find((r) => r.user_id === uid)!;
    expect(dr.status).toBe('pending');
    expect(dr.stripe_cancel_confirmed).toBe(true);
    const days = Math.round((new Date(dr.scheduled_hard_delete_at).getTime() - Date.now()) / 86400000);
    expect(days).toBe(GRACE_PERIOD_DAYS); // ② 10-day grace

    expect(tables.users.find((u) => u.id === uid)!.deleted_at).toBeTruthy();
    expect(authUsers.get(uid)!.ban_duration).toBe(`${GRACE_PERIOD_DAYS * 24}h`);
  }, 30_000);

  it('PROOF 2: stripe cancel failure RETRIES (3x) and is recorded, never swallowed', async () => {
    const uid = 'del-test-2';
    authUsers.set(uid, { id: uid, email: 'del2@example.test', user_metadata: {} });
    // Bad subscription id → every Stripe call fails → retry path exercised.
    tables.users.push({ id: uid, email: 'del2@example.test', stripe_customer_id: null, stripe_subscription_id: 'sub_does_not_exist_xyz', deleted_at: null });

    const res = await requestAccountDeletion(uid);
    expect(res.ok).toBe(true); // soft-delete still scheduled
    expect(res.stripeCancelConfirmed).toBe(false);

    const dr = tables.account_deletions.find((r) => r.user_id === uid)!;
    expect(dr.stripe_cancel_requested).toBe(true);
    expect(dr.stripe_cancel_attempts).toBe(3); // retried, not swallowed
    expect(dr.stripe_cancel_confirmed).toBe(false);
    expect(dr.stripe_cancel_last_error).toBeTruthy();
  }, 30_000);

  it('PROOF 3: reactivate within window → sub un-cancelled, account restored', async () => {
    const uid = 'del-test-3';
    const { subId } = await makeUserWithSub(uid, 'del3@example.test');
    await requestAccountDeletion(uid);
    const token = tables.account_deletions.find((r) => r.user_id === uid)!.cancellation_token;

    const res = await reactivateByToken(token);
    expect(res.ok).toBe(true);

    const sub = await stripe.subscriptions.retrieve(subId);
    expect(sub.cancel_at_period_end).toBe(false); // un-cancelled

    expect(tables.account_deletions.find((r) => r.user_id === uid)!.status).toBe('cancelled');
    expect(tables.users.find((u) => u.id === uid)!.deleted_at).toBeNull();
    expect(authUsers.get(uid)!.ban_duration).toBe('none');
  }, 30_000);

  it('PROOF 4: hard-delete with sub cancelled → PM detached, customer deleted, full purge', async () => {
    const uid = 'del-test-4';
    const { customerId, subId } = await makeUserWithSub(uid, 'del4@example.test');
    tables.build_runs.push({ id: 'br1', user_id: uid });
    tables.goblin_hosted_waitlist.push({ id: 'wl1', user_id: uid, email: 'del4@example.test' });
    // I3: behaviour events (no FK to auth.users) must be purged explicitly.
    tables.platform_events.push({ id: 'ev1', user_id: uid, event_type: 'project_created' }, { id: 'ev2', user_id: uid, event_type: 'message_sent' });
    // H1: two projects owned by this user — their storage must be purged too.
    tables.projects.push({ id: 'proj-a', user_id: uid }, { id: 'proj-b', user_id: uid });
    purgeSpy.mockClear();

    await requestAccountDeletion(uid);
    // Fully cancel the sub now so the purge is allowed.
    await stripe.subscriptions.cancel(subId);
    seedDeletionDue(uid);

    const outcome = await hardDeleteUser(uid);
    expect(outcome.purged).toBe(true);
    expect(outcome.blocked).toBe(false);

    // H1: project storage purge invoked with exactly this user's project ids.
    expect(purgeSpy).toHaveBeenCalledTimes(1);
    expect(purgeSpy).toHaveBeenCalledWith(['proj-a', 'proj-b']);

    // Stripe customer gone.
    const cust = await stripe.customers.retrieve(customerId);
    expect((cust as any).deleted).toBe(true);

    // Cascade-gap tables purged + auth delete called.
    expect(tables.build_runs.find((r) => r.user_id === uid)).toBeUndefined();
    expect(tables.goblin_hosted_waitlist.find((r) => r.user_id === uid)).toBeUndefined();
    expect(tables.platform_events.find((r) => r.user_id === uid)).toBeUndefined();
    expect(deletedAuthIds).toContain(uid);
    expect(tables.account_deletions.find((r) => r.user_id === uid)!.status).toBe('completed');
  }, 40_000);

  it('PROOF 5: BLOCK path → live (uncancelled) sub at hard-delete → purge BLOCKED, data NOT erased', async () => {
    const uid = 'del-test-5';
    const { subId } = await makeUserWithSub(uid, 'del5@example.test');
    await requestAccountDeletion(uid);
    // Simulate a sub that ends up live again (cancel reverted) at hard-delete time.
    await stripe.subscriptions.update(subId, { cancel_at_period_end: false });
    seedDeletionDue(uid);

    const outcome = await hardDeleteUser(uid);
    expect(outcome.purged).toBe(false);
    expect(outcome.blocked).toBe(true);

    // Data NOT erased.
    expect(deletedAuthIds).not.toContain(uid);
    expect(tables.users.find((u) => u.id === uid)).toBeDefined();
    const dr = tables.account_deletions.find((r) => r.user_id === uid)!;
    expect(dr.purge_blocked).toBe(true);
    expect(dr.purge_blocked_reason).toBeTruthy();
    expect(dr.status).toBe('pending'); // stays pending, retried next run

    // cleanup: cancel the lingering test sub
    await stripe.subscriptions.cancel(subId).catch(() => {});
  }, 40_000);

  it('PROOF 6: reactivateByUserId (admin path helper) restores account', async () => {
    const uid = 'del-test-6';
    const { subId } = await makeUserWithSub(uid, 'del6@example.test');
    await requestAccountDeletion(uid);

    const res = await reactivateByUserId(uid);
    expect(res.ok).toBe(true);
    expect(tables.users.find((u) => u.id === uid)!.deleted_at).toBeNull();
    const sub = await stripe.subscriptions.retrieve(subId);
    expect(sub.cancel_at_period_end).toBe(false);
    await stripe.subscriptions.cancel(subId).catch(() => {});
  }, 30_000);
});
