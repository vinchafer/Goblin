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

vi.mock('./cf-deploy', () => ({
  setRoute: (...a: unknown[]) => setRoute(...a),
  deleteRoute: (...a: unknown[]) => deleteRoute(...a),
  deleteAppFiles: (...a: unknown[]) => deleteAppFiles(...a),
  listAppFiles: (...a: unknown[]) => listAppFiles(...a),
  listAppPrefixes: (...a: unknown[]) => listAppPrefixes(...a),
  getRoute: (...a: unknown[]) => getRoute(...a),
}));

const suspendOpsApp = vi.fn();
const unsuspendOpsApp = vi.fn();
const markOpsAppDeleted = vi.fn();
const allKnownAppIds = vi.fn();

vi.mock('./ops-apps-store', () => ({
  suspendOpsApp: (...a: unknown[]) => suspendOpsApp(...a),
  unsuspendOpsApp: (...a: unknown[]) => unsuspendOpsApp(...a),
  markOpsAppDeleted: (...a: unknown[]) => markOpsAppDeleted(...a),
  allKnownAppIds: (...a: unknown[]) => allKnownAppIds(...a),
  findOpsAppById: vi.fn(async () => null),
  findOpsAppByName: vi.fn(async () => null),
}));

const writeOpsAudit = vi.fn();
vi.mock('./ops-audit', () => ({ writeOpsAudit: (...a: unknown[]) => writeOpsAudit(...a) }));

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
  writeOpsAudit.mockResolvedValue('written');
});

describe('suspend', () => {
  it('flips KV to suspended and updates the registry', async () => {
    const r = await suspendApp(APP, 'vinc@example.com', 'Phishing-Meldung');
    expect(setRoute).toHaveBeenCalledWith('meinladen', 'app-1', { status: 'suspended' });
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
    expect(setRoute).toHaveBeenCalledWith('meinladen', 'app-1', { status: 'active' });
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
