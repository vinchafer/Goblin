/**
 * AKT 2 · PHASE 5 · U5.2 — pre-migration-tolerant access to `ops_app_checks`.
 *
 * Migration 0103 is AUTHORED, NOT APPLIED. Between this merge and the founder
 * running it, the table does not exist. Nothing here may throw because of that:
 * the reader FEATURE-DETECTS the table (the same probe as the 0099 reader, the
 * 0100 audit writer and the 0102 queue) and answers "not available" instead of
 * failing.
 *
 * ── The asymmetry, and why it is the opposite way round from ops-apps-store ─────
 * There, an unavailable registry makes a READ answer `[]` (a dashboard can honestly
 * say "du hast noch keine App") and a WRITE refuse (a publish that uploaded files
 * without a registry row would create an orphan).
 *
 * Here BOTH degrade, and neither degrades to a comforting answer:
 *
 *   • A read answers `{ available: false }`. The surfaces render UNKNOWN — never
 *     "no checks yet" and emphatically never a green. "We could not look" and
 *     "we looked and it is fine" are the two things this phase exists to keep
 *     apart, and collapsing them at the storage layer would defeat every careful
 *     thing above it.
 *   • A write answers `false`, and the RUNNER STOPS when it does. A heartbeat that
 *     makes real HTTP requests to real apps and records none of them is spending
 *     the fleet's request budget to produce nothing — see `recordChecks()`.
 */

import { getSupabaseAdmin } from '../lib/supabase';
import logger from '../lib/logger';
import type { CheckOutcome, CheckRow } from './ops-check-state';

type Sb = ReturnType<typeof getSupabaseAdmin>;

/** The subjects the heartbeat measures. Apps carry an appId; the platform does not. */
export type CheckSubjectKey = 'entry' | 'form_store' | 'web' | 'api' | 'cert' | 'domain';

/** Every subject that belongs to the platform rather than to one app (U5.5). */
export const PLATFORM_SUBJECTS: readonly CheckSubjectKey[] = ['web', 'api', 'cert', 'domain'] as const;

/** Every subject that belongs to a single app. */
export const APP_SUBJECTS: readonly CheckSubjectKey[] = ['entry', 'form_store'] as const;

/** One measurement on its way into the table. */
export interface CheckMeasurement {
  /** null = a platform subject. */
  appId: string | null;
  subjectKey: CheckSubjectKey;
  outcome: CheckOutcome;
  httpStatus?: number | null;
  latencyMs?: number | null;
  daysRemaining?: number | null;
  /** Bounded, machine-ish. NEVER page content, a submission, or an upstream body. */
  detail?: string | null;
  measuredAt: string;
}

/** `detail` is truncated here so no caller can be the one that forgets. */
const DETAIL_MAX = 200;

/** P5-e: eight days, so a seven-day question always has seven full days to answer from. */
export const CHECK_RETENTION_DAYS = 8;

const COLUMNS = 'app_id, subject_key, outcome, http_status, latency_ms, days_remaining, detail, measured_at';

/**
 * True if migration 0103 has been applied. Probed on every call, never cached: a
 * cached `false` would keep the heartbeat dark for the life of the process after
 * the founder applies the migration.
 */
export async function opsChecksTableAvailable(sb: Sb = getSupabaseAdmin()): Promise<boolean> {
  const { error } = await sb.from('ops_app_checks').select('id').limit(1);
  if (!error) return true;
  // 42P01 = undefined_table; PGRST205 = PostgREST schema-cache miss (table absent).
  const signature = `${error.code ?? ''} ${error.message ?? ''}`;
  if (/42P01|PGRST205|does not exist|schema cache/i.test(signature)) return false;
  // Any other error (RLS, permissions, transport) means the table DOES exist and
  // something else went wrong — do not mistake that for "not migrated yet".
  return true;
}

function toRow(row: Record<string, unknown>): CheckRow & { appId: string | null; subjectKey: string } {
  return {
    appId: row.app_id ? String(row.app_id) : null,
    subjectKey: String(row.subject_key),
    outcome: String(row.outcome) as CheckOutcome,
    measuredAt: String(row.measured_at),
    httpStatus: row.http_status === null || row.http_status === undefined ? null : Number(row.http_status),
    latencyMs: row.latency_ms === null || row.latency_ms === undefined ? null : Number(row.latency_ms),
    daysRemaining: row.days_remaining === null || row.days_remaining === undefined ? null : Number(row.days_remaining),
    detail: row.detail === null || row.detail === undefined ? null : String(row.detail),
  };
}

export type StoredCheckRow = ReturnType<typeof toRow>;

