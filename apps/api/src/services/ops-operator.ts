/**
 * AKT 2 · PHASE 2 · U2.5 — the operator powers: suspend, unsuspend, tear down.
 *
 * This closes ABUSE_RESPONSE §8.3 gaps 2 and 3. Before it, suspending an app meant
 * hand-editing a row in the Supabase SQL editor with no audit and no certainty the
 * router had stopped, and a deleted project left its files serving forever with no
 * registry row pointing at them.
 *
 * ── Why KV is written FIRST ──────────────────────────────────────────────────
 * The router reads KV, not Postgres. Flipping KV is what actually stops the app,
 * so it happens before the database write. If the database write then fails, the
 * app is dark while the registry still says `active` — inconsistent, and reported
 * as such. That is the right trade: an S0 case (§8.2: "zuerst abschalten, dann
 * prüfen") is measured in seconds, and a registry that briefly disagrees is a
 * smaller harm than a phishing page that stays up because a database was slow.
 * Every step's outcome is in the result; nothing is summarised into a bare boolean.
 *
 * ── Why the kill switch is not enough, and does not apply here ────────────────
 * OPS_HOSTING_ENABLED turns off the API surface. It does NOT stop the router: the
 * router serves from KV and R2 and never asks the API anything. So these powers
 * must keep working with the flag off — otherwise turning Act 2 dark for the
 * cohort would also disarm the only per-app emergency stop. They are gated by the
 * ADMIN key instead of the beta allowlist, because suspension is an operator power
 * and not a beta feature.
 */

import {
  deleteAppFiles,
  deleteRoute,
  getRoute,
  listAppFiles,
  listAppPrefixes,
  setRoute,
} from './cf-deploy';
import {
  allKnownAppIds,
  findOpsAppById,
  findOpsAppByName,
  markOpsAppDeleted,
  suspendOpsApp,
  unsuspendOpsApp,
  type OpsApp,
} from './ops-apps-store';
import { writeOpsAudit, type OpsAuditOutcome } from './ops-audit';
import { dailyRequestBudget } from './ops-caps';
import logger from '../lib/logger';

/** One step of an operator action, reported rather than summarised away. */
export type StepOutcome = 'ok' | 'failed' | 'skipped';

export interface OperatorResult {
  ok: boolean;
  appId: string;
  appName: string;
  /** The KV flip — what actually changes what visitors see. */
  route: StepOutcome;
  /** The registry write. */
  registry: StepOutcome;
  /** Whether the evidence row landed. 'unavailable' = migration 0100 not applied. */
  audit: OpsAuditOutcome;
  /** Present when the steps disagree — an operator must see this, not discover it. */
  warning?: string;
  detail?: string;
}

/** Find an app by id or by its hostname label. Operators think in names. */
export async function findApp(idOrName: string): Promise<OpsApp | null> {
  const byId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrName)
    ? await findOpsAppById(idOrName)
    : null;
  return byId ?? (await findOpsAppByName(idOrName));
}

/**
 * SUSPEND — the per-app emergency stop (§8.2 S0/S1).
 *
 * Reversible: the files stay in R2 and the row stays in the registry. Nothing here
 * destroys evidence, which §8.7 requires be secured BEFORE any irreversible step.
 */
export async function suspendApp(app: OpsApp, actor: string, reason: string): Promise<OperatorResult> {
  // 1. KV first — this is the step that stops visitors seeing the app.
  // The budget is re-sent on every route write so a suspend/unsuspend round trip
  // cannot quietly strip an app's ceiling — the record is replaced wholesale.
  const route = await setRoute(app.appName, app.appId, {
    status: 'suspended',
    dailyBudget: dailyRequestBudget(app.capsProfile),
  });
  // 2. Registry.
  const registry = route.ok ? await suspendOpsApp(app.appId, reason) : false;

  const result: OperatorResult = {
    ok: route.ok && registry,
    appId: app.appId,
    appName: app.appName,
    route: route.ok ? 'ok' : 'failed',
    registry: route.ok ? (registry ? 'ok' : 'failed') : 'skipped',
    audit: 'unavailable',
  };

  if (!route.ok) {
    result.detail = route.error.message;
    result.warning = 'Die App wird WEITERHIN ausgeliefert — die Sperre am Router hat nicht funktioniert.';
  } else if (!registry) {
    result.warning = 'Die App ist gesperrt (Router), aber die Registry-Zeile konnte nicht aktualisiert werden — der Status dort stimmt nicht.';
  }

  result.audit = await writeOpsAudit({
    appId: app.appId,
    appName: app.appName,
    userId: app.userId,
    action: 'suspend',
    actor,
    reason,
    meta: { route: result.route, registry: result.registry },
  });

  return result;
}

