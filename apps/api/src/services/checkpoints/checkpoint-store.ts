// WAVE-F (Versionierung & Zeit) F1/F2/F5 — the checkpoint engine: Goblin's internal
// "undo" safety net. Every meaningful change to a project's files becomes a content-
// snapshot checkpoint the user can travel back to.
//
// STORAGE MODEL — content-addressed, dedup'd by DESIGN (F1 gate):
//   A checkpoint does NOT copy file bytes. Each file's content is hashed (sha256) and the
//   bytes are stored ONCE per unique content as a blob at
//     checkpoints/<projectId>/blobs/<sha256>
//   The DB row (project_checkpoints, migration 0095) carries only the lightweight MANIFEST —
//   the { path → { hash, size } } map naming which blobs reconstitute the snapshot. So 10
//   checkpoints of a 20-file project that never changes cost ~20 blobs + 10 tiny manifests,
//   NOT 200 file copies. A restore is a byte-exact blob replay of the manifest.
//   Why hash-dedup over diffs: it is the SMALLER correct approach here — project files are
//   small text documents that mostly repeat across snapshots (a run touches 1–3 of 20 files),
//   so per-file content dedup captures ~all the savings a diff chain would, without the diff
//   chain's fragility (a corrupt base breaks every descendant) or its restore-time replay cost.
//
// BILLING — the checkpoint blobs are PLATFORM COGS (Goblin's internal safety net), written
// UNMETERED (no userId → no storage-cap charge). They are NOT billed to the user's storage
// allowance: an auto-snapshot the user never asked for must never eat their quota. See the
// ledger NOTE (M-storage, WAVE-F).
//
// PRE-MIGRATION TOLERANCE (LIVE USERS) — every entry point probes for the table first and
// no-ops when 0095 is not yet applied (snapshot returns null, restore returns 'unavailable',
// the list is empty). So a pre-0095 DB never crashes, never blocks a run, and the F3 UI
// honest-hides. Nothing here disrupts an active run/session.

import { createHash } from 'crypto';
import { getSupabaseAdmin } from '../../lib/supabase';
import logger from '../../lib/logger';
import { byteLen } from '../storage-usage';
import { agentMaxRuntimeMs } from '../agent/config';
import {
  listFiles,
  downloadFile,
  uploadFile,
  deleteFile,
  keyExists,
  putStringAtKey,
  getStringAtKey,
} from '../file-storage';

/** Provenance of a checkpoint — drives the F3 source icon AND the F5 retention policy. */
export type CheckpointSource = 'agent-run' | 'user' | 'publish';

/** One file's entry in a snapshot manifest. `hash` names its content blob. */
export interface ManifestFile {
  path: string;
  hash: string;
  size: number;
}

/** The snapshot index persisted on the checkpoint row (never carries file bodies). */
export interface CheckpointManifest {
  files: ManifestFile[];
  fileCount: number;
  byteTotal: number;
}

export interface SnapshotInput {
  projectId: string;
  userId: string;
  label: string;
  createdBy: CheckpointSource;
  /** Only 'agent-run' checkpoints set this (the F-40 run they were taken for). */
  runId?: string | null;
  /** Only 'publish' checkpoints set this (the VERIFIED-live URL, F4). */
  deployedUrl?: string | null;
}

/** A checkpoint as the F3 timeline / F4 publish-history reads it. */
export interface CheckpointSummary {
  id: string;
  label: string;
  createdBy: CheckpointSource;
  runId: string | null;
  deployedUrl: string | null;
  createdAt: string;
  fileCount: number;
  byteTotal: number;
  /** Files that differ from the chronologically-previous checkpoint (the "±n" the UI shows). */
  changedFromPrev: number;
}

// `.trash/` is the soft-delete prefix (B6). A checkpoint captures the project as the user
// and the agent see it — the live file set — so trashed files are excluded from both the
// snapshot and a restore (restore never resurrects trash). This keeps the ±n count and the
// mental model ("these are my files") honest.
const TRASH_PREFIX = '.trash/';

function isLiveFile(path: string): boolean {
  return !path.startsWith(TRASH_PREFIX);
}

function blobKey(projectId: string, hash: string): string {
  return `checkpoints/${projectId}/blobs/${hash}`;
}

