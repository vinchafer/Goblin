// WAVE-F F5 gate — retention & purge.
//
//  • Prune deletes ONLY stale 'agent-run' checkpoints; user + publish checkpoints are kept
//    forever regardless of age.
//  • The pre-run checkpoint of the last M runs survives even when older than the window.
//  • Orphan-blob GC frees a blob no surviving checkpoint references, but keeps a shared one.
//  • purgeProjectCheckpoints (account/project deletion) removes every row + blob.

import { describe, it, expect, beforeEach, vi } from 'vitest';

interface Row { [k: string]: unknown }
const db: { [k: string]: Row[]; project_checkpoints: Row[] } = { project_checkpoints: [] };

class Query {
  private rows: Row[];
  private filters: Array<(r: Row) => boolean> = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private mode: 'select' | 'delete' = 'select';
  constructor(table: string) { this.rows = db[table] ?? (db[table] = []); }
  select(_c?: string) { this.mode = 'select'; return this; }
  delete() { this.mode = 'delete'; return this; }
  eq(col: string, val: unknown) { this.filters.push((r) => r[col] === val); return this; }
  lt(col: string, val: unknown) { this.filters.push((r) => String(r[col]) < String(val)); return this; }
  in(col: string, arr: unknown[]) { this.filters.push((r) => arr.includes(r[col])); return this; }
  not(col: string) { this.filters.push((r) => r[col] !== null && r[col] !== undefined); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orderCol = col; this.orderAsc = opts?.ascending ?? true; return this; }
  limit(n: number) { this.limitN = n; return this; }
  private _apply(): Row[] {
    let out = this.rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.orderCol) { const c = this.orderCol; out = [...out].sort((a, b) => (String(a[c]) < String(b[c]) ? -1 : 1) * (this.orderAsc ? 1 : -1)); }
    if (this.limitN != null) out = out.slice(0, this.limitN);
    return out;
  }
  then(resolve: (v: { data: Row[]; error: null }) => void) {
    if (this.mode === 'delete') {
      const keep = this.rows.filter((r) => !this.filters.every((f) => f(r)));
      this.rows.length = 0; this.rows.push(...keep);
      resolve({ data: [], error: null });
      return;
    }
    resolve({ data: this._apply(), error: null });
  }
}
const fakeSupabase = { from: (t: string) => new Query(t) };
vi.mock('../../lib/supabase', () => ({ getSupabaseAdmin: () => fakeSupabase }));

// eslint-disable-next-line import/first
import { pruneAgentAutoCheckpoints, purgeProjectCheckpoints, gcOrphanBlobs } from './retention';
// eslint-disable-next-line import/first
import { putStringAtKey, sumPrefixBytes, keyExists } from '../file-storage';

