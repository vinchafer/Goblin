/**
 * AKT 2 · PHASE 1 · U1.4 — pre-migration-tolerant access to `ops_apps`.
 *
 * Migration 0099 is AUTHORED, NOT APPLIED. Between this merge and the founder
 * running it, the table does not exist. Nothing here may throw because of that:
 * the reader FEATURE-DETECTS the table (same probe as the WAVE-B backend store)
 * and answers "not available" instead of failing, so a pre-0099 database behaves
 * exactly as it does today.
 *
 * Phase 1 deliberately performs NO WRITES. This file exists so the tolerance is a
 * tested property rather than a promise, and so Phase 2 inherits a reader that
 * already degrades correctly. The write path arrives with the publish flow.
 */

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