/** The whole checkpoint namespace for a project (blobs) — purge/GC target. */
export function checkpointBlobPrefix(projectId: string): string {
  return `checkpoints/${projectId}/`;
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

// ── Table-availability probe (pre-migration tolerance) ───────────────────────
// Only the POSITIVE result is cached: a table does not disappear once it exists, but a
// table the founder has not yet created can appear later (they apply 0095 without a code
// deploy), so a `false` must always be re-probed. This is the safe caching direction.
let _tableAvailable = false;

async function checkpointsAvailable(): Promise<boolean> {
  if (_tableAvailable) return true;
  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb.from('project_checkpoints').select('id').limit(1);
    if (error) {
      // 42P01 = undefined_table (pre-0095). Any other error is transient — treat as
      // unavailable for THIS call but do not cache, so a blip never permanently disables.
      return false;
    }
    _tableAvailable = true;
    return true;
  } catch {
    return false;
  }
}

/** Test seam — reset the cached probe between unit tests. */
export function __resetCheckpointProbe(): void {
  _tableAvailable = false;
}

/** Public feature-detect for routes/UI: is the checkpoint table applied (0095)? */
export async function checkpointsFeatureAvailable(): Promise<boolean> {
  return checkpointsAvailable();
}

// ── F1: snapshot ─────────────────────────────────────────────────────────────

/**
 * Snapshot a project's live files into a checkpoint. Content-addressed + dedup'd: a file
 * whose content already has a blob is NOT re-uploaded. Returns the new checkpoint id, or
 * null when checkpoints are unavailable (pre-0095) or the write failed — the caller's flow
 * (the run, the publish) must NEVER break because a checkpoint could not be taken.
 */
export async function snapshotProject(input: SnapshotInput): Promise<string | null> {
  // Probe BEFORE writing any blob, so a pre-0095 DB never leaves orphan blobs behind.
  if (!(await checkpointsAvailable())) return null;

  try {
    const paths = (await listFiles(input.projectId)).filter(isLiveFile);
    const files: ManifestFile[] = [];
    let byteTotal = 0;

    for (const path of paths) {
      const content = await downloadFile(input.projectId, path);
      if (content == null) continue; // listed-but-gone race — skip, never fabricate
      const hash = sha256(content);
      const size = byteLen(content);
      byteTotal += size;
      // Dedup: the blob is content-addressed, so an identical content across snapshots
      // (or across files) resolves to the SAME key — write once, skip if present.
      if (!(await keyExists(blobKey(input.projectId, hash)))) {
        await putStringAtKey(blobKey(input.projectId, hash), content);
      }
      files.push({ path, hash, size });
    }

    const manifest: CheckpointManifest = { files, fileCount: files.length, byteTotal };

    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('project_checkpoints')
      .insert({
        project_id: input.projectId,
        user_id: input.userId,
        label: input.label,
        created_by: input.createdBy,
        run_id: input.runId ?? null,
        manifest,
        deployed_url: input.deployedUrl ?? null,
      })
      .select('id')
      .single();
    if (error || !data) {
      logger.warn({ err: error?.message, projectId: input.projectId }, 'checkpoint_snapshot_insert_failed');
      return null;
    }
    return data.id as string;
  } catch (e) {
    logger.warn({ err: (e as Error).message, projectId: input.projectId }, 'checkpoint_snapshot_failed');
    return null;
  }
}

// ── F3: list (timeline) ──────────────────────────────────────────────────────

/** Count files that differ between two manifests (added + removed + content-changed). */
export function diffManifestCount(older: CheckpointManifest | null, newer: CheckpointManifest): number {
  const oldMap = new Map((older?.files ?? []).map((f) => [f.path, f.hash]));
  const newMap = new Map(newer.files.map((f) => [f.path, f.hash]));
  let changed = 0;
  for (const [path, hash] of newMap) {
    if (oldMap.get(path) !== hash) changed += 1; // added or modified
  }
  for (const path of oldMap.keys()) {
    if (!newMap.has(path)) changed += 1; // removed
  }
  return changed;
}

/**
 * The F3 timeline: a project's checkpoints newest-first, each carrying its file count and
 * the "±n" delta vs the chronologically-previous checkpoint. Empty (never throws) when
 * checkpoints are unavailable — the UI honest-hides. Ownership-scoped by user_id.
 */
