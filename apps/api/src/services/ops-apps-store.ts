/**
 * AKT 2 · PHASE 1 · U1.4 — pre-migration-tolerant access to `ops_apps`.
 *
 * Migration 0099 is AUTHORED, NOT APPLIED. Between this merge and the founder
 * running it, the table does not exist. Nothing here may throw because of that:
 * the reader FEATURE-DETECTS the table (same probe as the WAVE-B backend store)
 * and answers "not available" instead of failing, so a pre-0099 database behaves
 * exactly as it does today.
 *
 * Phase 1 deliberately performed NO WRITES. This file exists so the tolerance is a
 * tested property rather than a promise, and so Phase 2 inherits a reader that
 * already degrades correctly.
 *
 * ── PHASE 2 · U2.4 adds the publish writes ────────────────────────────────────
 * The READS still degrade to "not available" — a dashboard can honestly say "du
 * hast noch keine App" on a pre-0099 database. The WRITES do not, and must not:
 * they answer `null`, and every caller treats that as a refusal to publish.
 *
 * That asymmetry is the whole design. A publish that uploaded files and wrote a KV
 * route while the registry was unavailable would create exactly the orphan
 * ABUSE_RESPONSE §8.3 gap 3 is about — a reachable public URL with no row pointing
 * at it, which nobody can find, suspend or bill for. Refusing to start is the only
 * honest option.
 */

import { randomUUID } from 'node:crypto';
import { getSupabaseAdmin } from '../lib/supabase';
import logger from '../lib/logger';

type Sb = ReturnType<typeof getSupabaseAdmin>;

/** One registry row, as the API reads it. */
export interface OpsApp {
  appId: string;
  userId: string;
  projectId: string | null;
  appName: string;
  status: OpsAppStatus;
  capsProfile: string;
  r2Prefix: string;
  routeKey: string;
  workerScriptName: string | null;
  d1DatabaseId: string | null;
  lastPublishedAt: string | null;
  createdAt: string;
}

export type OpsAppStatus = 'provisioning' | 'active' | 'suspended' | 'failed' | 'deleted';

const COLUMNS =
  'app_id, user_id, project_id, app_name, status, caps_profile, r2_prefix, route_key, ' +
  'worker_script_name, d1_database_id, last_published_at, created_at';

/**
 * True if migration 0099 has been applied. Probed on every call, never cached: a
 * cached `false` would keep the feature dark for the life of the process after
 * the founder applies the migration, which is exactly the kind of stale-state lie
 * this codebase does not tell.
 */
export async function opsAppsTableAvailable(sb: Sb = getSupabaseAdmin()): Promise<boolean> {
  const { error } = await sb.from('ops_apps').select('app_id').limit(1);
  if (!error) return true;
  // 42P01 = undefined_table; PGRST205 = PostgREST schema-cache miss (table absent).
  const signature = `${error.code ?? ''} ${error.message ?? ''}`;
  if (/42P01|PGRST205|does not exist|schema cache/i.test(signature)) return false;
  // Any other error (RLS, permissions, transport) means the table DOES exist and
  // something else went wrong — do not mistake that for "not migrated yet".
  return true;
}

function toOpsApp(row: Record<string, unknown>): OpsApp {
  return {
    appId: String(row.app_id),
    userId: String(row.user_id),
    projectId: row.project_id ? String(row.project_id) : null,
    appName: String(row.app_name),
    status: String(row.status) as OpsAppStatus,
    capsProfile: String(row.caps_profile),
    r2Prefix: String(row.r2_prefix),
    routeKey: String(row.route_key),
    workerScriptName: row.worker_script_name ? String(row.worker_script_name) : null,
    d1DatabaseId: row.d1_database_id ? String(row.d1_database_id) : null,
    lastPublishedAt: row.last_published_at ? String(row.last_published_at) : null,
    createdAt: String(row.created_at),
  };
}

/**
 * A user's Living Apps. Returns [] — not an error — when the table is absent, so a
 * caller can render "du hast noch keine App" honestly on a pre-migration database
 * instead of showing a failure the user cannot act on.
 */
export async function listUserOpsApps(userId: string, sb: Sb = getSupabaseAdmin()): Promise<OpsApp[]> {
  if (!(await opsAppsTableAvailable(sb))) {
    logger.debug({ userId }, 'ops_apps_table_absent (pre-0099)');
    return [];
  }
  const { data, error } = await sb
    .from('ops_apps')
    .select(COLUMNS)
    .eq('user_id', userId)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false });
  if (error) {
    logger.warn({ userId, reason: error.message }, 'ops_apps_list_failed');
    return [];
  }
  return (data ?? []).map((row) => toOpsApp(row as unknown as Record<string, unknown>));
}

/**
 * Look up an app by its hostname label. `null` covers both "no such app" and
 * "table not migrated yet" on purpose: both mean the same thing to a caller —
 * there is no app behind this name — and neither is an error worth surfacing.
 */
