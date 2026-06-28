import { getSupabaseAdmin } from '../lib/supabase';
import { walkPrefixObjects } from '../services/file-storage';
import { setUserStorageBytes } from '../services/storage-usage';
import logger from '../lib/logger';

/**
 * Nightly storage reconcile — the drift-correcting half of the hybrid cap.
 *
 * The incremental counter (users.storage_bytes) can drift from B2 reality: a process
 * crash between a write and its delta, a path that skipped accounting (tests/scripts),
 * or any future write that forgets the userId. This job recomputes the TRUE per-user
 * byte total straight from B2 and overwrites the counter, so the cap stays honest.
 *
 * Efficient: ONE list walk over `projects/` (mapping each object to its owner via the
 * project→user table) + ONE over `users/` (avatars), instead of a list call per
 * project. Users whose objects all vanished are corrected to 0.
 *
 * Doubles as the one-time BACKFILL after migration 0073: same recompute-and-set, so
 * running it once populates accurate counters immediately. Pass --backfill (CLI) or
 * { backfill: true } purely for the log label; the work is identical.
 */
export async function reconcileStorage(opts: { backfill?: boolean } = {}): Promise<{
  usersScanned: number;
  corrected: number;
}> {
  const sb = getSupabaseAdmin();
  const label = opts.backfill ? 'backfill' : 'reconcile';

  // pid → uid, so a `projects/{pid}/...` object can be attributed to its owner.
  const pidToUid = new Map<string, string>();
  {
    const { data, error } = await sb.from('projects').select('id, user_id');
    if (error) {
      logger.error({ error: error.message, label }, 'reconcile-storage: project map query failed');
      return { usersScanned: 0, corrected: 0 };
    }
    for (const p of data ?? []) pidToUid.set(p.id as string, p.user_id as string);
  }

  const totals = new Map<string, number>(); // uid → true byte total

  // Project files (includes each project's .trash/ — those bytes DO count until purged).
  await walkPrefixObjects('projects/', (key, size) => {
    const m = key.match(/^projects\/([^/]+)\//);
    const uid = m?.[1] ? pidToUid.get(m[1]) : undefined;
    if (uid) totals.set(uid, (totals.get(uid) ?? 0) + size);
  });

  // User-scoped objects (avatars live at users/{uid}/avatar.webp).
  await walkPrefixObjects('users/', (key, size) => {
    const m = key.match(/^users\/([^/]+)\//);
    const uid = m?.[1];
    if (uid) totals.set(uid, (totals.get(uid) ?? 0) + size);
  });

  // Also zero-out users whose stored counter is non-zero but who now have no objects
  // (everything deleted/purged since the last run) — union them into the apply set.
  const applyUids = new Set<string>(totals.keys());
  {
    const { data } = await sb.from('users').select('id').gt('storage_bytes', 0);
    for (const u of data ?? []) {
      const uid = u.id as string;
      if (!applyUids.has(uid)) {
        applyUids.add(uid);
        totals.set(uid, 0); // had a counter, has no objects now → correct to 0
      }
    }
  }

  let corrected = 0;
  for (const uid of applyUids) {
    const trueBytes = totals.get(uid) ?? 0;
    await setUserStorageBytes(uid, trueBytes);
    corrected++;
  }

  logger.info({ label, usersScanned: applyUids.size, corrected }, 'reconcile-storage: complete');
  return { usersScanned: applyUids.size, corrected };
}
