/**
 * Vercel teardown on project delete (teardown- session).
 *
 * Proves the delete endpoints tear down the live Vercel site best-effort:
 *  - single delete calls teardown for the deleted project
 *  - bulk delete calls teardown once per owned project
 *  - a Vercel 404 (already gone) is tolerated → DB delete still completes
 *  - a teardown FAILURE never blocks the DB delete; the orphan URL is surfaced
 *  - ownership still holds: a user can't delete/tear down another user's project
 *
 * Exercises the real Hono router via `.request()` against an in-memory fake
 * Supabase, with vercel-service mocked (no network).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

type Row = Record<string, unknown>;
const store: { projects: Row[] } = { projects: [] };

const P_ALICE = '11111111-1111-4111-8111-111111111111';
const P_ALICE_2 = '55555555-5555-4555-8555-555555555555';
const P_BOB = '22222222-2222-4222-8222-222222222222';

function seed() {
  store.projects = [
    { id: P_ALICE, user_id: 'alice', name: 'Alice One', preview_url: 'https://alice-one.vercel.app', intent: 'web_app' },
    { id: P_ALICE_2, user_id: 'alice', name: 'Alice Two', preview_url: 'https://alice-two.vercel.app', intent: 'web_app' },
    { id: P_BOB, user_id: 'bob', name: 'Bob One', preview_url: 'https://bob-one.vercel.app', intent: 'web_app' },
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
    getUser: (token: string) => {
      const id = token?.startsWith('user:') ? token.slice(5) : null;
      return Promise.resolve(id ? { data: { user: { id } }, error: null } : { data: { user: null }, error: { message: 'bad' } });
    },
  },
};

// Teardown mock — default success; tests override return per case.
type TR = { ok: boolean; status: number; alreadyGone: boolean; error?: string };
const teardownVercelProject = vi.fn<() => Promise<TR>>(async () => ({ ok: true, status: 204, alreadyGone: false }));

vi.mock('../lib/supabase', () => ({ getSupabaseAdmin: () => fakeSupabase }));
vi.mock('../services/vercel-service', () => ({ teardownVercelProject }));
vi.mock('../services/file-storage', () => ({
  deleteProject: vi.fn(() => Promise.resolve()),
  createZip: vi.fn(), listFiles: vi.fn(), getFile: vi.fn(), uploadFile: vi.fn(),
  deleteFile: vi.fn(), listFilesWithMeta: vi.fn(), getFileBytes: vi.fn(), uploadProjectFileBytes: vi.fn(),
}));
vi.mock('../services/project-generator', () => ({ generateProject: vi.fn() }));
vi.mock('../services/model-router.js', () => ({ streamCompletionGuarded: vi.fn() }));
vi.mock('../lib/logger', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { projects } = await import('./projects');

const auth = (user: string) => ({ Authorization: `Bearer user:${user}`, 'Content-Type': 'application/json' });

beforeEach(() => {
  seed();
  teardownVercelProject.mockClear();
  teardownVercelProject.mockResolvedValue({ ok: true, status: 204, alreadyGone: false });
});

describe('single delete — teardown', () => {
  it('calls teardown with the project name, then removes the DB row', async () => {
    const res = await projects.request(`/${P_ALICE}`, { method: 'DELETE', headers: auth('alice') });
    expect(res.status).toBe(200);
    expect(teardownVercelProject).toHaveBeenCalledTimes(1);
    expect(teardownVercelProject).toHaveBeenCalledWith('alice', 'Alice One');
    expect(store.projects.find((p) => p.id === P_ALICE)).toBeFalsy();
  });

  it('tolerates a Vercel 404 (already gone) — DB delete still completes', async () => {
    teardownVercelProject.mockResolvedValue({ ok: true, status: 404, alreadyGone: true });
    const res = await projects.request(`/${P_ALICE}`, { method: 'DELETE', headers: auth('alice') });
    const body = await res.json() as { orphanUrl: string | null };
    expect(res.status).toBe(200);
    expect(body.orphanUrl).toBeNull();
    expect(store.projects.find((p) => p.id === P_ALICE)).toBeFalsy();
  });

  it('teardown failure does NOT block the delete and surfaces the orphan URL', async () => {
    teardownVercelProject.mockResolvedValue({ ok: false, status: 500, alreadyGone: false, error: 'boom' });
    const res = await projects.request(`/${P_ALICE}`, { method: 'DELETE', headers: auth('alice') });
    const body = await res.json() as { success: boolean; orphanUrl: string | null };
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.orphanUrl).toBe('https://alice-one.vercel.app');
    expect(store.projects.find((p) => p.id === P_ALICE)).toBeFalsy(); // still deleted
  });

  it("another user's project → 404, no teardown, row untouched", async () => {
    const res = await projects.request(`/${P_BOB}`, { method: 'DELETE', headers: auth('alice') });
    expect(res.status).toBe(404);
    expect(teardownVercelProject).not.toHaveBeenCalled();
    expect(store.projects.find((p) => p.id === P_BOB)).toBeTruthy();
  });
});

describe('bulk delete — teardown', () => {
  it('calls teardown once per owned project, then removes them', async () => {
    const res = await projects.request('/bulk-delete', {
      method: 'POST', headers: auth('alice'), body: JSON.stringify({ ids: [P_ALICE, P_ALICE_2] }),
    });
    const body = await res.json() as { deleted: number; orphans: unknown[] };
    expect(res.status).toBe(200);
    expect(body.deleted).toBe(2);
    expect(teardownVercelProject).toHaveBeenCalledTimes(2);
    expect(body.orphans).toEqual([]);
    expect(store.projects.filter((p) => p.user_id === 'alice')).toHaveLength(0);
  });

  it('forged id (other user) is never torn down or deleted', async () => {
    const res = await projects.request('/bulk-delete', {
      method: 'POST', headers: auth('alice'), body: JSON.stringify({ ids: [P_ALICE, P_BOB] }),
    });
    const body = await res.json() as { deleted: number };
    expect(body.deleted).toBe(1); // only alice's
    expect(teardownVercelProject).toHaveBeenCalledTimes(1);
    expect(teardownVercelProject).toHaveBeenCalledWith('alice', 'Alice One');
    expect(store.projects.find((p) => p.id === P_BOB)).toBeTruthy();
  });

  it('a per-project teardown failure surfaces in orphans but never blocks the cascade', async () => {
    teardownVercelProject
      .mockResolvedValueOnce({ ok: false, status: 500, alreadyGone: false, error: 'boom' }) // Alice One fails
      .mockResolvedValueOnce({ ok: true, status: 204, alreadyGone: false });                 // Alice Two ok
    const res = await projects.request('/bulk-delete', {
      method: 'POST', headers: auth('alice'), body: JSON.stringify({ ids: [P_ALICE, P_ALICE_2] }),
    });
    const body = await res.json() as { deleted: number; orphans: Array<{ id: string; url: string | null }> };
    expect(body.deleted).toBe(2);
    expect(body.orphans).toHaveLength(1);
    expect(body.orphans[0]!.url).toBe('https://alice-one.vercel.app');
    expect(store.projects.filter((p) => p.user_id === 'alice')).toHaveLength(0); // both deleted
  });
});