/**
 * Write a batch of measurements.
 *
 * `false` means NOTHING was written — the caller must treat it as a reason to stop
 * rather than a warning to log. One insert for the whole tick rather than one per
 * check: a partial batch would leave a subject with a newest row from a tick whose
 * other subjects are missing, and the derivation would read that as a gap it is
 * not.
 */
export async function recordChecks(
  measurements: CheckMeasurement[],
  sb: Sb = getSupabaseAdmin(),
): Promise<boolean> {
  if (measurements.length === 0) return true;
  if (!(await opsChecksTableAvailable(sb))) {
    logger.debug({ count: measurements.length }, 'ops_app_checks_absent (pre-0103) — nothing recorded');
    return false;
  }
  const { error } = await sb.from('ops_app_checks').insert(
    measurements.map((m) => ({
      app_id: m.appId,
      subject_key: m.subjectKey,
      outcome: m.outcome,
      http_status: m.httpStatus ?? null,
      latency_ms: m.latencyMs ?? null,
      days_remaining: m.daysRemaining ?? null,
      detail: m.detail ? m.detail.slice(0, DETAIL_MAX) : null,
      measured_at: m.measuredAt,
    })),
  );
  if (error) {
    logger.warn({ reason: error.message, count: measurements.length }, 'ops_app_checks_insert_failed');
    return false;
  }
  return true;
}

/**
 * The newest rows for one app, across every subject it has.
 *
 * `available: false` is NOT an empty list, and the two are kept in separate fields
 * so no caller can accidentally treat them alike. An empty list with
 * `available: true` means "the table is there and this app has never been checked"
 * — which derives to UNKNOWN/`never_checked`, the honest answer. `available: false`
 * means we could not ask, which derives to UNKNOWN as well but for a reason the
 * operator can act on (apply 0103).
 */
export async function recentChecksForApp(
  appId: string,
  opts: { limit?: number } = {},
  sb: Sb = getSupabaseAdmin(),
): Promise<{ available: boolean; rows: StoredCheckRow[] }> {
  if (!(await opsChecksTableAvailable(sb))) return { available: false, rows: [] };
  const { data, error } = await sb
    .from('ops_app_checks')
    .select(COLUMNS)
    .eq('app_id', appId)
    .order('measured_at', { ascending: false })
    .limit(opts.limit ?? 200);
  if (error) {
    logger.warn({ appId, reason: error.message }, 'ops_app_checks_read_failed');
    // The table exists but the read failed. Not "no checks" — unknown.
    return { available: false, rows: [] };
  }
  return { available: true, rows: (data ?? []).map((r) => toRow(r as unknown as Record<string, unknown>)) };
}

/**
 * Every `entry` row for one app inside a window — the uptime denominator.
 *
 * Bounded by `limit` as well as by time, because a misconfigured cadence must not
 * be able to turn a status card into an unbounded query. At the designed cadence a
 * seven-day window holds ~2.016 rows; the ceiling is well above that and the
 * summary reports the sample count either way, so a truncated read shows up as a
 * smaller `measured` rather than as a wrong percentage.
 */
export async function entryChecksInWindow(
  appId: string,
  windowMs: number,
  opts: { now?: number; limit?: number } = {},
  sb: Sb = getSupabaseAdmin(),
): Promise<{ available: boolean; rows: StoredCheckRow[] }> {
  if (!(await opsChecksTableAvailable(sb))) return { available: false, rows: [] };
  const since = new Date((opts.now ?? Date.now()) - windowMs).toISOString();
  const { data, error } = await sb
    .from('ops_app_checks')
    .select(COLUMNS)
    .eq('app_id', appId)
    .eq('subject_key', 'entry')
    .gte('measured_at', since)
    .order('measured_at', { ascending: false })
    .limit(opts.limit ?? 5_000);
  if (error) {
    logger.warn({ appId, reason: error.message }, 'ops_app_checks_window_read_failed');
    return { available: false, rows: [] };
  }
  return { available: true, rows: (data ?? []).map((r) => toRow(r as unknown as Record<string, unknown>)) };
}

/**
 * The newest rows for the platform subjects (U5.5) — Goblin's own surfaces, read
 * through the same instrument and the same derivation as anybody's app.
 */
