// WAVE-D · D-5 gate — account-deletion completeness for the two gaps the audit found:
//   (1) a deleted user's LIVE Vercel deployments must be torn down (they were orphaned
//       — public + billable on the user's own token — after the storage/DB purge);
//   (2) the per-user BYOK KEK in Vault must be purged (byok_keys cascades, the KEK did
//       not — ON DELETE SET NULL left it orphaned).
// Proves both fire during hardDeleteUser, per project, and that a missing 0090 RPC
// (pre-migration DB) is tolerated rather than blocking the delete.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── mock the Vercel teardown so we can assert it is invoked per project ──────────
const teardownCalls: Array<{ userId: string; name: string }> = [];
let teardownResult: { ok: boolean; status: number; alreadyGone: boolean; error?: string } = {
  ok: true, status: 204, alreadyGone: false,
};
vi.mock('./vercel-service', () => ({
  teardownVercelProject: async (userId: string, name: string) => {
    teardownCalls.push({ userId, name });
    return teardownResult;
  },
}));

// ── in-memory supabase with .rpc support ─────────────────────────────────────────
type Row = Record<string, any>;
interface Tables { users: Row[]; account_deletions: Row[]; deletion_audit_log: Row[]; build_runs: Row[]; goblin_hosted_waitlist: Row[]; projects: Row[]; platform_events: Row[]; support_tickets: Row[]; feedback: Row[]; }
let tables: Tables;
const deletedAuthIds: string[] = [];
const rpcCalls: Array<{ fn: string; args: any }> = [];
let rpcError: { code?: string; message?: string } | null = null;

const match = (row: Row, filters: any[]) => filters.every((f) => row[f[0]] === f[1]);
class Query {
  filters: any[] = []; op = 'select'; payload: any = null; _single = false;
  constructor(private table: keyof Tables) {}
  select() { this.op = 'select'; return this; }
  insert(p: any) { this.op = 'insert'; this.payload = p; return this._run(); }
  update(p: any) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c: string, v: any) { this.filters.push([c, v]); return this; }
  maybeSingle() { this._single = true; return this._run(); }
  then(res: any, rej: any) { return this._run().then(res, rej); }
  async _run(): Promise<any> {
    const store = tables[this.table];
    if (this.op === 'select') {
      const rows = store.filter((r) => match(r, this.filters));
      return this._single ? { data: rows[0] ?? null, error: null } : { data: rows, error: null };
    }
    if (this.op === 'insert') { store.push({ ...this.payload }); return { error: null }; }
    if (this.op === 'update') { for (const r of store) if (match(r, this.filters)) Object.assign(r, this.payload); return { error: null }; }
    if (this.op === 'delete') { tables[this.table] = store.filter((r) => !match(r, this.filters)) as any; return { error: null }; }
    return { error: null };
  }
}
const fakeSupabase = {
  from: (t: keyof Tables) => new Query(t),
  rpc: async (fn: string, args: any) => { rpcCalls.push({ fn, args }); return { data: rpcError ? null : 1, error: rpcError }; },
  auth: { admin: {
    getUserById: async (id: string) => ({ data: { user: { id, email: `${id}@x.test` } }, error: null }),
    deleteUser: async (id: string) => { deletedAuthIds.push(id); return { error: null }; },
  } },
};

vi.mock('../lib/supabase', () => ({ getSupabaseAdmin: () => fakeSupabase }));
vi.mock('../lib/email', () => ({ sendEmail: async () => undefined }));
vi.mock('./file-storage', () => ({
  deleteUserStorage: async () => 0,
  purgeProjectStorage: async (ids: string[]) => ({ requested: ids.length, purged: [...ids], failed: [], objectsDeleted: 0 }),
}));
vi.mock('../lib/logger', () => ({ default: { info() {}, warn() {}, error() {} } }));

// eslint-disable-next-line import/first
import { hardDeleteUser } from './account-deletion';

const VICTIM = 'td-victim';

beforeEach(() => {
  deletedAuthIds.length = 0;
  teardownCalls.length = 0;
  rpcCalls.length = 0;
  rpcError = null;
  teardownResult = { ok: true, status: 204, alreadyGone: false };
  tables = {
    users: [{ id: VICTIM, email: `${VICTIM}@x.test`, stripe_customer_id: null, stripe_subscription_id: null, deleted_at: new Date().toISOString() }],
    account_deletions: [{ user_id: VICTIM, status: 'pending' }],
    deletion_audit_log: [], build_runs: [], goblin_hosted_waitlist: [],
    projects: [
      { id: 'p1', user_id: VICTIM, name: 'Mein Shop' },
      { id: 'p2', user_id: VICTIM, name: 'Portfolio' },
    ],
    platform_events: [], support_tickets: [], feedback: [],
  };
});

describe('D-5 · hardDeleteUser tears down Vercel + purges the Vault KEK', () => {
  it('tears down every live project deployment before the cascade', async () => {
    const outcome = await hardDeleteUser(VICTIM);
    expect(outcome.purged).toBe(true);
    expect(deletedAuthIds).toContain(VICTIM);
    // Both named projects were torn down, as this user.
    expect(teardownCalls).toEqual([
      { userId: VICTIM, name: 'Mein Shop' },
      { userId: VICTIM, name: 'Portfolio' },
    ]);
  });

  it('calls delete_user_kek with the user id', async () => {
    await hardDeleteUser(VICTIM);
    const kek = rpcCalls.find((r) => r.fn === 'delete_user_kek');
    expect(kek).toBeTruthy();
    expect(kek!.args).toEqual({ p_user_id: VICTIM });
  });

  it('tolerates a missing 0090 RPC (pre-migration DB) — delete still completes', async () => {
    rpcError = { code: '42883', message: 'function public.delete_user_kek(uuid) does not exist' };
    const outcome = await hardDeleteUser(VICTIM);
    expect(outcome.purged).toBe(true); // KEK-purge failure is non-fatal
    expect(deletedAuthIds).toContain(VICTIM);
  });

  it('a failed Vercel teardown does not block the user\'s PII deletion', async () => {
    teardownResult = { ok: false, status: 500, alreadyGone: false, error: 'vercel 500' };
    const outcome = await hardDeleteUser(VICTIM);
    expect(outcome.purged).toBe(true);
    expect(deletedAuthIds).toContain(VICTIM);
  });
});