const NOW = Date.parse('2026-07-17T00:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 24 * 3600_000).toISOString();

function cp(row: Partial<Row> & { project_id: string; created_by: string; created_at: string; manifest: unknown }): Row {
  return { id: `cp-${Math.random().toString(36).slice(2)}`, user_id: 'u1', run_id: null, deployed_url: null, ...row };
}

beforeEach(() => { db.project_checkpoints = []; });

describe('retention — F5 prune', () => {
  it('deletes stale agent-run checkpoints but keeps user + publish forever', async () => {
    const projectId = 'p1';
    db.project_checkpoints.push(
      cp({ project_id: projectId, created_by: 'agent-run', run_id: 'old-run', created_at: daysAgo(40), manifest: { files: [] } }),
      cp({ project_id: projectId, created_by: 'user', created_at: daysAgo(90), manifest: { files: [] } }),
      cp({ project_id: projectId, created_by: 'publish', deployed_url: 'https://x.vercel.app', created_at: daysAgo(90), manifest: { files: [] } }),
      cp({ project_id: projectId, created_by: 'agent-run', run_id: 'recent-run', created_at: daysAgo(2), manifest: { files: [] } }),
    );

    const res = await pruneAgentAutoCheckpoints({ olderThanDays: 30, keepLastRuns: 1, now: NOW });
    // 'old-run' agent-auto is 40d old and NOT among the last 1 runs (recent-run is) → deleted.
    expect(res.deletedCheckpoints).toBe(1);
    const survivors = db.project_checkpoints.map((r) => r.created_by).sort();
    expect(survivors).toEqual(['agent-run', 'publish', 'user']); // the old agent-run is gone
    expect(db.project_checkpoints.some((r) => r.run_id === 'old-run')).toBe(false);
    expect(db.project_checkpoints.some((r) => r.run_id === 'recent-run')).toBe(true);
  });

  it('keeps the pre-run checkpoint of the last M runs even when older than the window', async () => {
    const projectId = 'p2';
    // Two OLD agent-run checkpoints; keepLastRuns=2 protects both by run_id.
    db.project_checkpoints.push(
      cp({ project_id: projectId, created_by: 'agent-run', run_id: 'r-a', created_at: daysAgo(50), manifest: { files: [] } }),
      cp({ project_id: projectId, created_by: 'agent-run', run_id: 'r-b', created_at: daysAgo(60), manifest: { files: [] } }),
      cp({ project_id: projectId, created_by: 'agent-run', run_id: 'r-c', created_at: daysAgo(70), manifest: { files: [] } }),
    );
    const res = await pruneAgentAutoCheckpoints({ olderThanDays: 30, keepLastRuns: 2, now: NOW });
    // The 2 newest runs (r-a, r-b) are protected; only the 3rd-oldest (r-c) is pruned.
    expect(res.deletedCheckpoints).toBe(1);
    expect(db.project_checkpoints.some((r) => r.run_id === 'r-c')).toBe(false);
    expect(db.project_checkpoints.some((r) => r.run_id === 'r-a')).toBe(true);
    expect(db.project_checkpoints.some((r) => r.run_id === 'r-b')).toBe(true);
  });

  it('GC frees an orphan blob but keeps one a surviving checkpoint still references', async () => {
    const projectId = 'p3';
    const blobPrefix = `checkpoints/${projectId}/blobs/`;
    // Two blobs: 'shared' referenced by a surviving user checkpoint, 'orphan' by nobody.
    await putStringAtKey(`${blobPrefix}shared`, 'shared content');
    await putStringAtKey(`${blobPrefix}orphan`, 'orphan content');
    db.project_checkpoints.push(
      cp({ project_id: projectId, created_by: 'user', created_at: daysAgo(1), manifest: { files: [{ path: 'a.txt', hash: 'shared', size: 14 }] } }),
    );

    const freed = await gcOrphanBlobs(projectId);
    expect(freed).toBe(1);
    expect(await keyExists(`${blobPrefix}shared`)).toBe(true);
    expect(await keyExists(`${blobPrefix}orphan`)).toBe(false);
  });
});

describe('retention — F5 purge (account/project deletion)', () => {
  it('removes every checkpoint row and blob for the purged projects', async () => {
    const projectId = 'p-del';
    const blobPrefix = `checkpoints/${projectId}/blobs/`;
    await putStringAtKey(`${blobPrefix}h1`, 'one');
    await putStringAtKey(`${blobPrefix}h2`, 'two');
    db.project_checkpoints.push(
      cp({ project_id: projectId, created_by: 'user', created_at: daysAgo(1), manifest: { files: [{ path: 'a', hash: 'h1', size: 3 }] } }),
      cp({ project_id: projectId, created_by: 'publish', created_at: daysAgo(1), manifest: { files: [{ path: 'a', hash: 'h2', size: 3 }] } }),
      cp({ project_id: 'other-project', created_by: 'user', created_at: daysAgo(1), manifest: { files: [] } }),
    );

    const res = await purgeProjectCheckpoints([projectId]);
    expect(res.purgedProjects).toEqual([projectId]);
    expect(res.deletedBlobs).toBe(2);
    expect(await sumPrefixBytes(blobPrefix)).toBe(0);
    // Rows for the purged project are gone; the unrelated project is untouched.
    expect(db.project_checkpoints.every((r) => r.project_id !== projectId)).toBe(true);
    expect(db.project_checkpoints.some((r) => r.project_id === 'other-project')).toBe(true);
  });
});
