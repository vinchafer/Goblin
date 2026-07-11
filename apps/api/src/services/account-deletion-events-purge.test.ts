// I3 (WAVE-I insight) GATE: behaviour events join the account-deletion purge.
//
// platform_events carries NO FK to auth.users, so the auth cascade does NOT
// remove it — hardDeleteUser must delete it explicitly (GDPR Art. 17). This
// proves the target user's events are erased while a bystander's are untouched,
// with NO Stripe dependency: the fixture user has no customer/subscription, so
// the billing-safety gate is a no-op whether or not a Stripe key is present.

import { describe, it, expect, beforeEach, vi } from 'vitest';

type Row = Record<string, any>;
interface Tables {
  users: Row[];
  account_deletions: Row[];
  deletion_audit_log: Row[];
  build_runs: Row[];
  goblin_hosted_waitlist: Row[];
  projects: Row[];
  platform_events: Row[];
  support_tickets: Row[];
  feedback: Row[];
}
let tables: Tables;
const deletedAuthIds: string[] = [];

const match = (row: Row, filters: any[]) =>
  filters.every((f) => (f[0] === '__lte' ? new Date(row[f[1]]) <= new Date(f[2]) : row[f[0]] === f[1]));

class Query {
  filters: any[] = [];
  op = 'select';
  payload: any = null;
  conflict: string | null = null;
  _single = false;
  constructor(private table: keyof Tables) {}
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
  auth: {
    admin: {
      getUserById: async (id: string) => ({ data: { user: { id, email: `${id}@x.test` } }, error: null }),
      deleteUser: async (id: string) => { deletedAuthIds.push(id); return { error: null }; },
    },
  },
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

const VICTIM = 'purge-victim';
const BYSTANDER = 'purge-bystander';

beforeEach(() => {
  deletedAuthIds.length = 0;
  tables = {
    // No stripe_customer_id / stripe_subscription_id → billing gate is a no-op.
    users: [
      { id: VICTIM, email: `${VICTIM}@x.test`, stripe_customer_id: null, stripe_subscription_id: null, deleted_at: new Date().toISOString() },
      { id: BYSTANDER, email: `${BYSTANDER}@x.test`, stripe_customer_id: null, stripe_subscription_id: null, deleted_at: null },
    ],
    account_deletions: [{ user_id: VICTIM, status: 'pending' }],
    deletion_audit_log: [],
    build_runs: [{ id: 'br1', user_id: VICTIM }],
    goblin_hosted_waitlist: [],
    projects: [],
    platform_events: [
      { id: 'e1', event_type: 'project_created', user_id: VICTIM },
      { id: 'e2', event_type: 'message_sent', user_id: VICTIM },
      { id: 'e3', event_type: 'publish_verified', user_id: VICTIM },
      { id: 'e4', event_type: 'message_sent', user_id: BYSTANDER },
    ],
    support_tickets: [
      { id: 't1', user_id: VICTIM, kind: 'escalation', transcript: [{ role: 'user', content: 'hilfe' }] },
      { id: 't2', user_id: BYSTANDER, kind: 'escalation' },
    ],
    feedback: [
      { id: 'f1', user_id: VICTIM, category: 'idea', body: 'dark mode' },
      { id: 'f2', user_id: BYSTANDER, category: 'bug', body: 'oops' },
    ],
  };
});

describe('hardDeleteUser — platform_events purge (I3)', () => {
  it('erases the deleted user\'s behaviour events, leaves other users untouched', async () => {
    const outcome = await hardDeleteUser(VICTIM);
    expect(outcome.purged).toBe(true);
    expect(deletedAuthIds).toContain(VICTIM);

    // Victim's events are gone (they never cascade — no FK to auth.users).
    expect(tables.platform_events.filter((e) => e.user_id === VICTIM)).toHaveLength(0);
    // The bystander's event survives.
    expect(tables.platform_events.filter((e) => e.user_id === BYSTANDER)).toHaveLength(1);
    // And the existing cascade-gap cleanup still ran.
    expect(tables.build_runs.filter((r) => r.user_id === VICTIM)).toHaveLength(0);
  });

  it('erases the deleted user\'s support tickets + feedback, leaves bystander\'s (WAVE-J I3)', async () => {
    const outcome = await hardDeleteUser(VICTIM);
    expect(outcome.purged).toBe(true);
    // Victim's support transcript + feedback body (personal data, FK-less) are gone.
    expect(tables.support_tickets.filter((r) => r.user_id === VICTIM)).toHaveLength(0);
    expect(tables.feedback.filter((r) => r.user_id === VICTIM)).toHaveLength(0);
    // Bystander's rows survive.
    expect(tables.support_tickets.filter((r) => r.user_id === BYSTANDER)).toHaveLength(1);
    expect(tables.feedback.filter((r) => r.user_id === BYSTANDER)).toHaveLength(1);
  });
});
