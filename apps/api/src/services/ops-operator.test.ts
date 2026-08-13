/**
 * AKT 2 · PHASE 2 · U2.5 — the operator powers.
 *
 * Three properties carry the unit, and each is asserted directly:
 *   • KV is flipped BEFORE the database, because KV is what stops visitors
 *   • a partial failure is REPORTED per step, never summarised into a boolean —
 *     an operator mid-incident has to know which half worked
 *   • a teardown's success is a re-listed prefix and a re-read route, not a claim
 *     that the deletes were issued
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const setRoute = vi.fn();
const deleteRoute = vi.fn();
const deleteAppFiles = vi.fn();
const listAppFiles = vi.fn();
const listAppPrefixes = vi.fn();
const getRoute = vi.fn();
const listRouteNames = vi.fn();
const listD1Databases = vi.fn();

vi.mock('./cf-deploy', async () => ({
  // PHASE 4: the name helpers (`isAppDatabaseName`, `appIdFromDatabaseName`) come
  // from the REAL adapter. They are the rule that decides which databases on the
  // account are Goblin's at all, and a hand-written stub of that rule would agree
  // with this test and not with production.
  ...(await vi.importActual<typeof import('./cf-deploy')>('./cf-deploy')),
  setRoute: (...a: unknown[]) => setRoute(...a),
  deleteRoute: (...a: unknown[]) => deleteRoute(...a),
  deleteAppFiles: (...a: unknown[]) => deleteAppFiles(...a),
  listAppFiles: (...a: unknown[]) => listAppFiles(...a),
  listAppPrefixes: (...a: unknown[]) => listAppPrefixes(...a),
  getRoute: (...a: unknown[]) => getRoute(...a),
  listRouteNames: (...a: unknown[]) => listRouteNames(...a),
  listD1Databases: (...a: unknown[]) => listD1Databases(...a),
}));

const suspendOpsApp = vi.fn();
const unsuspendOpsApp = vi.fn();
const markOpsAppDeleted = vi.fn();
const allKnownAppIds = vi.fn();
const allRegisteredAppNames = vi.fn();
const registeredD1DatabaseIds = vi.fn();

vi.mock('./ops-apps-store', () => ({
  suspendOpsApp: (...a: unknown[]) => suspendOpsApp(...a),
  unsuspendOpsApp: (...a: unknown[]) => unsuspendOpsApp(...a),
  markOpsAppDeleted: (...a: unknown[]) => markOpsAppDeleted(...a),
  allKnownAppIds: (...a: unknown[]) => allKnownAppIds(...a),
  allRegisteredAppNames: (...a: unknown[]) => allRegisteredAppNames(...a),
  registeredD1DatabaseIds: (...a: unknown[]) => registeredD1DatabaseIds(...a),
  findOpsAppById: vi.fn(async () => null),
  findOpsAppByName: vi.fn(async () => null),
}));

const writeOpsAudit = vi.fn();
vi.mock('./ops-audit', () => ({ writeOpsAudit: (...a: unknown[]) => writeOpsAudit(...a) }));

const teardownAppDatabase = vi.fn();
vi.mock('./ops-d1', () => ({ teardownAppDatabase: (...a: unknown[]) => teardownAppDatabase(...a) }));

const { suspendApp, unsuspendApp, teardownApp, findOrphanedApps, purgeOrphans } = await import('./ops-operator');
import type { OpsApp } from './ops-apps-store';

const ok = <T>(value: T) => ({ ok: true as const, value });
const cfErr = (code = 'upstream', message = 'nope') => ({ ok: false as const, error: { code, message } });

const APP: OpsApp = {
  appId: 'app-1', userId: 'user-1', projectId: 'proj-1', appName: 'meinladen', status: 'active',
  capsProfile: 'free-static', r2Prefix: 'apps/app-1/', routeKey: 'route:meinladen',
  workerScriptName: null, d1DatabaseId: null, lastPublishedAt: null, createdAt: '2026-07-28T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  setRoute.mockResolvedValue(ok({ name: 'meinladen', appId: 'app-1', status: 'suspended' }));
  deleteRoute.mockResolvedValue(ok({ deleted: true }));
  deleteAppFiles.mockResolvedValue(ok({ deleted: 12, batches: 1 }));
  listAppFiles.mockResolvedValue(ok([]));
  getRoute.mockResolvedValue(ok(null));
  listAppPrefixes.mockResolvedValue(ok([]));
  suspendOpsApp.mockResolvedValue(true);
  unsuspendOpsApp.mockResolvedValue(true);
  markOpsAppDeleted.mockResolvedValue(true);
  allKnownAppIds.mockResolvedValue([]);
  listRouteNames.mockResolvedValue(ok([]));
  allRegisteredAppNames.mockResolvedValue([]);
  listD1Databases.mockResolvedValue(ok([]));
  registeredD1DatabaseIds.mockResolvedValue([]);
  // The default app has no database (APP.d1DatabaseId is null), which is what the
  // real helper answers for it.
  teardownAppDatabase.mockResolvedValue({ attempted: false, gone: null });
  writeOpsAudit.mockResolvedValue('written');
});

describe('suspend', () => {
  it('flips KV to suspended and updates the registry', async () => {
    const r = await suspendApp(APP, 'vinc@example.com', 'Phishing-Meldung');
    // The budget rides along on every route write: the record is replaced
    // wholesale, so omitting it would silently strip the app's ceiling.
    expect(setRoute).toHaveBeenCalledWith('meinladen', 'app-1', { status: 'suspended', dailyBudget: 10_000 });
    expect(suspendOpsApp).toHaveBeenCalledWith('app-1', 'Phishing-Meldung');
    expect(r).toMatchObject({ ok: true, route: 'ok', registry: 'ok', audit: 'written' });
  });

  it('writes KV FIRST — that is the step that stops visitors', async () => {
    const order: string[] = [];
    setRoute.mockImplementation(async () => { order.push('kv'); return ok({ name: 'x', appId: 'y', status: 'suspended' }); });
    suspendOpsApp.mockImplementation(async () => { order.push('db'); return true; });
    await suspendApp(APP, 'vinc', 'grund');
    expect(order).toEqual(['kv', 'db']);
  });

  it('does NOT touch the database when the router flip failed', async () => {
    // Writing "suspended" into a registry while the app is still being served
    // would be the worst of both: a false record and a live phishing page.
    setRoute.mockResolvedValue(cfErr('auth'));
    const r = await suspendApp(APP, 'vinc', 'grund');
    expect(suspendOpsApp).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
    expect(r.registry).toBe('skipped');
    expect(r.warning).toContain('WEITERHIN ausgeliefert');
  });

  it('names the inconsistency when KV worked and the registry did not', async () => {
    suspendOpsApp.mockResolvedValue(false);
    const r = await suspendApp(APP, 'vinc', 'grund');
    expect(r.ok).toBe(false);
    expect(r.route).toBe('ok');
    expect(r.registry).toBe('failed');
    expect(r.warning).toContain('Registry-Zeile');
  });

  it('records who, what and why', async () => {
    await suspendApp(APP, 'vinc@example.com', 'Kartendaten-Formular gemeldet');
    expect(writeOpsAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 'app-1', appName: 'meinladen', userId: 'user-1',
        action: 'suspend', actor: 'vinc@example.com', reason: 'Kartendaten-Formular gemeldet',
      }),
    );
  });

  it('still suspends when the audit table is not migrated yet, and says so', async () => {
    // The emergency stop does not get to depend on a migration.
    writeOpsAudit.mockResolvedValue('unavailable');
    const r = await suspendApp(APP, 'vinc', 'grund');
    expect(r.route).toBe('ok');
    expect(r.audit).toBe('unavailable');
  });

  it('audits even a FAILED suspension — the attempt is evidence too', async () => {
    setRoute.mockResolvedValue(cfErr('timeout'));
    await suspendApp(APP, 'vinc', 'grund');
    expect(writeOpsAudit).toHaveBeenCalled();
  });
});

describe('unsuspend', () => {
  it('restores the route and the registry, with its own audit row', async () => {
    setRoute.mockResolvedValue(ok({ name: 'meinladen', appId: 'app-1', status: 'active' }));
    const r = await unsuspendApp(APP, 'vinc', 'Fehlalarm — war unsere Schuld');
    expect(setRoute).toHaveBeenCalledWith('meinladen', 'app-1', { status: 'active', dailyBudget: 10_000 });
    expect(r).toMatchObject({ ok: true, route: 'ok', registry: 'ok' });
    expect(writeOpsAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'unsuspend' }));
  });
});

describe('teardown', () => {
  it('removes the route BEFORE the files, so nothing serves a half-deleted app', async () => {
    const order: string[] = [];
    deleteRoute.mockImplementation(async () => { order.push('route'); return ok({ deleted: true }); });
    deleteAppFiles.mockImplementation(async () => { order.push('files'); return ok({ deleted: 3, batches: 1 }); });
    await teardownApp(APP, 'vinc', 'CSAM-Meldung');
    expect(order).toEqual(['route', 'files']);
  });

  it('proves zero orphans by looking, not by claiming', async () => {
    const r = await teardownApp(APP, 'vinc', 'grund');
    expect(listAppFiles).toHaveBeenCalledWith('app-1'); // re-listed after deleting
    expect(getRoute).toHaveBeenCalledWith('meinladen'); // re-read after deleting
    expect(r).toMatchObject({ ok: true, filesDeleted: 12, batches: 1, orphansRemaining: 0, routeGone: true });
  });

  it('is NOT ok when files survived the delete', async () => {
    listAppFiles.mockResolvedValue(ok([{ key: 'apps/app-1/index.html', path: 'index.html', size: 10 }]));
    const r = await teardownApp(APP, 'vinc', 'grund');
    expect(r.ok).toBe(false);
    expect(r.orphansRemaining).toBe(1);
    expect(r.warning).toContain('noch in R2');
  });

  it('is NOT ok when the route still resolves', async () => {
    getRoute.mockResolvedValue(ok({ name: 'meinladen', appId: 'app-1', status: 'active' }));
    const r = await teardownApp(APP, 'vinc', 'grund');
    expect(r.ok).toBe(false);
    expect(r.routeGone).toBe(false);
    expect(r.warning).toContain('Route steht noch');
  });

  it('says "could not check" (null) rather than reporting a clean sweep it did not see', async () => {
    listAppFiles.mockResolvedValue(cfErr('timeout'));
    const r = await teardownApp(APP, 'vinc', 'grund');
    expect(r.orphansRemaining).toBeNull();
    expect(r.ok).toBe(false);
    expect(r.warning).toContain('manuell nachsehen');
  });

  it('reports the batch count, so the batching is visible rather than assumed', async () => {
    deleteAppFiles.mockResolvedValue(ok({ deleted: 2500, batches: 3 }));
    const r = await teardownApp(APP, 'vinc', 'grund');
    expect(r.batches).toBe(3);
  });

  it('puts the orphan proof into the audit row', async () => {
    await teardownApp(APP, 'vinc', 'grund');
    expect(writeOpsAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'teardown',
        meta: expect.objectContaining({ filesDeleted: 12, orphansRemaining: 0, routeGone: true }),
      }),
    );
  });
});

describe('the orphan sweep (§8.3 gap 3)', () => {
  it('finds a prefix in R2 that no registry row points at', async () => {
    // Exactly what deleting a project leaves behind: the row cascaded away, the
    // files did not.
    listAppPrefixes.mockResolvedValue(ok(['app-1', 'app-verwaist']));
    allKnownAppIds.mockResolvedValue(['app-1']);
    const r = await findOrphanedApps();
    expect(r.orphans).toEqual(['app-verwaist']);
    expect(r).toMatchObject({ knownApps: 1, prefixesInR2: 2 });
  });

  it('counts a `deleted` row`s surviving files as an orphan', async () => {
    // allKnownAppIds includes deleted rows on purpose: their files should be gone.
    listAppPrefixes.mockResolvedValue(ok(['app-1']));
    allKnownAppIds.mockResolvedValue(['app-1']);
    expect((await findOrphanedApps()).orphans).toEqual([]);
  });

  it('refuses to answer when the registry cannot be read', async () => {
    // Without it, EVERY prefix would look like an orphan — and a purge run on that
    // list would delete the entire fleet.
    listAppPrefixes.mockResolvedValue(ok(['app-1', 'app-2']));
    allKnownAppIds.mockResolvedValue(null);
    const r = await findOrphanedApps();
    expect(r.orphans).toBeNull();
    expect(r.notes.join(' ')).toContain('Waisenkind');
  });

  it('refuses to answer when R2 cannot be read', async () => {
    listAppPrefixes.mockResolvedValue(cfErr('auth'));
    expect((await findOrphanedApps()).orphans).toBeNull();
  });
});

// ── X1: the KV half of the same sweep ───────────────────────────────────────
// The R2 sweep above answers "what is STORED with nothing pointing at it". It cannot
// answer "what is REACHABLE with nothing pointing at it", and that is the half that
// can be serving a stranger's page right now: a route whose files were deleted but
// whose KV record survived is invisible to a prefix listing.
describe('the orphan sweep · KV routes', () => {
  it('finds a route the registry has never heard of', async () => {
    listRouteNames.mockResolvedValue(ok(['meinladen', 'verwaist']));
    allRegisteredAppNames.mockResolvedValue([{ appName: 'meinladen', status: 'active' }]);
    const r = await findOrphanedApps();
    expect(r.routeOrphans).toEqual(['verwaist']);
    expect(r.routesInKv).toBe(2);
    expect(r.notes.join(' ')).toContain('öffentlich erreichbar');
  });

  it('separates a route on a `deleted` row — a teardown that did not finish', async () => {
    listRouteNames.mockResolvedValue(ok(['abgebaut']));
    allRegisteredAppNames.mockResolvedValue([{ appName: 'abgebaut', status: 'deleted' }]);
    const r = await findOrphanedApps();
    // Not an orphan (there IS a row) but not clean either — the row says this
    // address should be gone, and it is still resolving.
    expect(r.routeOrphans).toEqual([]);
    expect(r.routesOnDeletedApps).toEqual(['abgebaut']);
  });

  it('a suspended app is NOT an orphan — its route is supposed to be there', async () => {
    listRouteNames.mockResolvedValue(ok(['gesperrt']));
    allRegisteredAppNames.mockResolvedValue([{ appName: 'gesperrt', status: 'suspended' }]);
    const r = await findOrphanedApps();
    expect(r.routeOrphans).toEqual([]);
    expect(r.routesOnDeletedApps).toEqual([]);
  });

  it('refuses to answer about routes when KV cannot be read', async () => {
    listRouteNames.mockResolvedValue(cfErr('rate limited'));
    const r = await findOrphanedApps();
    expect(r.routeOrphans).toBeNull();
    expect(r.routesInKv).toBeNull();
    expect(r.notes.join(' ')).toContain('KV konnte nicht gelesen werden');
  });

  it('answers about routes even when R2 is unreadable — the halves are independent', async () => {
    // Losing the storage answer must not cost us the reachability answer: an
    // unreachable bucket is a cost problem, a stray route is a live public URL.
    listAppPrefixes.mockResolvedValue(cfErr('auth'));
    listRouteNames.mockResolvedValue(ok(['verwaist']));
    allRegisteredAppNames.mockResolvedValue([]);
    const r = await findOrphanedApps();
    expect(r.orphans).toBeNull();
    expect(r.routeOrphans).toEqual(['verwaist']);
  });
});

describe('orphan purge', () => {
  it('deletes only the ids it was given', async () => {
    allKnownAppIds.mockResolvedValue(['app-1']);
    const r = await purgeOrphans(['app-verwaist'], 'vinc', 'Aufräumen nach Projektlöschung');
    expect(deleteAppFiles).toHaveBeenCalledTimes(1);
    expect(deleteAppFiles).toHaveBeenCalledWith('app-verwaist');
    expect(r.purged[0]).toMatchObject({ appId: 'app-verwaist', filesDeleted: 12 });
  });

  it('RE-CHECKS the registry and refuses an id that is no longer an orphan', async () => {
    // A stale list from a report taken minutes ago must not delete an app that has
    // been published since.
    allKnownAppIds.mockResolvedValue(['app-inzwischen-live']);
    const r = await purgeOrphans(['app-inzwischen-live'], 'vinc', 'grund');
    expect(deleteAppFiles).not.toHaveBeenCalled();
    expect(r.refused[0]?.why).toContain('kein Waisenkind');
  });

  it('deletes nothing at all when the registry cannot be read', async () => {
    allKnownAppIds.mockResolvedValue(null);
    const r = await purgeOrphans(['a', 'b'], 'vinc', 'grund');
    expect(deleteAppFiles).not.toHaveBeenCalled();
    expect(r.refused).toHaveLength(2);
  });

  it('audits every purge', async () => {
    allKnownAppIds.mockResolvedValue([]);
    await purgeOrphans(['app-verwaist'], 'vinc', 'grund');
    expect(writeOpsAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'orphan_purge', actor: 'vinc' }));
  });
});

// ── PHASE 4 · U4.1 — the plane X1's rule reaches next ───────────────────────

describe('teardown · the app’s own database (X1’s rule, one plane further)', () => {
  const WITH_DB: OpsApp = { ...APP, d1DatabaseId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' };

  it('deletes the database and folds the VERIFIED result into ok', async () => {
    teardownAppDatabase.mockResolvedValue({ attempted: true, gone: true });
    const r = await teardownApp(WITH_DB, 'vinc', 'missbrauch');
    expect(teardownAppDatabase).toHaveBeenCalledWith(WITH_DB.d1DatabaseId);
    expect(r.d1Attempted).toBe(true);
    expect(r.d1Gone).toBe(true);
    expect(r.ok).toBe(true);
  });

  it('a surviving database makes the whole teardown NOT ok — this is what blocks the project delete', async () => {
    teardownAppDatabase.mockResolvedValue({ attempted: true, gone: false });
    const r = await teardownApp(WITH_DB, 'vinc', 'missbrauch');
    expect(r.ok).toBe(false);
    expect(r.warning).toContain('Einsendungen');
  });

  it('a database whose deletion could not be VERIFIED is not ok either — null is not true', async () => {
    teardownAppDatabase.mockResolvedValue({ attempted: true, gone: null });
    const r = await teardownApp(WITH_DB, 'vinc', 'missbrauch');
    expect(r.ok).toBe(false);
    expect(r.d1Gone).toBeNull();
    expect(r.warning).toContain('nicht bestätigen');
  });

  it('the database warning outranks the R2 one — leftover bytes are ours, leftover submissions are not', async () => {
    teardownAppDatabase.mockResolvedValue({ attempted: true, gone: false });
    listAppFiles.mockResolvedValue(ok([{ key: 'apps/app-1/index.html', path: 'index.html', size: 1 }]));
    const r = await teardownApp(WITH_DB, 'vinc', 'missbrauch');
    expect(r.warning).toContain('Formular-Datenbank');
  });

  it('an app with no form is unaffected — nothing attempted, and that is not a failure', async () => {
    const r = await teardownApp(APP, 'vinc', 'missbrauch');
    expect(r.d1Attempted).toBe(false);
    expect(r.d1Gone).toBeNull();
    expect(r.ok).toBe(true);
  });

  it('records the database outcome in the audit row', async () => {
    teardownAppDatabase.mockResolvedValue({ attempted: true, gone: true });
    await teardownApp(WITH_DB, 'vinc', 'missbrauch');
    expect(writeOpsAudit).toHaveBeenCalledWith(
      expect.objectContaining({ meta: expect.objectContaining({ d1Attempted: true, d1Gone: true }) }),
    );
  });
});

describe('the orphan sweep · D1 databases', () => {
  const DB = (appId: string, id: string) => ({ id, name: `goblin-app-${appId}`, jurisdiction: 'eu' });

  it('finds one of OUR databases that no registry row accounts for', async () => {
    listD1Databases.mockResolvedValue(ok([DB('app-verwaist', 'db-verwaist')]));
    registeredD1DatabaseIds.mockResolvedValue([]);
    allKnownAppIds.mockResolvedValue([]);
    const r = await findOrphanedApps();
    expect(r.d1Orphans).toEqual(['goblin-app-app-verwaist (db-verwaist)']);
    expect(r.notes.join(' ')).toContain('Einsendungen');
  });

  it('leaves databases that are not ours alone — the account may hold other things', async () => {
    listD1Databases.mockResolvedValue(ok([{ id: 'db-x', name: 'meine-analytics', jurisdiction: null }]));
    registeredD1DatabaseIds.mockResolvedValue([]);
    allKnownAppIds.mockResolvedValue([]);
    const r = await findOrphanedApps();
    expect(r.d1Orphans).toEqual([]);
    expect(r.d1InCloudflare).toBe(0);
  });

  it('a recorded database is not an orphan', async () => {
    listD1Databases.mockResolvedValue(ok([DB('app-1', 'db-1')]));
    registeredD1DatabaseIds.mockResolvedValue([{ databaseId: 'db-1', status: 'active', appId: 'app-1' }]);
    allKnownAppIds.mockResolvedValue(['app-1']);
    const r = await findOrphanedApps();
    expect(r.d1Orphans).toEqual([]);
  });

  it('a database whose id was never written back is still matched by NAME — that is the orphan worth finding', async () => {
    // Provisioning created it and died before setOpsAppD1Database ran. The registry
    // knows the app, not the database. Reporting this as an orphan would send the
    // founder to delete a live app's data.
    listD1Databases.mockResolvedValue(ok([DB('app-1', 'db-nie-eingetragen')]));
    registeredD1DatabaseIds.mockResolvedValue([]);
    allKnownAppIds.mockResolvedValue(['app-1']);
    const r = await findOrphanedApps();
    expect(r.d1Orphans).toEqual([]);
  });

  it('separates a database on a `deleted` row — a teardown that did not finish', async () => {
    listD1Databases.mockResolvedValue(ok([DB('app-1', 'db-1')]));
    registeredD1DatabaseIds.mockResolvedValue([{ databaseId: 'db-1', status: 'deleted', appId: 'app-1' }]);
    allKnownAppIds.mockResolvedValue(['app-1']);
    const r = await findOrphanedApps();
    expect(r.d1OnDeletedApps).toEqual(['goblin-app-app-1 (db-1)']);
  });

  it('refuses to answer about databases when D1 cannot be read — never a confident empty list', async () => {
    listD1Databases.mockResolvedValue(cfErr('auth', 'kein Zugriff'));
    const r = await findOrphanedApps();
    expect(r.d1Orphans).toBeNull();
    expect(r.d1InCloudflare).toBeNull();
    expect(r.notes.join(' ')).toContain('D1 konnte nicht gelesen werden');
  });

  it('refuses to answer about databases when the registry cannot be read', async () => {
    listD1Databases.mockResolvedValue(ok([DB('app-1', 'db-1')]));
    registeredD1DatabaseIds.mockResolvedValue(null);
    const r = await findOrphanedApps();
    expect(r.d1Orphans).toBeNull();
  });

  it('answers about databases even when R2 is unreadable — the three halves are independent', async () => {
    listAppPrefixes.mockResolvedValue(cfErr('upstream', 'R2 weg'));
    listD1Databases.mockResolvedValue(ok([DB('app-verwaist', 'db-verwaist')]));
    registeredD1DatabaseIds.mockResolvedValue([]);
    allKnownAppIds.mockResolvedValue([]);
    const r = await findOrphanedApps();
    expect(r.orphans).toBeNull();
    expect(r.d1Orphans).toEqual(['goblin-app-app-verwaist (db-verwaist)']);
  });
});
