// WAVE-F (Versionierung & Zeit) F5 — retention & cost honesty for checkpoints.
//
// Policy (spec F5):
//   • KEEP all user + publish checkpoints forever — those are deliberate, named states the
//     user (or a verified publish) chose; they are the whole point of the safety net.
//   • Auto-prune only 'agent-run' auto-checkpoints older than N days (env
//     CHECKPOINT_RETENTION_DAYS, default 30) — the noisy, automatic "Vor: …" snapshots —
//     EXCEPT the pre-run checkpoint of the last M runs (env CHECKPOINT_KEEP_LAST_RUNS,
//     default 20), so "undo my last few runs" always works regardless of the age clock.
//   • After a prune, GARBAGE-COLLECT orphan blobs: a content blob referenced by NO remaining
//     checkpoint of the project is deleted, so pruning actually frees storage (the dedup
//     model means a blob may be shared, so we can only delete truly-unreferenced ones).
//   • Account/project deletion PURGES every checkpoint row + blob for the project (the
//     FW6-U3 blocking-teardown path), so a deleted user's snapshots never outlive them.
//
// This is STORAGE cost only — no model tokens (ledger NOTE, WAVE-F). The blobs are platform
// COGS; pruning is what bounds that COGS over time.

import { getSupabaseAdmin } from '../../lib/supabase';
import logger from '../../lib/logger';
import { walkPrefixObjects, deleteKeys } from '../file-storage';
import { checkpointBlobPrefix, type CheckpointManifest } from './checkpoint-store';

/** Retention window for agent-auto checkpoints (days). Env CHECKPOINT_RETENTION_DAYS, default 30. */
export function checkpointRetentionDays(): number {
  const raw = Number(process.env.CHECKPOINT_RETENTION_DAYS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 30;
}

/** How many recent runs' pre-run checkpoints are kept regardless of age. Env, default 20. */
export function checkpointKeepLastRuns(): number {
  const raw = Number(process.env.CHECKPOINT_KEEP_LAST_RUNS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 20;
}

export interface PruneResult {
  scannedProjects: number;
  deletedCheckpoints: number;
  deletedBlobs: number;
}

/**
 * Prune stale agent-auto checkpoints across all projects, then GC orphan blobs. Deterministic
 * and idempotent: a second run with nothing stale is a no-op. Never throws — a per-project
 * failure is logged and the sweep continues.
 *
 * `now`/env are injectable for the unit test (no wall-clock / env coupling).
 */
export async function pruneAgentAutoCheckpoints(opts?: {
  olderThanDays?: number;
  keepLastRuns?: number;
  now?: number;
}): Promise<PruneResult> {
  const days = opts?.olderThanDays ?? checkpointRetentionDays();
  const keepRuns = opts?.keepLastRuns ?? checkpointKeepLastRuns();
  const now = opts?.now ?? Date.now();
  const cutoff = new Date(now - days * 24 * 3600_000).toISOString();

  const result: PruneResult = { scannedProjects: 0, deletedCheckpoints: 0, deletedBlobs: 0 };
  const sb = getSupabaseAdmin();

  // The set of run-ids whose pre-run checkpoint is protected by the "last M runs" rule.
  // The newest `keepRuns` agent-run checkpoints (by created_at) keep their run_id.
  let protectedRunIds = new Set<string>();
  try {
    const { data: recent } = await sb
      .from('project_checkpoints')
      .select('run_id')
      .eq('created_by', 'agent-run')
      .not('run_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(keepRuns);
    protectedRunIds = new Set(((recent ?? []) as Array<{ run_id: string }>).map((r) => r.run_id));
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'checkpoint_prune_protected_lookup_failed');
    // Fail safe: if we can't determine the protected set, keep everything (delete nothing).
    return result;
  }

  // Candidate stale checkpoints: agent-run, older than the cutoff. We fetch id + project_id
  // + run_id so we can honor the protected-run exclusion and GC the right project prefixes.
  let stale: Array<{ id: string; project_id: string; run_id: string | null }> = [];
  try {
    const { data } = await sb
      .from('project_checkpoints')
      .select('id, project_id, run_id')
      .eq('created_by', 'agent-run')
      .lt('created_at', cutoff);
    stale = (data ?? []) as Array<{ id: string; project_id: string; run_id: string | null }>;
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'checkpoint_prune_scan_failed');
    return result;
  }

  const toDelete = stale.filter((c) => !(c.run_id && protectedRunIds.has(c.run_id)));
  if (toDelete.length === 0) return result;

  // Delete the rows (blobs GC'd per affected project afterward).
  const ids = toDelete.map((c) => c.id);
  try {
    const { error } = await sb.from('project_checkpoints').delete().in('id', ids);
    if (error) {
      logger.warn({ err: error.message }, 'checkpoint_prune_delete_failed');
      return result;
    }
    result.deletedCheckpoints = ids.length;
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'checkpoint_prune_delete_failed');
    return result;
  }

  // GC orphan blobs for each affected project.
  const affectedProjects = [...new Set(toDelete.map((c) => c.project_id))];
  result.scannedProjects = affectedProjects.length;
  for (const projectId of affectedProjects) {
    try {
      result.deletedBlobs += await gcOrphanBlobs(projectId);
    } catch (e) {
      logger.warn({ err: (e as Error).message, projectId }, 'checkpoint_gc_failed');
    }
  }
  return result;
}