export async function listCheckpoints(projectId: string, userId: string): Promise<CheckpointSummary[]> {
  if (!(await checkpointsAvailable())) return [];
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('project_checkpoints')
      .select('id, label, created_by, run_id, deployed_url, manifest, created_at')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error || !data) return [];

    const rows = data as Array<{
      id: string; label: string; created_by: CheckpointSource; run_id: string | null;
      deployed_url: string | null; manifest: CheckpointManifest; created_at: string;
    }>;

    // rows are newest-first; the "previous" for a ±n delta is the NEXT row (older).
    return rows.map((r, i) => {
      const manifest = r.manifest ?? { files: [], fileCount: 0, byteTotal: 0 };
      const older = rows[i + 1]?.manifest ?? null;
      return {
        id: r.id,
        label: r.label,
        createdBy: r.created_by,
        runId: r.run_id,
        deployedUrl: r.deployed_url,
        createdAt: r.created_at,
        fileCount: manifest.fileCount ?? manifest.files?.length ?? 0,
        byteTotal: manifest.byteTotal ?? 0,
        changedFromPrev: diffManifestCount(older, manifest),
      };
    });
  } catch (e) {
    logger.warn({ err: (e as Error).message, projectId }, 'checkpoint_list_failed');
    return [];
  }
}

/** F4: the publish-history subset — only VERIFIED-publish checkpoints, newest first. */
export async function listPublishVersions(projectId: string, userId: string): Promise<CheckpointSummary[]> {
  const all = await listCheckpoints(projectId, userId);
  return all.filter((c) => c.createdBy === 'publish' && c.deployedUrl);
}

// ── F3: diff preview ─────────────────────────────────────────────────────────

export type FileChangeStatus = 'added' | 'removed' | 'modified' | 'unchanged';

export interface CheckpointFileChange {
  path: string;
  /** From the CHECKPOINT's perspective: what restoring it would do to the current file. */
  status: FileChangeStatus;
}

/**
 * Compare a checkpoint to the project's CURRENT live files (F3 "diff vs current"). Status is
 * framed as what a restore WOULD do: 'added' = the checkpoint has it and now it's gone
 * (restore re-creates), 'removed' = it exists now but not in the checkpoint (restore deletes
 * it), 'modified' = both but different content. Returns null when unavailable / not found.
 */
export async function diffCheckpointVsCurrent(
  projectId: string, userId: string, checkpointId: string,
): Promise<{ label: string; changes: CheckpointFileChange[] } | null> {
  if (!(await checkpointsAvailable())) return null;
  const row = await loadCheckpoint(projectId, userId, checkpointId);
  if (!row) return null;

  const manifest = row.manifest ?? { files: [], fileCount: 0, byteTotal: 0 };
  const snapMap = new Map(manifest.files.map((f) => [f.path, f.hash]));

  const currentPaths = (await listFiles(projectId)).filter(isLiveFile);
  const currentHashes = new Map<string, string>();
  for (const path of currentPaths) {
    const content = await downloadFile(projectId, path);
    if (content != null) currentHashes.set(path, sha256(content));
  }

  const changes: CheckpointFileChange[] = [];
  for (const [path, hash] of snapMap) {
    const cur = currentHashes.get(path);
    if (cur === undefined) changes.push({ path, status: 'added' });
    else if (cur !== hash) changes.push({ path, status: 'modified' });
    else changes.push({ path, status: 'unchanged' });
  }
  for (const path of currentHashes.keys()) {
    if (!snapMap.has(path)) changes.push({ path, status: 'removed' });
  }
  changes.sort((a, b) => a.path.localeCompare(b.path));
  return { label: row.label, changes };
}

/**
 * The content a single file HAD at a checkpoint (for the DiffSheet: base = this, proposed =
 * current). Null when the file wasn't in the snapshot (a restore would delete it) or the
 * checkpoint is unavailable/not found.
 */
export async function getCheckpointFileContent(
  projectId: string, userId: string, checkpointId: string, path: string,
): Promise<string | null> {
  if (!(await checkpointsAvailable())) return null;
  const row = await loadCheckpoint(projectId, userId, checkpointId);
  if (!row) return null;
  const entry = (row.manifest?.files ?? []).find((f) => f.path === path);
  if (!entry) return null;
  return getStringAtKey(blobKey(projectId, entry.hash));
}

// ── F2: restore ──────────────────────────────────────────────────────────────

export type RestoreResult =
  | { ok: true; restored: number; removed: number; label: string; newCheckpointId: string | null }
  | { ok: false; error: 'unavailable' | 'not_found' | 'run_active' | 'failed' };

