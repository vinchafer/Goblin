/**
 * Per-user storage accounting — the DB side of the enforced storage cap.
 *
 * file-storage.ts owns the B2 object writes + the existing-size HEAD (it has the S3
 * client); this module owns everything that touches Postgres: resolving the user's
 * plan, reading the running counter, the cap check, and the atomic delta. Split this
 * way so file-storage.ts has no plan/billing knowledge and there is no import cycle
 * (the reconcile job imports both; neither imports the job).
 *
 * FAIL SAFE: if the plan or counter can't be read, we throw StorageUnavailableError
 * (→ 503) instead of letting an unverifiable write through. The nightly reconcile
 * (jobs/reconcile-storage.ts) corrects any counter drift from missed/raced deltas.
 */

import { getSupabaseAdmin } from '../lib/supabase';
import { derivePlanTruth, type PlanTruthRow } from '../lib/plan-truth';
import { storageLimitFor, StorageCapError, StorageUnavailableError } from '../lib/storage-cap';
import logger from '../lib/logger';

/** Byte length of content as it lands in B2 (UTF-8 for strings; raw for buffers). */
export function byteLen(content: string | Buffer): number {
  return typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : content.length;
}

const PLAN_COLS =
  'plan, is_comped, stripe_subscription_id, cloud_trial_ends_at, trial_consumed_at, cancel_at_period_end, subscription_current_period_end, payment_state, next_payment_attempt';

/**
 * Resolve the storage allowance key for a user via derivePlanTruth (comped→power,
 * none→none) — the SAME derivation the token cap uses. Throws StorageUnavailableError
 * if the row can't be read (fail safe).
 */
export async function resolveUserPlanKey(userId: string): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('users')
    .select(PLAN_COLS)
    .eq('id', userId)
    .single();
  if (error || !data) throw new StorageUnavailableError();
  return derivePlanTruth(data as PlanTruthRow).allowanceKey;
}

/** Read the running per-user storage total (bytes). Throws StorageUnavailableError on failure. */
export async function getUserStorageBytes(userId: string): Promise<number> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('users')
    .select('storage_bytes')
    .eq('id', userId)
    .single();
  if (error || !data) throw new StorageUnavailableError();
  const n = Number((data as { storage_bytes: number }).storage_bytes);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Enforce the cap for a positive growth `delta`. No-op for delta ≤ 0 — shrinking,
 * net-zero moves, and deletes are NEVER blocked (an over-cap user must always be able
 * to free space). Throws StorageCapError (→413) if the write would exceed the limit,
 * or StorageUnavailableError (→503) if the cap can't be verified.
 */
export async function assertStorageRoom(userId: string, delta: number): Promise<void> {
  if (!(delta > 0)) return;
  const [planKey, used] = await Promise.all([
    resolveUserPlanKey(userId),
    getUserStorageBytes(userId),
  ]);
  const limit = storageLimitFor(planKey);
  if (used + delta > limit) throw new StorageCapError(limit, used);
}

/**
 * Apply a (possibly negative) byte delta to the user's counter, atomically + clamped
 * at 0 via the RPC. Best-effort: the B2 write has already happened, so a counter
 * failure must NOT fail the request — it's logged and corrected by the nightly
 * reconcile. Never throws.
 */
export async function applyStorageDelta(userId: string, delta: number): Promise<void> {
  if (!delta) return;
  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb.rpc('increment_user_storage_bytes', {
      p_user_id: userId,
      p_delta: Math.trunc(delta),
    });
    if (error) {
      logger.warn({ userId, delta, err: error.message }, 'storage_counter_delta_failed');
    }
  } catch (e) {
    logger.warn({ userId, delta, err: e instanceof Error ? e.message : String(e) }, 'storage_counter_delta_threw');
  }
}

/** Overwrite a user's counter with an absolute byte total (reconcile job). Never throws fatally. */
export async function setUserStorageBytes(userId: string, bytes: number): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.rpc('set_user_storage_bytes', {
    p_user_id: userId,
    p_bytes: Math.max(0, Math.trunc(bytes)),
  });
  if (error) logger.warn({ userId, bytes, err: error.message }, 'storage_counter_set_failed');
}