/**
 * Delete content blobs for a project that no REMAINING checkpoint references. Safe with the
 * dedup model: a blob is removed only when it appears in zero surviving manifests, so a blob
 * still shared by a kept checkpoint is never dropped. Returns the count of blobs deleted.
 */
export async function gcOrphanBlobs(projectId: string): Promise<number> {
  const sb = getSupabaseAdmin();
  // The set of hashes still referenced by ANY checkpoint of this project.
  const { data, error } = await sb
    .from('project_checkpoints')
    .select('manifest')
    .eq('project_id', projectId);
  if (error) throw new Error(error.message);
  const live = new Set<string>();
  for (const row of (data ?? []) as Array<{ manifest: CheckpointManifest }>) {
    for (const f of row.manifest?.files ?? []) live.add(f.hash);
  }

  // Enumerate every blob object under the project's checkpoint blob prefix; an object whose
  // hash (the key's basename) is not in `live` is an orphan → delete.
  const blobPrefix = `${checkpointBlobPrefix(projectId)}blobs/`;
  const orphanKeys: string[] = [];
  await walkPrefixObjects(blobPrefix, (key) => {
    const hash = key.slice(blobPrefix.length);
    if (hash && !live.has(hash)) orphanKeys.push(key);
  });
  await deleteKeys(orphanKeys);
  return orphanKeys.length;
}

export interface CheckpointPurgeResult {
  requested: number;
  purgedProjects: string[];
  deletedBlobs: number;
}

/**
 * Account/project deletion: purge EVERY checkpoint row + blob for the given projects. Called
 * from the account-deletion service (FW6-U3 blocking teardown) BEFORE the auth cascade drops
 * the project rows — the DB rows would cascade on the FK, but the B2 blobs would otherwise be
 * orphaned forever (exactly the gap purgeProjectStorage closes for project files). Idempotent
 * and resumable: an already-empty prefix is a no-op success.
 */
export async function purgeProjectCheckpoints(projectIds: string[]): Promise<CheckpointPurgeResult> {
  const result: CheckpointPurgeResult = { requested: projectIds.length, purgedProjects: [], deletedBlobs: 0 };
  const sb = getSupabaseAdmin();

  for (const projectId of projectIds) {
    try {
      // 1. Delete the DB rows (explicit — do not rely solely on the FK cascade, so a purge
      //    called outside the auth cascade path still clears them).
      await sb.from('project_checkpoints').delete().eq('project_id', projectId);

      // 2. Delete every blob under the project's checkpoint prefix.
      const keys: string[] = [];
      await walkPrefixObjects(checkpointBlobPrefix(projectId), (key) => keys.push(key));
      await deleteKeys(keys);
      result.deletedBlobs += keys.length;
      result.purgedProjects.push(projectId);
    } catch (e) {
      logger.warn({ err: (e as Error).message, projectId }, 'checkpoint_purge_failed');
    }
  }
  return result;
}