/**
 * Restore a checkpoint: the project's live files are REPLACED by the snapshot (missing files
 * re-created, changed files reverted, files added since the snapshot deleted) — a byte-exact
 * blob replay. Never destructive: the restore ITSELF first snapshots the pre-restore state as
 * a "Wiederhergestellt: <label>" checkpoint, so forward history is preserved and a restore
 * can itself be undone.
 *
 * LIVE-USERS safety: refuses honestly ('run_active') while an agent run is in flight on the
 * project — restoring files under a running mutation would corrupt both.
 */
export async function restoreCheckpoint(
  projectId: string, userId: string, checkpointId: string,
): Promise<RestoreResult> {
  if (!(await checkpointsAvailable())) return { ok: false, error: 'unavailable' };

  const row = await loadCheckpoint(projectId, userId, checkpointId);
  if (!row) return { ok: false, error: 'not_found' };

  if (await hasActiveRunForProject(projectId, userId)) return { ok: false, error: 'run_active' };

  try {
    const manifest = row.manifest ?? { files: [], fileCount: 0, byteTotal: 0 };

    // Preserve forward history BEFORE mutating: snapshot the current state so the restore is
    // reversible. Labelled as a user checkpoint (the user initiated it). Best-effort — a
    // failed pre-snapshot must not block the restore the user asked for, but we log it.
    const newCheckpointId = await snapshotProject({
      projectId, userId, createdBy: 'user',
      label: `Wiederhergestellt: ${row.label}`,
    });

    const targetPaths = new Set(manifest.files.map((f) => f.path));

    // 1. Replay each snapshot file's blob back to its path (byte-exact).
    let restored = 0;
    for (const f of manifest.files) {
      const content = await getStringAtKey(blobKey(projectId, f.hash));
      if (content == null) {
        // A missing blob would mean silent data loss — refuse rather than write a hole.
        logger.error({ projectId, checkpointId, path: f.path, hash: f.hash }, 'checkpoint_restore_blob_missing');
        return { ok: false, error: 'failed' };
      }
      // enforce:false — a restore rewrites the user's OWN prior state (already accounted
      // once); it must update the storage counter but NEVER throw a cap error mid-replay
      // and leave the project half-restored. Same posture as net-zero moves.
      await uploadFile(projectId, f.path, content, { userId, enforce: false });
      restored += 1;
    }

    // 2. Delete live files that did NOT exist at the snapshot (created after it), so the
    //    result matches the snapshot exactly — a true replacement, not a merge.
    let removed = 0;
    const currentPaths = (await listFiles(projectId)).filter(isLiveFile);
    for (const path of currentPaths) {
      if (!targetPaths.has(path)) {
        await deleteFile(projectId, path, { userId });
        removed += 1;
      }
    }

    return { ok: true, restored, removed, label: row.label, newCheckpointId };
  } catch (e) {
    logger.error({ err: (e as Error).message, projectId, checkpointId }, 'checkpoint_restore_failed');
    return { ok: false, error: 'failed' };
  }
}

// ── Shared helpers ───────────────────────────────────────────────────────────

interface CheckpointRow {
  id: string;
  label: string;
  created_by: CheckpointSource;
  run_id: string | null;
  deployed_url: string | null;
  manifest: CheckpointManifest;
  created_at: string;
}

async function loadCheckpoint(
  projectId: string, userId: string, checkpointId: string,
): Promise<CheckpointRow | null> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('project_checkpoints')
      .select('id, label, created_by, run_id, deployed_url, manifest, created_at')
      .eq('id', checkpointId)
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return data as CheckpointRow;
  } catch {
    return null;
  }
}

/**
 * F2 safety: is a NON-stale agent run still in flight on this project? Mirrors the F-40
 * zombie window (a process that died mid-run leaves status='running' forever, so a run
 * older than 2× the max-runtime guard is NOT counted as active). Fails safe: on a query
 * error it returns false (a DB blip must not permanently block restore) — the restore's
 * own snapshot+replay is atomic enough that the only real hazard is a genuinely-live run.
 */
export async function hasActiveRunForProject(projectId: string, userId: string): Promise<boolean> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('agent_runs')
      .select('id, created_at')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('status', 'running')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return false;
    const createdAt = (data.created_at as string | null) ?? null;
    if (createdAt) {
      const age = Date.now() - new Date(createdAt).getTime();
      if (Number.isFinite(age) && age > agentMaxRuntimeMs() * 2) return false; // zombie
    }
    return true;
  } catch {
    return false;
  }
}