export async function recentPlatformChecks(
  opts: { limit?: number } = {},
  sb: Sb = getSupabaseAdmin(),
): Promise<{ available: boolean; rows: StoredCheckRow[] }> {
  if (!(await opsChecksTableAvailable(sb))) return { available: false, rows: [] };
  const { data, error } = await sb
    .from('ops_app_checks')
    .select(COLUMNS)
    .is('app_id', null)
    .order('measured_at', { ascending: false })
    .limit(opts.limit ?? 200);
  if (error) {
    logger.warn({ reason: error.message }, 'ops_app_checks_platform_read_failed');
    return { available: false, rows: [] };
  }
  return { available: true, rows: (data ?? []).map((r) => toRow(r as unknown as Record<string, unknown>)) };
}

/**
 * The newest rows across EVERY app — the operator view's one query (U5.4).
 *
 * One read rather than one per app: the console lists the whole fleet, and N round
 * trips from a phone on mobile data is the difference between a card that loads and
 * one that does not. Bounded, and the bound is stated to the caller rather than
 * silently truncating into a shorter fleet — a console that quietly dropped the
 * apps past the limit would be a console that says "everything is fine" about apps
 * it never looked at.
 */
export async function newestChecksForAllApps(
  opts: { limit?: number } = {},
  sb: Sb = getSupabaseAdmin(),
): Promise<{ available: boolean; rows: StoredCheckRow[]; truncated: boolean }> {
  if (!(await opsChecksTableAvailable(sb))) return { available: false, rows: [], truncated: false };
  const limit = opts.limit ?? 4_000;
  const { data, error } = await sb
    .from('ops_app_checks')
    .select(COLUMNS)
    .not('app_id', 'is', null)
    .order('measured_at', { ascending: false })
    .limit(limit);
  if (error) {
    logger.warn({ reason: error.message }, 'ops_app_checks_fleet_read_failed');
    return { available: false, rows: [], truncated: false };
  }
  const rows = (data ?? []).map((r) => toRow(r as unknown as Record<string, unknown>));
  return { available: true, rows, truncated: rows.length >= limit };
}

/**
 * The last time ANY row was written for each subject — what the runner uses to
 * decide what is due (rather than an in-memory tick counter, which a restart would
 * reset and which a second instance would keep separately).
 *
 * Reads the newest N rows and reduces client-side. Postgres could do this with
 * DISTINCT ON, PostgREST cannot express it, and an RPC would be a second migration
 * for a query that runs once a minute over a bounded, indexed slice.
 */
export async function lastMeasuredAtBySubject(
  opts: { limit?: number } = {},
  sb: Sb = getSupabaseAdmin(),
): Promise<{ available: boolean; last: Map<string, string> }> {
  if (!(await opsChecksTableAvailable(sb))) return { available: false, last: new Map() };
  const { data, error } = await sb
    .from('ops_app_checks')
    .select('app_id, subject_key, measured_at')
    .order('measured_at', { ascending: false })
    .limit(opts.limit ?? 2_000);
  if (error) {
    logger.warn({ reason: error.message }, 'ops_app_checks_due_read_failed');
    return { available: false, last: new Map() };
  }
  const last = new Map<string, string>();
  for (const raw of data ?? []) {
    const row = raw as unknown as Record<string, unknown>;
    const key = subjectCacheKey(row.app_id ? String(row.app_id) : null, String(row.subject_key));
    // Newest-first, so the first time a key appears is its newest row.
    if (!last.has(key)) last.set(key, String(row.measured_at));
  }
  return { available: true, last };
}

/** The key `lastMeasuredAtBySubject` returns, so callers cannot build it differently. */
export function subjectCacheKey(appId: string | null, subjectKey: string): string {
  return `${appId ?? 'platform'}:${subjectKey}`;
}

/**
 * Delete rows older than the retention window (P5-e).
 *
 * Called from the tick rather than from a separate job on purpose: a cleanup with
 * its own trigger is a cleanup that eventually stops running, and the table it
 * would stop pruning is the highest-volume one Act 2 writes.
 *
 * Returns `null` when it could not run — not 0, which would read as "nothing to
 * prune" and hide an unbounded table behind a reassuring number.
 */
export async function pruneOldChecks(
  opts: { now?: number; retentionDays?: number } = {},
  sb: Sb = getSupabaseAdmin(),
): Promise<{ ok: boolean; cutoff: string } | null> {
  if (!(await opsChecksTableAvailable(sb))) return null;
  const days = opts.retentionDays ?? CHECK_RETENTION_DAYS;
  const cutoff = new Date((opts.now ?? Date.now()) - days * 24 * 60 * 60_000).toISOString();
  const { error } = await sb.from('ops_app_checks').delete().lt('measured_at', cutoff);
  if (error) {
    logger.warn({ reason: error.message }, 'ops_app_checks_prune_failed');
    return null;
  }
  return { ok: true, cutoff };
}
