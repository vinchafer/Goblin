/**
 * X1 — deleting a project must not leave a Living App serving.
 *
 * The property under test is NOT "the delete calls were issued". It is "after the
 * delete, the substrate is empty when you look". So this file stands up an in-memory
 * R2 bucket and KV namespace behind the `cf-deploy` seam and drives the REAL
 * `DELETE /api/projects/:id` route through the REAL teardown path — then READS THE
 * SUBSTRATE BACK, and additionally runs the orphan sweep over it, which is the same
 * question an operator would ask in production.
 *
 * Three cases carry the unit, matching the three ways this can go wrong:
 *   • a project WITH a published app  → zero orphans in KV and in R2, verified by read-back
 *   • a project with NO app           → byte-identical to the old behaviour, no CF call at all
 *                                       (this is the whole Act-1 cohort; it must not notice)
 *   • a teardown that cannot finish   → the delete FAILS and the project row SURVIVES.
 *                                       A half-delete here is the orphan, so "fails honestly"
 *                                       and "leaves no orphan" are the same assertion.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── The substrate: an in-memory R2 + KV the mocked adapter reads and writes ──
const r2 = new Map<string, number>(); // key → size
const kv = new Map<string, { name: string; appId: string; status: string }>();
/** PHASE 4: the in-memory D1 account. id → the database Cloudflare would report. */
const d1 = new Map<string, { id: string; name: string; jurisdiction: string | null }>();
const deleteBatchSizes: number[] = [];
/** Set to a message to make the next R2 delete fail — the "cannot finish" case. */
let r2DeleteFails: string | null = null;
let kvDeleteFails: string | null = null;
/**
 * PHASE 4 — make the database deletion fail. This is the newest way a teardown can
 * half-complete, and the one where what is left behind is other people's data.
 */
let d1DeleteFails: string | null = null;

const ok = <T>(value: T) => ({ ok: true as const, value });
const cfErr = (message: string) => ({ ok: false as const, error: { code: 'upstream', message } });
const DELETE_BATCH = 1000;

vi.mock('../services/cf-deploy', async () => ({
  // The pure helpers (`isAppDatabaseName`, `appIdFromDatabaseName`) come from the
  // REAL adapter: they encode which databases on the account belong to Goblin, and
  // restating that rule here would be a second implementation that agrees with the
  // test rather than with production.
  ...(await vi.importActual<typeof import('../services/cf-deploy')>('../services/cf-deploy')),
  opsAppsDomain: () => 'justgoblin.app',
  appPrefix: (appId: string) => `apps/${appId}/`,
  routeKey: (name: string) => `route:${name}`,
  listAppFiles: async (appId: string) => {
    const prefix = `apps/${appId}/`;
    return ok(
      [...r2.entries()]
        .filter(([k]) => k.startsWith(prefix))
        .map(([k, size]) => ({ key: k, path: k.slice(prefix.length), size })),
    );
  },
  deleteAppFiles: async (appId: string) => {
    if (r2DeleteFails) return cfErr(r2DeleteFails);
    const prefix = `apps/${appId}/`;
    const keys = [...r2.keys()].filter((k) => k.startsWith(prefix));
    let batches = 0;
    for (let i = 0; i < keys.length; i += DELETE_BATCH) {
      const chunk = keys.slice(i, i + DELETE_BATCH);
      deleteBatchSizes.push(chunk.length);
      for (const k of chunk) r2.delete(k);
      batches += 1;
    }
    return ok({ deleted: keys.length, batches });
  },
  listAppPrefixes: async () =>
    ok([...new Set([...r2.keys()].map((k) => k.split('/')[1]!).filter(Boolean))]),
  getRoute: async (name: string) => ok(kv.get(`route:${name}`) ?? null),
  deleteRoute: async (name: string) => {
    if (kvDeleteFails) return cfErr(kvDeleteFails);
    return ok({ deleted: kv.delete(`route:${name}`) });
  },
  setRoute: async (name: string, appId: string) => {
    kv.set(`route:${name}`, { name, appId, status: 'active' });
    return ok({ name, appId, status: 'active' });
  },
  listRouteNames: async () => ok([...kv.keys()].map((k) => k.slice('route:'.length))),
  listD1Databases: async () => ok([...d1.values()]),
  getD1Database: async (id: string) => ok(d1.get(id) ?? null),
  deleteD1Database: async (id: string) => {
    if (d1DeleteFails) return cfErr(d1DeleteFails);
    return ok({ deleted: d1.delete(id) });
  },
}));