/** UNSUSPEND — §8.5. If the suspension was wrong, this is how it is undone. */
export async function unsuspendApp(app: OpsApp, actor: string, reason: string): Promise<OperatorResult> {
  const route = await setRoute(app.appName, app.appId, {
    status: 'active',
    dailyBudget: dailyRequestBudget(app.capsProfile),
  });
  const registry = route.ok ? await unsuspendOpsApp(app.appId) : false;

  const result: OperatorResult = {
    ok: route.ok && registry,
    appId: app.appId,
    appName: app.appName,
    route: route.ok ? 'ok' : 'failed',
    registry: route.ok ? (registry ? 'ok' : 'failed') : 'skipped',
    audit: 'unavailable',
  };
  if (!route.ok) result.detail = route.error.message;
  else if (!registry) result.warning = 'Die App wird wieder ausgeliefert, aber die Registry-Zeile steht noch auf gesperrt.';

  result.audit = await writeOpsAudit({
    appId: app.appId,
    appName: app.appName,
    userId: app.userId,
    action: 'unsuspend',
    actor,
    reason,
    meta: { route: result.route, registry: result.registry },
  });
  return result;
}

export interface TeardownResult extends OperatorResult {
  /** Objects removed, and how many DeleteObjects requests it took (batching visible). */
  filesDeleted: number;
  batches: number;
  /** The proof: R2 prefix empty AND KV route gone. null = the check itself failed. */
  orphansRemaining: number | null;
  routeGone: boolean | null;
}

/**
 * TEARDOWN — irreversible, and ordered so it cannot half-finish into an orphan.
 *
 *   route first  → the app stops being reachable before its files start vanishing,
 *                  so nobody ever gets a half-deleted app serving broken pages
 *   files second → batched (the #18 anti-pattern is not repeated)
 *   registry     → terminal state, row KEPT so the name stays out of circulation
 *   VERIFY       → re-list the prefix and re-read the route. "I deleted it" is a
 *                  claim; "I looked and nothing is there" is evidence, and this is
 *                  the one place in the phase where the difference is the point.
 */
export async function teardownApp(app: OpsApp, actor: string, reason: string): Promise<TeardownResult> {
  const routeDelete = await deleteRoute(app.appName);
  const filesDelete = await deleteAppFiles(app.appId);
  const registry = await markOpsAppDeleted(app.appId);

  // The orphan check, after the fact, against the substrate itself.
  const remaining = await listAppFiles(app.appId);
  const routeAfter = await getRoute(app.appName);

  const orphansRemaining = remaining.ok ? remaining.value.length : null;
  const routeGone = routeAfter.ok ? routeAfter.value === null : null;

  const result: TeardownResult = {
    ok: routeDelete.ok && filesDelete.ok && registry && orphansRemaining === 0 && routeGone === true,
    appId: app.appId,
    appName: app.appName,
    route: routeDelete.ok ? 'ok' : 'failed',
    registry: registry ? 'ok' : 'failed',
    audit: 'unavailable',
    filesDeleted: filesDelete.ok ? filesDelete.value.deleted : 0,
    batches: filesDelete.ok ? filesDelete.value.batches : 0,
    orphansRemaining,
    routeGone,
  };

  if (!filesDelete.ok) result.detail = filesDelete.error.message;
  if (orphansRemaining === null || routeGone === null) {
    result.warning = 'Die Prüfung auf Reste konnte nicht abgeschlossen werden — bitte manuell nachsehen.';
  } else if (orphansRemaining > 0) {
    result.warning = `${orphansRemaining} Datei(en) sind noch in R2 — die App ist nicht vollständig entfernt.`;
  } else if (!routeGone) {
    result.warning = 'Die Route steht noch in KV — die Adresse könnte weiter auflösen.';
  }

  result.audit = await writeOpsAudit({
    appId: app.appId,
    appName: app.appName,
    userId: app.userId,
    action: 'teardown',
    actor,
    reason,
    meta: {
      filesDeleted: result.filesDeleted,
      batches: result.batches,
      orphansRemaining,
      routeGone,
      route: result.route,
      registry: result.registry,
    },
  });

  logger.warn({ appId: app.appId, deleted: result.filesDeleted, orphansRemaining }, 'ops_app_teardown');
  return result;
}