export async function findOpsAppByName(appName: string, sb: Sb = getSupabaseAdmin()): Promise<OpsApp | null> {
  if (!(await opsAppsTableAvailable(sb))) return null;
  const { data, error } = await sb
    .from('ops_apps')
    .select(COLUMNS)
    .eq('app_name', appName.trim().toLowerCase())
    .limit(1);
  if (error) {
    logger.warn({ reason: error.message }, 'ops_apps_lookup_failed');
    return null;
  }
  const row = (data ?? [])[0];
  return row ? toOpsApp(row as unknown as Record<string, unknown>) : null;
}

/** One app by id. `null` covers "no such app" and "table not migrated" alike. */
export async function findOpsAppById(appId: string, sb: Sb = getSupabaseAdmin()): Promise<OpsApp | null> {
  if (!(await opsAppsTableAvailable(sb))) return null;
  const { data, error } = await sb.from('ops_apps').select(COLUMNS).eq('app_id', appId).limit(1);
  if (error) {
    logger.warn({ appId, reason: error.message }, 'ops_apps_lookup_by_id_failed');
    return null;
  }
  const row = (data ?? [])[0];
  return row ? toOpsApp(row as unknown as Record<string, unknown>) : null;
}

/**
 * The app already published from this project, if any — the basis of an idempotent
 * re-publish. A project has at most one Living App on the lean plane, so a second
 * publish updates the first rather than claiming a second name.
 */
export async function findOpsAppByProject(projectId: string, sb: Sb = getSupabaseAdmin()): Promise<OpsApp | null> {
  if (!(await opsAppsTableAvailable(sb))) return null;
  const { data, error } = await sb
    .from('ops_apps')
    .select(COLUMNS)
    .eq('project_id', projectId)
    .neq('status', 'deleted')
    .limit(1);
  if (error) {
    logger.warn({ projectId, reason: error.message }, 'ops_apps_lookup_by_project_failed');
    return null;
  }
  const row = (data ?? [])[0];
  return row ? toOpsApp(row as unknown as Record<string, unknown>) : null;
}

// ── Writes (Phase 2 · U2.4) ─────────────────────────────────────────────────

/**
 * Claim a name and create the registry row, BEFORE anything is uploaded.
 *
 * Order matters and is the reason this returns a row rather than a boolean. The
 * app exists in the registry first, in `provisioning`, so an interrupted publish
 * leaves a row someone can find and clean up — never an orphaned R2 prefix nobody
 * knows about (0099's header states this obligation; here it is honoured).
 *
 * The unique index on app_name is the real arbiter of a race: two people claiming
 * the same name at the same moment both pass the availability check, and exactly
 * one insert survives. `null` on conflict is that answer, not an error to retry.
 */
export async function claimOpsApp(
  input: { userId: string; projectId: string | null; appName: string; capsProfile?: string },
  sb: Sb = getSupabaseAdmin(),
): Promise<OpsApp | null> {
  if (!(await opsAppsTableAvailable(sb))) {
    logger.warn({ userId: input.userId }, 'ops_apps_claim_refused: table absent (pre-0099)');
    return null;
  }
  const appName = input.appName.trim().toLowerCase();
  const appId = randomUUID();
  const { data, error } = await sb
    .from('ops_apps')
    .insert({
      app_id: appId,
      user_id: input.userId,
      project_id: input.projectId,
      app_name: appName,
      status: 'provisioning',
      caps_profile: input.capsProfile ?? 'free-static',
      // Denormalised deliberately (see 0099): a future layout change must not
      // orphan the objects of apps written under the old one.
      r2_prefix: `apps/${appId}/`,
      route_key: `route:${appName}`,
    })
    .select(COLUMNS)
    .limit(1);

  if (error) {
    // 23505 = unique_violation: somebody claimed this name first. Not an error
    // worth alarming about — it is the answer to "is this name free".
    const conflict = error.code === '23505' || /duplicate key|unique/i.test(error.message ?? '');
    logger[conflict ? 'info' : 'warn']({ appName, reason: error.message }, 'ops_apps_claim_failed');
    return null;
  }
  const row = (data ?? [])[0];
  return row ? toOpsApp(row as unknown as Record<string, unknown>) : null;
}

/**
 * Mark an app live — and ONLY after the public URL has been verified.
 *
 * `last_published_at` is the column 0099 reserves for a VERIFIED publish, never for
 * an upload that merely did not throw. The caller passes the verification verdict
 * in, so this function cannot be used to claim a liveness nobody checked.
 */
export async function markOpsAppPublished(
  appId: string,
  facts: { fileCount: number; totalBytes: number; verified: true },
  sb: Sb = getSupabaseAdmin(),
): Promise<boolean> {
  if (!facts.verified) return false;
  if (!(await opsAppsTableAvailable(sb))) return false;
  const now = new Date().toISOString();
  const { error } = await sb
    .from('ops_apps')
    .update({
      status: 'active',
      file_count: facts.fileCount,
      total_bytes: facts.totalBytes,
      last_published_at: now,
      updated_at: now,
      // A republish of a previously suspended app must not silently unsuspend it,
      // so these are cleared only on the way OUT of suspension (U2.5), never here.
    })
    .eq('app_id', appId)
    .neq('status', 'suspended');
  if (error) {
    logger.warn({ appId, reason: error.message }, 'ops_apps_mark_published_failed');
    return false;
  }
  logger.info({ appId, files: facts.fileCount }, 'ops_apps_published');
  return true;
}

