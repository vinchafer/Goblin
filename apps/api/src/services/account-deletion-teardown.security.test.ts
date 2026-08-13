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

// ── X1: the Living-App teardown, at the seam ────────────────────────────────────
// `teardownApp` is the Phase-2 path and is proven against a real in-memory R2 + KV in
// routes/project-delete-orphans.test.ts. What this file owns is the CONTRACT around
// it: does account deletion run it, and does an unconfirmed result hold the cascade?
const appTeardowns: string[] = [];
const auditRows: Array<{ action?: string; actor: string; reason?: string | null }> = [];
let appTeardownOk = true;
vi.mock('./ops-operator', () => ({
  teardownApp: async (
    app: { appId: string },
    actor: string,
    reason: string,
    opts?: { action?: string },
  ) => {
    appTeardowns.push(app.appId);
    // The real teardownApp writes the evidence row itself; recording what it was
    // HANDED is the contract this file owns.
    auditRows.push({ action: opts?.action, actor, reason });
    if (appTeardownOk) {
      // The real path writes the terminal state; mirror it so the detach guard holds.
      const row = tables.ops_apps.find((r) => r.app_id === app.appId);
      if (row) row.status = 'deleted';
      return { ok: true, appId: app.appId, appName: 'meinshop', route: 'ok', registry: 'ok', audit: 'written', filesDeleted: 3, batches: 1, orphansRemaining: 0, routeGone: true };
    }
    return { ok: false, appId: app.appId, appName: 'meinshop', route: 'failed', registry: 'ok', audit: 'written', filesDeleted: 0, batches: 0, orphansRemaining: 3, routeGone: false, warning: 'Reste in R2' };
  },
}));

// ── in-memory supabase with .rpc support ─────────────────────────────────────────
type Row = Record<string, any>;
interface Tables { users: Row[]; account_deletions: Row[]; deletion_audit_log: Row[]; build_runs: Row[]; goblin_hosted_waitlist: Row[]; projects: Row[]; platform_events: Row[]; support_tickets: Row[]; feedback: Row[]; ops_apps: Row[]; }
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
  limit(_n: number) { return this; }
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
  appTeardowns.length = 0;
  auditRows.length = 0;
  appTeardownOk = true;
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
    // X1: no Living App by default — the pre-Act-2 fixture these tests were written for.
    ops_apps: [],
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

  // FW6-U3: a failed teardown now BLOCKS the cascade (was best-effort/non-blocking).
  // A deleted user's site MUST come down before we drop the project rows we need to
  // retry — mirroring the storage-purge blocking-throw in the same function.
  it('a failed Vercel teardown BLOCKS the PII cascade (site must come down first)', async () => {
    teardownResult = { ok: false, status: 500, alreadyGone: false, error: 'vercel 500' };
    await expect(hardDeleteUser(VICTIM)).rejects.toThrow(/vercel teardown incomplete/i);
    // The user is NOT auth-deleted and the project rows survive for the retry.
    expect(deletedAuthIds).not.toContain(VICTIM);
    expect(tables.projects.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('site comes down on a later pass → THEN the PII cascade proceeds (evidence)', async () => {
    // Pass 1: Vercel is erroring → teardown not confirmed → purge blocked, no delete.
    teardownResult = { ok: false, status: 500, alreadyGone: false, error: 'vercel 500' };
    await expect(hardDeleteUser(VICTIM)).rejects.toThrow(/vercel teardown incomplete/i);
    expect(deletedAuthIds).not.toContain(VICTIM);

    // Pass 2 (next cron run): the site is now gone (204/404) → teardown confirmed →
    // the cascade completes and the PII is finally dropped.
    teardownResult = { ok: true, status: 204, alreadyGone: false };
    const outcome = await hardDeleteUser(VICTIM);
    expect(outcome.purged).toBe(true);
    expect(deletedAuthIds).toContain(VICTIM);
    // Both live deployments were torn down across the two passes.
    expect(teardownCalls.filter((c) => c.name === 'Mein Shop').length).toBeGreaterThanOrEqual(1);
    expect(teardownCalls.filter((c) => c.name === 'Portfolio').length).toBeGreaterThanOrEqual(1);
  });
});

// ── X1 ──────────────────────────────────────────────────────────────────────
// `ops_apps` cascades from BOTH `projects` and `users`, so the auth cascade above
// drops a deleted user's Living-App rows while `{name}.justgoblin.app` keeps serving
// on Goblin's own plane — worse than the project-delete case, because there is no
// account left to ask. The same blocking posture the Vercel teardown already has.
describe('X1 · a deleted account must not leave a Living App serving', () => {
  const withApp = () => {
    tables.ops_apps = [{
      app_id: 'app-1', user_id: VICTIM, project_id: 'p1', app_name: 'meinshop', status: 'active',
      caps_profile: 'free-static', r2_prefix: 'apps/app-1/', route_key: 'route:meinshop',
      worker_script_name: null, d1_database_id: null, last_published_at: null,
      created_at: '2026-08-01T00:00:00Z',
    }];
  };

  it('tears the app down BEFORE the PII cascade', async () => {
    withApp();
    const outcome = await hardDeleteUser(VICTIM);
    expect(outcome.purged).toBe(true);
    expect(appTeardowns).toEqual(['app-1']);
    // Terminal state written, and the row detached so it survives the cascade as the
    // tombstone that keeps the name out of circulation.
    expect(tables.ops_apps[0]!.status).toBe('deleted');
    expect(tables.ops_apps[0]!.project_id).toBeNull();
  });

  it('an unconfirmed app teardown BLOCKS the cascade — the account survives for the retry', async () => {
    withApp();
    appTeardownOk = false;
    await expect(hardDeleteUser(VICTIM)).rejects.toThrow(/living-app teardown incomplete/i);
    expect(deletedAuthIds).not.toContain(VICTIM);
    // The rows we need to find the app again are all still here.
    expect(tables.projects.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(tables.ops_apps).toHaveLength(1);
  });

  it('records the takedown as system-initiated, not as an operator action', async () => {
    withApp();
    await hardDeleteUser(VICTIM);
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({ action: 'project_delete_teardown', actor: 'system' });
    expect(auditRows[0]!.reason).toMatch(/Art\. 17/);
  });
});