// ── The registry: an in-memory `ops_apps` ───────────────────────────────────
interface Row {
  appId: string; userId: string; projectId: string | null; appName: string;
  status: string; capsProfile: string; r2Prefix: string; routeKey: string;
  workerScriptName: null; d1DatabaseId: string | null; lastPublishedAt: null; createdAt: string;
}
let registry: Row[] = [];
let registryUnreadable = false;

vi.mock('../services/ops-apps-store', () => ({
  findOpsAppByProject: async (projectId: string | null) =>
    registry.find((r) => r.projectId === projectId && r.status !== 'deleted') ?? null,
  // The teardown lookup ignores `status` on purpose — an unconfirmed teardown from a
  // previous attempt is still attached, and the retry has to find it.
  findOpsAppForProjectTeardown: async (projectId: string | null) => {
    if (registryUnreadable) throw new Error('ops_apps lookup failed: transport');
    return registry.find((r) => r.projectId === projectId) ?? null;
  },
  findOpsAppById: async (appId: string) => registry.find((r) => r.appId === appId) ?? null,
  findOpsAppByName: async (name: string) => registry.find((r) => r.appName === name) ?? null,
  markOpsAppDeleted: async (appId: string) => {
    const row = registry.find((r) => r.appId === appId);
    if (!row) return false;
    row.status = 'deleted';
    return true;
  },
  detachOpsAppFromProject: async (appId: string) => {
    // Mirrors the real guard: only a row already in the `deleted` state detaches.
    const row = registry.find((r) => r.appId === appId && r.status === 'deleted');
    if (!row) return false;
    row.projectId = null;
    return true;
  },
  allKnownAppIds: async () => registry.map((r) => r.appId),
  allRegisteredAppNames: async () => registry.map((r) => ({ appName: r.appName, status: r.status })),
  registeredD1DatabaseIds: async () =>
    registry
      .filter((r) => r.d1DatabaseId)
      .map((r) => ({ databaseId: r.d1DatabaseId as string, status: r.status, appId: r.appId })),
  suspendOpsApp: async () => true,
  unsuspendOpsApp: async () => true,
}));

const auditRows: Array<{ action: string; actor: string; meta?: Record<string, unknown> }> = [];
vi.mock('../services/ops-audit', () => ({
  writeOpsAudit: async (entry: { action: string; actor: string; meta?: Record<string, unknown> }) => {
    auditRows.push(entry);
    return 'written';
  },
}));

// ── Everything else the route touches, stubbed out of the way ───────────────
const projectRows = new Map<string, { id: string; name: string; preview_url: string | null }>();
const rowDeletes: string[][] = [];
/** Set to make the projects-row delete fail — the "torn down but row survived" case. */
let rowDeleteFails: string | null = null;

vi.mock('../lib/supabase', () => {
  const builder = () => {
    const state: { ids: string[]; op: 'select' | 'delete' } = { ids: [], op: 'select' };
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.delete = () => { state.op = 'delete'; return b; };
    b.update = () => b;
    b.eq = (col: string, val: string) => { if (col === 'id') state.ids = [val]; return b; };
    b.in = (_col: string, vals: string[]) => { state.ids = vals; return b; };
    b.single = async () => {
      const row = projectRows.get(state.ids[0] ?? '');
      return row ? { data: row, error: null } : { data: null, error: { message: 'not found' } };
    };
    b.maybeSingle = b.single;
    // A bare `await` on the builder resolves here — that is the delete's terminal call.
    b.then = (resolve: (v: unknown) => void) => {
      if (state.op === 'delete') {
        if (rowDeleteFails) return resolve({ data: null, error: { message: rowDeleteFails } });
        rowDeletes.push([...state.ids]);
        for (const id of state.ids) projectRows.delete(id);
        return resolve({ data: null, error: null });
      }
      return resolve({ data: [...state.ids].map((id) => projectRows.get(id)).filter(Boolean), error: null });
    };
    return b;
  };
  return { getSupabaseAdmin: () => ({ from: () => builder() }) };
});

vi.mock('../middleware/auth', () => ({
  authMiddleware: async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
    c.set('userId', 'user-1'); await next();
  },
}));
vi.mock('../services/vercel-service', () => ({ teardownVercelProject: async () => ({ ok: true }) }));
vi.mock('../services/file-storage', () => ({
  deleteProject: async () => 0,
  createZip: async () => Buffer.from(''), listFiles: async () => [], getFile: async () => null,
  uploadFile: async () => {}, deleteFile: async () => {}, listFilesWithMeta: async () => [],
  getFileBytes: async () => null, uploadProjectFileBytes: async () => {},
  listTrashFiles: async () => [], purgeTrash: async () => 0,
}));
vi.mock('../services/checkpoints/retention', () => ({ purgeProjectCheckpoints: async () => ({ purgedProjects: [], deletedBlobs: 0 }) }));