/**
 * Record an honest failure. The E-5 lesson, written into the schema by 0099: a
 * half-finished publish is recorded as `failed`, never silently left as `active`.
 */
export async function markOpsAppFailed(appId: string, sb: Sb = getSupabaseAdmin()): Promise<boolean> {
  if (!(await opsAppsTableAvailable(sb))) return false;
  const { error } = await sb
    .from('ops_apps')
    .update({ status: 'failed', updated_at: new Date().toISOString() })
    .eq('app_id', appId)
    .eq('status', 'provisioning'); // never demote an app that is already live
  if (error) {
    logger.warn({ appId, reason: error.message }, 'ops_apps_mark_failed_failed');
    return false;
  }
  return true;
}

// ── Operator writes (Phase 2 · U2.5 — ABUSE_RESPONSE §8.3 gap 2) ────────────
//
// Before this, suspending an app meant running
//   UPDATE public.ops_apps SET status='suspended' WHERE app_name='…';
// by hand in the Supabase SQL editor, with no audit row and no way to be sure the
// router had stopped serving. These are the write path that replaces that.

/** Suspend an app. Reversible by design — the opposite of deleting the content. */
export async function suspendOpsApp(
  appId: string,
  reason: string,
  sb: Sb = getSupabaseAdmin(),
): Promise<boolean> {
  if (!(await opsAppsTableAvailable(sb))) return false;
  const now = new Date().toISOString();
  const { error } = await sb
    .from('ops_apps')
    .update({ status: 'suspended', suspended_at: now, suspension_reason: reason, updated_at: now })
    .eq('app_id', appId)
    .neq('status', 'deleted'); // a torn-down app cannot be suspended
  if (error) {
    logger.warn({ appId, reason: error.message }, 'ops_apps_suspend_failed');
    return false;
  }
  logger.warn({ appId }, 'ops_apps_suspended');
  return true;
}

/**
 * Lift a suspension. `suspended_at` and `suspension_reason` are cleared HERE and
 * only here — a republish must never quietly unsuspend an app (see
 * markOpsAppPublished, which excludes suspended rows for exactly that reason).
 */
export async function unsuspendOpsApp(appId: string, sb: Sb = getSupabaseAdmin()): Promise<boolean> {
  if (!(await opsAppsTableAvailable(sb))) return false;
  const { error } = await sb
    .from('ops_apps')
    .update({ status: 'active', suspended_at: null, suspension_reason: null, updated_at: new Date().toISOString() })
    .eq('app_id', appId)
    .eq('status', 'suspended'); // only a suspension can be lifted
  if (error) {
    logger.warn({ appId, reason: error.message }, 'ops_apps_unsuspend_failed');
    return false;
  }
  logger.warn({ appId }, 'ops_apps_unsuspended');
  return true;
}

/**
 * Terminal state after a teardown. The row is KEPT, not deleted: the name must not
 * fall back into circulation, and the audit trail needs something to point at.
 */
export async function markOpsAppDeleted(appId: string, sb: Sb = getSupabaseAdmin()): Promise<boolean> {
  if (!(await opsAppsTableAvailable(sb))) return false;
  const { error } = await sb
    .from('ops_apps')
    .update({ status: 'deleted', updated_at: new Date().toISOString() })
    .eq('app_id', appId);
  if (error) {
    logger.warn({ appId, reason: error.message }, 'ops_apps_mark_deleted_failed');
    return false;
  }
  logger.warn({ appId }, 'ops_apps_deleted');
  return true;
}

/**
 * Every app id the registry knows about, in any state — the orphan sweep's
 * right-hand side. `deleted` rows are INCLUDED on purpose: their files should be
 * gone, and if they are not, that is precisely the orphan we are hunting.
 */
export async function allKnownAppIds(sb: Sb = getSupabaseAdmin()): Promise<string[] | null> {
  if (!(await opsAppsTableAvailable(sb))) return null;
  const { data, error } = await sb.from('ops_apps').select('app_id');
  if (error) {
    logger.warn({ reason: error.message }, 'ops_apps_list_ids_failed');
    // null, not [] — "I could not ask" must never look like "there are none",
    // which would mark every hosted app an orphan.
    return null;
  }
  return (data ?? []).map((r) => String((r as { app_id: unknown }).app_id));
}

/** Move an app to a new name. The old route's tombstone is the caller's job. */
export async function renameOpsApp(appId: string, newName: string, sb: Sb = getSupabaseAdmin()): Promise<boolean> {
  if (!(await opsAppsTableAvailable(sb))) return false;
  const appName = newName.trim().toLowerCase();
  const { error } = await sb
    .from('ops_apps')
    .update({ app_name: appName, route_key: `route:${appName}`, updated_at: new Date().toISOString() })
    .eq('app_id', appId);
  if (error) {
    logger.warn({ appId, reason: error.message }, 'ops_apps_rename_failed');
    return false;
  }
  logger.info({ appId, appName }, 'ops_apps_renamed');
  return true;
}