// ── The orphan sweep (§8.3 gap 3) ───────────────────────────────────────────

export interface OrphanReport {
  /** null = the check could not be completed. Never silently 0. */
  orphans: string[] | null;
  knownApps: number | null;
  prefixesInR2: number | null;
  notes: string[];
  timestamp: string;
}

/**
 * Which app prefixes exist in R2 with no registry row at all.
 *
 * This is the sweep §8.3 gap 3 asks for. Deleting a Goblin project cascades the
 * `ops_apps` row away (0099's own header warns about it) but does not touch the
 * hosted content, so a deleted project can leave a live public URL that nobody can
 * find, suspend or account for. The registry cannot detect that — by construction,
 * the evidence is gone from the registry. Only the bucket knows, so the bucket is
 * what gets asked.
 *
 * REPORT ONLY. It never deletes on its own: an automatic sweeper that is wrong once
 * destroys a paying builder's live app, and the OS escalation table puts user data
 * and irreversibility firmly in founder hands. Purging is a second, explicit call.
 */
export async function findOrphanedApps(): Promise<OrphanReport> {
  const notes: string[] = [];
  const prefixes = await listAppPrefixes();
  const known = await allKnownAppIds();

  if (!prefixes.ok) {
    notes.push(`R2 konnte nicht gelesen werden: ${prefixes.error.message}`);
    return { orphans: null, knownApps: known?.length ?? null, prefixesInR2: null, notes, timestamp: new Date().toISOString() };
  }
  if (known === null) {
    // Without the registry, EVERY prefix would look like an orphan. Refusing to
    // answer is the only safe response.
    notes.push('Die Registry konnte nicht gelesen werden — ohne sie sähe jede App wie ein Waisenkind aus.');
    return { orphans: null, knownApps: null, prefixesInR2: prefixes.value.length, notes, timestamp: new Date().toISOString() };
  }

  const knownSet = new Set(known);
  const orphans = prefixes.value.filter((id) => !knownSet.has(id));
  if (orphans.length > 0) {
    logger.warn({ count: orphans.length }, 'ops_orphaned_app_prefixes_found');
    notes.push(`${orphans.length} verwaiste App-Prefix(e) in R2 ohne Registry-Zeile.`);
  }

  return {
    orphans,
    knownApps: known.length,
    prefixesInR2: prefixes.value.length,
    notes,
    timestamp: new Date().toISOString(),
  };
}

export interface OrphanPurgeResult {
  purged: Array<{ appId: string; filesDeleted: number; batches: number; audit: OpsAuditOutcome }>;
  refused: Array<{ appId: string; why: string }>;
}

/**
 * Delete orphaned prefixes — explicitly, by id, never "all of them".
 *
 * Each id is RE-CHECKED against the registry immediately before deletion. A stale
 * list from a report taken minutes ago must not be able to delete an app that has
 * been published in the meantime.
 */
export async function purgeOrphans(appIds: string[], actor: string, reason: string): Promise<OrphanPurgeResult> {
  const purged: OrphanPurgeResult['purged'] = [];
  const refused: OrphanPurgeResult['refused'] = [];

  const known = await allKnownAppIds();
  if (known === null) {
    return { purged: [], refused: appIds.map((appId) => ({ appId, why: 'Registry nicht lesbar — nichts gelöscht.' })) };
  }
  const knownSet = new Set(known);

  for (const appId of appIds) {
    if (knownSet.has(appId)) {
      refused.push({ appId, why: 'Diese App hat eine Registry-Zeile — sie ist kein Waisenkind.' });
      continue;
    }
    const deleted = await deleteAppFiles(appId);
    if (!deleted.ok) {
      refused.push({ appId, why: deleted.error.message });
      continue;
    }
    const audit = await writeOpsAudit({
      appId,
      appName: '(orphan)',
      action: 'orphan_purge',
      actor,
      reason,
      meta: { filesDeleted: deleted.value.deleted, batches: deleted.value.batches },
    });
    purged.push({ appId, filesDeleted: deleted.value.deleted, batches: deleted.value.batches, audit });
  }

  return { purged, refused };
}