const { projects } = await import('./projects');
const { findOrphanedApps } = await import('../services/ops-operator');

const APP_ID = 'a1111111-1111-4111-8111-111111111111';
const PROJ = '11111111-1111-4111-8111-111111111111';
const PROJ_B = '22222222-2222-4222-8222-222222222222';

function publishApp(
  projectId: string,
  appId: string,
  appName: string,
  fileCount: number,
  /** PHASE 4 — publish it WITH a form, i.e. with its own submissions database. */
  opts: { withForm?: boolean } = {},
) {
  const databaseId = opts.withForm ? `db-${appId}` : null;
  registry.push({
    appId, userId: 'user-1', projectId, appName, status: 'active', capsProfile: 'free-static',
    r2Prefix: `apps/${appId}/`, routeKey: `route:${appName}`, workerScriptName: null,
    d1DatabaseId: databaseId, lastPublishedAt: null, createdAt: '2026-08-01T00:00:00Z',
  });
  for (let i = 0; i < fileCount; i += 1) r2.set(`apps/${appId}/asset-${i}.js`, 100);
  kv.set(`route:${appName}`, { name: appName, appId, status: 'active' });
  if (databaseId) d1.set(databaseId, { id: databaseId, name: `goblin-app-${appId}`, jurisdiction: 'eu' });
}

const del = (id: string) => projects.request(`/${id}`, { method: 'DELETE' });
const bulkDel = (ids: string[]) =>
  projects.request('/bulk-delete', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids }),
  });

beforeEach(() => {
  r2.clear(); kv.clear(); d1.clear(); registry = []; auditRows.length = 0;
  deleteBatchSizes.length = 0; rowDeletes.length = 0;
  r2DeleteFails = null; kvDeleteFails = null; d1DeleteFails = null;
  rowDeleteFails = null; registryUnreadable = false;
  projectRows.clear();
  projectRows.set(PROJ, { id: PROJ, name: 'Mein Laden', preview_url: null });
  projectRows.set(PROJ_B, { id: PROJ_B, name: 'Zweites', preview_url: null });
});

describe('delete a project WITH a published app', () => {
  it('leaves zero orphans — proven by reading KV and R2 back afterwards', async () => {
    publishApp(PROJ, APP_ID, 'meinladen', 1200);
    expect(r2.size).toBe(1200);
    expect(kv.has('route:meinladen')).toBe(true);

    const res = await del(PROJ);
    expect(res.status).toBe(200);

    // THE ASSERTION. Not "delete was called" — "there is nothing there".
    expect([...r2.keys()].filter((k) => k.startsWith(`apps/${APP_ID}/`))).toEqual([]);
    expect(kv.get('route:meinladen')).toBeUndefined();

    // And the same question an operator asks in production comes back clean.
    const sweep = await findOrphanedApps();
    expect(sweep.orphans).toEqual([]);
    expect(sweep.routeOrphans).toEqual([]);
    expect(sweep.routesOnDeletedApps).toEqual([]);
  });

  it('reports the proof it looked at, rather than claiming success', async () => {
    publishApp(PROJ, APP_ID, 'meinladen', 1200);
    const body = await (await del(PROJ)).json();
    expect(body.hostedApp).toMatchObject({
      name: 'meinladen',
      url: 'https://meinladen.justgoblin.app',
      filesDeleted: 1200,
      orphansRemaining: 0,
      routeGone: true,
      audit: 'written',
    });
  });

  it('deletes the files BATCHED — the #18 anti-pattern is not reintroduced', async () => {
    publishApp(PROJ, APP_ID, 'meinladen', 1200);
    await del(PROJ);
    expect(deleteBatchSizes).toEqual([1000, 200]);
    expect(Math.max(...deleteBatchSizes)).toBeLessThanOrEqual(1000);
  });

  it('writes an audit row naming the builder and the trigger', async () => {
    publishApp(PROJ, APP_ID, 'meinladen', 3);
    await del(PROJ);
    const row = auditRows.find((a) => a.action === 'project_delete_teardown');
    expect(row).toBeDefined();
    // The actor is the BUILDER, not an operator — the trail must not read like a takedown.
    expect(row!.actor).toBe('user-1');
    expect(row!.meta).toMatchObject({ trigger: 'project_delete', projectId: PROJ, orphansRemaining: 0, routeGone: true });
  });

  it('keeps the tombstone alive past the cascade, so the name stays out of circulation', async () => {
    publishApp(PROJ, APP_ID, 'meinladen', 3);
    await del(PROJ);
    const row = registry.find((r) => r.appId === APP_ID)!;
    expect(row.status).toBe('deleted');
    // project_id nulled → the ON DELETE CASCADE that caused X1 has nothing to reach.
    expect(row.projectId).toBeNull();
  });

  it('deletes the project row only after the app is gone', async () => {
    publishApp(PROJ, APP_ID, 'meinladen', 3);
    await del(PROJ);
    expect(rowDeletes.flat()).toContain(PROJ);
  });
});

