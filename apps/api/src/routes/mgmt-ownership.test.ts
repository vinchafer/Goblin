/**
 * Project/Chat management — ownership enforcement (rule b).
 *
 * Proves that rename / delete / move / bulk endpoints are scoped to the
 * authenticated user server-side: a forged or mixed id list can NEVER touch
 * another user's rows. Exercises the real Hono routers via `.request()` against
 * an in-memory fake Supabase — no network, no DB.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── In-memory fake Supabase ──────────────────────────────────────────────────
// Two users, each owning one project and one chat. The query builder mirrors the
// subset of the supabase-js chain the handlers use (from/select/eq/in/update/
// delete/single/order/limit) and resolves filters against the store on await.

type Row = Record<string, unknown>;
const store: { projects: Row[]; chat_sessions: Row[] } = { projects: [], chat_sessions: [] };

// Valid UUIDs so the zod `.uuid()` guards on the bulk routes accept them.
const P_ALICE = '11111111-1111-4111-8111-111111111111';
const P_BOB = '22222222-2222-4222-8222-222222222222';
const C_ALICE = '33333333-3333-4333-8333-333333333333';
const C_BOB = '44444444-4444-4444-8444-444444444444';

function seed() {
  store.projects = [
    { id: P_ALICE, user_id: 'alice', name: 'Alice Project', intent: 'web_app' },
    { id: P_BOB, user_id: 'bob', name: 'Bob Project', intent: 'web_app' },
  ];
  store.chat_sessions = [
    { id: C_ALICE, user_id: 'alice', title: 'Alice Chat', project_id: null },
    { id: C_BOB, user_id: 'bob', title: 'Bob Chat', project_id: P_BOB },
  ];
}

class Builder {
  private eqs: [string, unknown][] = [];
  private ins: [string, unknown[]][] = [];
  private op: 'select' | 'delete' | 'update' = 'select';
  private payload: Row = {};
  constructor(private table: keyof typeof store) {}
  select() { this.op = 'select'; return this; }
  delete() { this.op = 'delete'; return this; }
  update(p: Row) { this.op = 'update'; this.payload = p; return this; }
  insert() { return this; }
  eq(col: string, val: unknown) { this.eqs.push([col, val]); return this; }
  in(col: string, vals: unknown[]) { this.ins.push([col, vals]); return this; }
  order() { return this; }
  limit() { return this.resolve(); }
  private match(r: Row): boolean {
    return this.eqs.every(([c, v]) => r[c] === v) && this.ins.every(([c, vs]) => vs.includes(r[c]));
  }
  private resolve() {
    const rows = store[this.table];
    const hit = rows.filter((r) => this.match(r));
    if (this.op === 'delete') {
      store[this.table] = rows.filter((r) => !this.match(r));
      return { data: null, error: null };
    }
    if (this.op === 'update') {
      hit.forEach((r) => Object.assign(r, this.payload));
      return { data: hit, error: null };
    }
    return { data: hit, error: null };
  }
  single() {
    const res = this.resolve();
    const data = (res.data as Row[] | null)?.[0] ?? null;
    return Promise.resolve({ data, error: data ? null : { message: 'not found' } });
  }
  maybeSingle() { return this.single(); }
  then(onF: (v: { data: unknown; error: unknown }) => unknown) { return Promise.resolve(this.resolve()).then(onF); }
}

const fakeSupabase = {
  from: (t: keyof typeof store) => new Builder(t),
  auth: {
    // token "user:<id>" → that user; anything else → no user.
    getUser: (token: string) => {
      const id = token?.startsWith('user:') ? token.slice(5) : null;
      return Promise.resolve(id ? { data: { user: { id } }, error: null } : { data: { user: null }, error: { message: 'bad' } });
    },
  },
};

vi.mock('../lib/supabase', () => ({ getSupabaseAdmin: () => fakeSupabase }));
vi.mock('../services/file-storage', () => ({
  deleteProject: vi.fn(() => Promise.resolve()),
  createZip: vi.fn(), listFiles: vi.fn(), getFile: vi.fn(), uploadFile: vi.fn(),
  deleteFile: vi.fn(), listFilesWithMeta: vi.fn(), getFileBytes: vi.fn(), uploadProjectFileBytes: vi.fn(),
}));
vi.mock('../services/project-generator', () => ({ generateProject: vi.fn() }));
vi.mock('../services/model-router.js', () => ({ streamCompletionGuarded: vi.fn() }));
vi.mock('../lib/logger', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { projects } = await import('./projects');
const { chatSessions } = await import('./chat-sessions');

const auth = (user: string) => ({ Authorization: `Bearer user:${user}`, 'Content-Type': 'application/json' });

beforeEach(seed);

describe('projects — ownership', () => {
  it('PATCH rename of another user\'s project → 404, name unchanged', async () => {
    const res = await projects.request(`/${P_BOB}`, { method: 'PATCH', headers: auth('alice'), body: JSON.stringify({ name: 'HACKED' }) });
    expect(res.status).toBe(404);
    expect(store.projects.find((p) => p.id === P_BOB)!.name).toBe('Bob Project');
  });

  it('PATCH rename of own project → succeeds', async () => {
    const res = await projects.request(`/${P_ALICE}`, { method: 'PATCH', headers: auth('alice'), body: JSON.stringify({ name: 'Renamed' }) });
    expect(res.status).toBe(200);
    expect(store.projects.find((p) => p.id === P_ALICE)!.name).toBe('Renamed');
  });

  it('bulk-delete with a mixed id list only removes owned rows (forged ids = no-op)', async () => {
    const res = await projects.request('/bulk-delete', { method: 'POST', headers: auth('alice'), body: JSON.stringify({ ids: [P_ALICE, P_BOB] }) });
    const body = await res.json() as { deleted: number };
    expect(res.status).toBe(200);
    expect(body.deleted).toBe(1); // only p-alice
    expect(store.projects.find((p) => p.id === P_BOB)).toBeTruthy(); // Bob untouched
    expect(store.projects.find((p) => p.id === P_ALICE)).toBeFalsy();
  });
});

describe('chat_sessions — ownership', () => {
  it('bulk-delete with a forged id list cannot touch another user\'s chat', async () => {
    const res = await chatSessions.request('/bulk-delete', { method: 'POST', headers: auth('alice'), body: JSON.stringify({ ids: [C_ALICE, C_BOB] }) });
    expect(res.status).toBe(200);
    expect(store.chat_sessions.find((c) => c.id === C_BOB)).toBeTruthy(); // Bob's chat survives
    expect(store.chat_sessions.find((c) => c.id === C_ALICE)).toBeFalsy();
  });

  it('move into another user\'s project → 404, chat unchanged', async () => {
    const res = await chatSessions.request(`/${C_ALICE}/move`, { method: 'PATCH', headers: auth('alice'), body: JSON.stringify({ projectId: P_BOB }) });
    expect(res.status).toBe(404);
    expect(store.chat_sessions.find((c) => c.id === C_ALICE)!.project_id).toBeNull();
  });

  it('move own chat into own project → succeeds', async () => {
    const res = await chatSessions.request(`/${C_ALICE}/move`, { method: 'PATCH', headers: auth('alice'), body: JSON.stringify({ projectId: P_ALICE }) });
    expect(res.status).toBe(200);
    expect(store.chat_sessions.find((c) => c.id === C_ALICE)!.project_id).toBe(P_ALICE);
  });

  it('move chat to null ("Kein Projekt") → succeeds', async () => {
    store.chat_sessions.find((c) => c.id === C_BOB)!.user_id = 'alice'; // give alice a project-bound chat
    store.chat_sessions.find((c) => c.id === C_BOB)!.project_id = P_ALICE;
    const res = await chatSessions.request(`/${C_BOB}/move`, { method: 'PATCH', headers: auth('alice'), body: JSON.stringify({ projectId: null }) });
    expect(res.status).toBe(200);
    expect(store.chat_sessions.find((c) => c.id === C_BOB)!.project_id).toBeNull();
  });

  it('bulk-move into another user\'s project → 404', async () => {
    const res = await chatSessions.request('/bulk-move', { method: 'POST', headers: auth('alice'), body: JSON.stringify({ ids: [C_ALICE], projectId: P_BOB }) });
    expect(res.status).toBe(404);
    expect(store.chat_sessions.find((c) => c.id === C_ALICE)!.project_id).toBeNull();
  });
});