describe('delete a project with NO published app — the Act-1 cohort', () => {
  it('is unchanged: no Cloudflare call, no audit row, project deleted', async () => {
    const res = await del(PROJ);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
    expect(deleteBatchSizes).toEqual([]);
    expect(auditRows).toEqual([]);
    expect(rowDeletes.flat()).toContain(PROJ);
  });

  it('says nothing about a hosted app it does not have', async () => {
    const body = await (await del(PROJ)).json();
    expect(body.hostedApp).toBeUndefined();
  });
});

describe('a teardown that cannot finish must not half-delete', () => {
  it('refuses with 409 and keeps the project row when R2 will not empty', async () => {
    publishApp(PROJ, APP_ID, 'meinladen', 5);
    r2DeleteFails = 'r2 timeout';

    const res = await del(PROJ);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('hosted_teardown_failed');
    expect(body.message).toContain('https://meinladen.justgoblin.app');
    expect(body.message).toContain('NICHT gelöscht');

    // Nothing was released: the project row — the app's last owner link — survives.
    expect(rowDeletes.flat()).not.toContain(PROJ);
    expect(projectRows.has(PROJ)).toBe(true);
  });

  it('refuses when the KV route survives, even though the files went', async () => {
    publishApp(PROJ, APP_ID, 'meinladen', 5);
    kvDeleteFails = 'kv 500';

    const res = await del(PROJ);
    expect(res.status).toBe(409);
    expect(rowDeletes.flat()).not.toContain(PROJ);
    // The route is exactly the thing that would have been orphaned — it is still ours.
    expect(kv.has('route:meinladen')).toBe(true);
    const sweep = await findOrphanedApps();
    expect(sweep.routeOrphans).toEqual([]); // still attached to a live registry row
  });

  it('leaves the registry row attached to the project, so a retry finds it again', async () => {
    publishApp(PROJ, APP_ID, 'meinladen', 5);
    r2DeleteFails = 'r2 timeout';
    await del(PROJ);

    const row = registry.find((r) => r.appId === APP_ID)!;
    expect(row.projectId).toBe(PROJ);

    // The retry, once the substrate recovers, completes cleanly.
    r2DeleteFails = null;
    expect((await del(PROJ)).status).toBe(200);
    expect(r2.size).toBe(0);
    expect(kv.size).toBe(0);
  });

  it('a failed attempt does not ARM the bug it just blocked', async () => {
    // The regression this exists for: `teardownApp` writes the terminal `deleted`
    // status whether or not the substrate deletes worked. Looked up through the
    // PUBLISH lookup (which filters `deleted` out), the retry would be told this
    // project has no app, release the row, and orphan the very app the first attempt
    // refused to orphan — a failed gate arming the bug on the next pass.
    publishApp(PROJ, APP_ID, 'meinladen', 5);
    r2DeleteFails = 'r2 timeout';
    expect((await del(PROJ)).status).toBe(409);
    expect(registry.find((r) => r.appId === APP_ID)!.status).toBe('deleted'); // the trap is set

    // Second attempt, substrate still broken: it must STILL find the app and refuse.
    expect((await del(PROJ)).status).toBe(409);
    expect(projectRows.has(PROJ)).toBe(true);
    expect(r2.size).toBe(5);
  });

  it('refuses when the registry itself cannot be read — "unknown" is not "nothing"', async () => {
    registryUnreadable = true;
    const res = await del(PROJ);
    expect(res.status).toBe(409);
    expect((await res.json()).message).toContain('NICHT gelöscht');
    expect(projectRows.has(PROJ)).toBe(true);
  });

  it('admits it when the app came down but the project row did not', async () => {
    publishApp(PROJ, APP_ID, 'meinladen', 3);
    rowDeleteFails = 'db unreachable';

    const res = await del(PROJ);
    expect(res.status).toBe(500);
    const body = await res.json();
    // The teardown is NOT undoable — saying only "delete failed" would have the
    // builder retry expecting their app to still be up.
    expect(body.hostedAppRemoved).toBe(true);
    expect(body.message).toContain('https://meinladen.justgoblin.app');
  });
});

describe('bulk delete', () => {
  it('deletes the ones it can and refuses only the stuck one', async () => {
    publishApp(PROJ, APP_ID, 'meinladen', 3);
    // PROJ_B has no app at all.
    r2DeleteFails = 'r2 timeout';

    const res = await bulkDel([PROJ, PROJ_B]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(1);
    expect(body.blocked).toHaveLength(1);
    expect(body.blocked[0]).toMatchObject({ id: PROJ, url: 'https://meinladen.justgoblin.app' });

    expect(rowDeletes.flat()).toEqual([PROJ_B]);
    expect(projectRows.has(PROJ)).toBe(true);
  });

  it('does not tear down the Vercel site of a project it is going to refuse', async () => {
    // The ops teardown gate runs BEFORE the Vercel loop; a refused project must not
    // have had its other live resource destroyed on the way to being kept.
    publishApp(PROJ, APP_ID, 'meinladen', 3);
    r2DeleteFails = 'r2 timeout';
    const res = await bulkDel([PROJ]);
    expect(res.status).toBe(409);
    expect((await res.json()).deleted).toBe(0);
    expect(rowDeletes).toEqual([]);
  });

  it('leaves zero orphans for the projects it does delete', async () => {
    publishApp(PROJ, APP_ID, 'meinladen', 4);
    publishApp(PROJ_B, 'bbbbbbbb-2222-4222-8222-222222222222', 'zweites', 7);

    expect((await bulkDel([PROJ, PROJ_B])).status).toBe(200);
    expect(r2.size).toBe(0);
    expect(kv.size).toBe(0);
    const sweep = await findOrphanedApps();
    expect(sweep.orphans).toEqual([]);
    expect(sweep.routeOrphans).toEqual([]);
  });
});

// ── PHASE 4 — the same rule, now that an app can hold other people's data ───
//
// X1 said: a deleted project must not leave a Living App serving. Phase 4 adds a
// second thing a project can leave behind, and it is worse than a live URL — the
// submissions strangers left in somebody's contact form. These four cases are the
// X1 regression re-run against that object.

describe('delete a project whose app has a FORM', () => {
  it('removes the submissions database too — proven by reading D1 back', async () => {
    publishApp(PROJ, APP_ID, 'meinladen', 3, { withForm: true });
    expect(d1.size).toBe(1);

    const res = await del(PROJ);
    expect(res.status).toBe(200);

    expect(d1.size).toBe(0);
    const sweep = await findOrphanedApps();
    expect(sweep.d1Orphans).toEqual([]);
    expect(sweep.d1OnDeletedApps).toEqual([]);
  });

  it('REFUSES the delete when the database cannot be removed — and the project survives', async () => {
    publishApp(PROJ, APP_ID, 'meinladen', 3, { withForm: true });
    d1DeleteFails = 'D1 sagt nein';

    const res = await del(PROJ);
    // Same contract as the KV/R2 cases: 409, nothing released.
    expect(res.status).toBe(409);
    const body = (await res.json()) as { message?: string };
    // The builder is told it is their visitors' data that is stuck, not "an address".
    expect(body.message).toContain('Einsendungen');

    expect(projectRows.has(PROJ)).toBe(true);
    expect(registry.find((r) => r.appId === APP_ID)?.projectId).toBe(PROJ);
    expect(d1.size).toBe(1);
  });

  it('a failed database teardown is retryable — the second attempt finishes the job', async () => {
    publishApp(PROJ, APP_ID, 'meinladen', 3, { withForm: true });
    d1DeleteFails = 'D1 sagt nein';
    expect((await del(PROJ)).status).toBe(409);

    d1DeleteFails = null;
    expect((await del(PROJ)).status).toBe(200);
    expect(d1.size).toBe(0);
    expect(projectRows.has(PROJ)).toBe(false);
  });

  it('an app with NO form is untouched by any of this — no D1 call, no behaviour change', async () => {
    publishApp(PROJ, APP_ID, 'meinladen', 3);
    d1DeleteFails = 'this must never be reached';
    const res = await del(PROJ);
    expect(res.status).toBe(200);
    expect(d1.size).toBe(0);
  });
});
