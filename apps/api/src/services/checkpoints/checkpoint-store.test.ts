// WAVE-F F1/F2 gates — the checkpoint engine, proven against the in-memory storage fallback.
//
//  • F1 dedup gate: 10 checkpoints of a 20-file project that never changes must NOT cost
//    10× the bytes — content-addressed blobs collapse to one per unique content.
//  • F1 pre-state gate: snapshot → mutate → the checkpoint still holds the PRE-state.
//  • F2 round-trip gate: snapshot → mutate/add/delete → restore → BYTE-IDENTICAL to snapshot,
//    with forward history (a "Wiederhergestellt" checkpoint) preserved.
//  • F2 safety gate: restore refuses honestly while a run is active on the project.
//
// The DB is a focused in-memory PostgREST fake (only the chains the store uses); the storage
// layer is the real file-storage in-memory fallback, so the dedup/round-trip assertions run
// against the ACTUAL blob keying, not a mock of it.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Minimal in-memory PostgREST fake ─────────────────────────────────────────
interface Row { [k: string]: unknown }
const db: { [k: string]: Row[]; project_checkpoints: Row[]; agent_runs: Row[] } = { project_checkpoints: [], agent_runs: [] };
let idCounter = 0;

class Query {
  private rows: Row[];
  private filters: Array<(r: Row) => boolean> = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private mode: 'select' | 'delete' = 'select';
  constructor(private table: string) {
    this.rows = db[table] ?? (db[table] = []);
  }
  select(_cols?: string) { this.mode = 'select'; return this; }
  insert(row: Row | Row[]) {
    const rows = Array.isArray(row) ? row : [row];
    const created = rows.map((r) => ({ id: `cp-${++idCounter}`, created_at: new Date(Date.now() + idCounter).toISOString(), ...r }));
    for (const r of created) this.rows.push(r);
    return {
      select: () => ({
        single: async () => ({ data: { id: created[0]!.id }, error: null }),
      }),
    };
  }
  delete() { this.mode = 'delete'; return this; }
  eq(col: string, val: unknown) { this.filters.push((r) => r[col] === val); return this._maybeExec(); }
  lt(col: string, val: unknown) { this.filters.push((r) => String(r[col]) < String(val)); return this; }
  in(col: string, arr: unknown[]) { this.filters.push((r) => arr.includes(r[col])); return this._maybeExec(); }
  not(col: string, _op: string, _val: unknown) { this.filters.push((r) => r[col] !== null && r[col] !== undefined); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orderCol = col; this.orderAsc = opts?.ascending ?? true; return this; }
  limit(n: number) { this.limitN = n; return this; }
  private _apply(): Row[] {
    let out = this.rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.orderCol) {
      const c = this.orderCol;
      out = [...out].sort((a, b) => (String(a[c]) < String(b[c]) ? -1 : 1) * (this.orderAsc ? 1 : -1));
    }
    if (this.limitN != null) out = out.slice(0, this.limitN);
    return out;
  }
  // eq()/in() may be terminal (awaited) OR followed by more chaining. Return a hybrid.
  private _maybeExec() { return this; }
  async single() { const r = this._apply(); return { data: r[0] ?? null, error: null }; }
  async maybeSingle() { const r = this._apply(); return { data: r[0] ?? null, error: null }; }
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
import {
  snapshotProject, restoreCheckpoint, listCheckpoints, diffCheckpointVsCurrent,
  getCheckpointFileContent, __resetCheckpointProbe,
} from './checkpoint-store';
// eslint-disable-next-line import/first
import { uploadFile, downloadFile, listFiles, sumPrefixBytes, checkStorageConnection } from '../file-storage';

async function writeProject(projectId: string, files: Record<string, string>) {
  for (const [path, content] of Object.entries(files)) {
    await uploadFile(projectId, path, content);
  }
}

beforeEach(() => {
  db.project_checkpoints = [];
  db.agent_runs = [];
  idCounter = 0;
  __resetCheckpointProbe();
});

describe('checkpoint-store — F1 snapshot + dedup', () => {
  it('is running against the in-memory storage fallback (no real S3)', async () => {
    const conn = await checkStorageConnection();
    expect(conn.ok).toBe(false); // proves the memory fallback path — dedup assertions are real
  });

  it('F1 dedup: 10 snapshots of an unchanged 20-file project ≠ 10× the bytes', async () => {
    const projectId = 'proj-dedup';
    const files: Record<string, string> = {};
    for (let i = 0; i < 20; i++) files[`file${i}.txt`] = `content of file ${i} — ${'x'.repeat(50)}`;
    await writeProject(projectId, files);

    for (let i = 0; i < 10; i++) {
      const id = await snapshotProject({ projectId, userId: 'u1', label: `snap ${i}`, createdBy: 'agent-run', runId: `run-${i}` });
      expect(id).toBeTruthy();
    }
    expect(db.project_checkpoints).toHaveLength(10);

    // The blob store must hold ~one copy per unique content (20), not 10×20 = 200.
    const blobBytes = await sumPrefixBytes(`checkpoints/${projectId}/blobs/`);
    const oneSnapshotBytes = Object.values(files).reduce((a, c) => a + Buffer.byteLength(c, 'utf8'), 0);
    expect(blobBytes).toBe(oneSnapshotBytes); // exactly one dedup'd set, not ten
    expect(blobBytes).toBeLessThan(oneSnapshotBytes * 2); // hard proof it is NOT 10×
  });

  it('F1 pre-state: snapshot holds the pre-mutation content after the file changes', async () => {
    const projectId = 'proj-prestate';
    await writeProject(projectId, { 'index.html': '<h1>before</h1>' });
    const cpId = await snapshotProject({ projectId, userId: 'u1', label: 'Vor: Lauf', createdBy: 'agent-run', runId: 'r1' });
    expect(cpId).toBeTruthy();

    // Mutate AFTER the snapshot.
    await uploadFile(projectId, 'index.html', '<h1>AFTER — changed</h1>');

    const snapContent = await getCheckpointFileContent(projectId, 'u1', cpId!, 'index.html');
    expect(snapContent).toBe('<h1>before</h1>'); // the checkpoint held the pre-state
    expect(await downloadFile(projectId, 'index.html')).toBe('<h1>AFTER — changed</h1>');
  });

  it('returns null (no crash) when the checkpoints table is unavailable (pre-0095)', async () => {
    // Simulate 42P01 by making the probe select error.
    const spy = vi.spyOn(fakeSupabase, 'from').mockImplementationOnce(() => ({
      select: () => ({ limit: async () => ({ data: null, error: { code: '42P01', message: 'relation does not exist' } }) }),
    }) as unknown as Query);
    __resetCheckpointProbe();
    const id = await snapshotProject({ projectId: 'p', userId: 'u', label: 'x', createdBy: 'user' });
    expect(id).toBeNull();
    spy.mockRestore();
  });
});

describe('checkpoint-store — F2 restore round-trip', () => {
  it('F2 byte-identical round-trip: mutate + add + delete, then restore = exact snapshot', async () => {
    const projectId = 'proj-restore';
    const original = {
      'index.html': '<h1>Original</h1>\n<p>ünïcödé ✓</p>',
      'style.css': 'body { color: #7FA98A; }',
      'app.js': 'console.log("v1");',
    };
    await writeProject(projectId, original);
    const cpId = await snapshotProject({ projectId, userId: 'u1', label: 'Stand gesichert', createdBy: 'user' });
    expect(cpId).toBeTruthy();

    // Mutate one, add one, delete one.
    await uploadFile(projectId, 'app.js', 'console.log("v2 — changed");');
    await uploadFile(projectId, 'new-file.txt', 'created after the snapshot');
    // delete style.css
    const { deleteFile } = await import('../file-storage');
    await deleteFile(projectId, 'style.css');

    const res = await restoreCheckpoint(projectId, 'u1', cpId!);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.restored).toBe(3); // all three original files replayed
    expect(res.removed).toBe(1); // new-file.txt deleted
    expect(res.newCheckpointId).toBeTruthy(); // forward history preserved

    // Byte-identical: every original file back exactly, the added file gone.
    for (const [path, content] of Object.entries(original)) {
      expect(await downloadFile(projectId, path)).toBe(content);
    }
    expect(await downloadFile(projectId, 'new-file.txt')).toBeNull();

    const live = (await listFiles(projectId)).sort();
    expect(live).toEqual(Object.keys(original).sort());
  });

  it('F2 forward history: the restore itself creates a "Wiederhergestellt" checkpoint', async () => {
    const projectId = 'proj-forward';
    await writeProject(projectId, { 'a.txt': 'one' });
    const cpId = await snapshotProject({ projectId, userId: 'u1', label: 'erster Stand', createdBy: 'user' });
    await uploadFile(projectId, 'a.txt', 'two');
    await restoreCheckpoint(projectId, 'u1', cpId!);

    const timeline = await listCheckpoints(projectId, 'u1');
    expect(timeline.some((c) => c.label === 'Wiederhergestellt: erster Stand')).toBe(true);
    // The original checkpoint is still there — history is never lost.
    expect(timeline.some((c) => c.label === 'erster Stand')).toBe(true);
  });

  it('F2 safety: restore refuses honestly while a run is active on the project', async () => {
    const projectId = 'proj-active';
    await writeProject(projectId, { 'a.txt': 'x' });
    const cpId = await snapshotProject({ projectId, userId: 'u1', label: 's', createdBy: 'user' });
    // A live (non-stale) run on the project.
    db.agent_runs.push({ id: 'run-live', project_id: projectId, user_id: 'u1', status: 'running', created_at: new Date().toISOString() });

    const res = await restoreCheckpoint(projectId, 'u1', cpId!);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('run_active');
  });

  it('F2: restore of an unknown checkpoint is a clean not_found (no mutation)', async () => {
    const projectId = 'proj-nf';
    await writeProject(projectId, { 'a.txt': 'x' });
    const res = await restoreCheckpoint(projectId, 'u1', 'does-not-exist');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('not_found');
    expect(await downloadFile(projectId, 'a.txt')).toBe('x'); // untouched
  });
});

describe('checkpoint-store — F3 diff preview', () => {
  it('classifies added / removed / modified vs current from the checkpoint perspective', async () => {
    const projectId = 'proj-diff';
    await writeProject(projectId, { 'keep.txt': 'same', 'change.txt': 'v1', 'gone.txt': 'will be deleted' });
    const cpId = await snapshotProject({ projectId, userId: 'u1', label: 's', createdBy: 'user' });

    await uploadFile(projectId, 'change.txt', 'v2');            // modified
    const { deleteFile } = await import('../file-storage');
    await deleteFile(projectId, 'gone.txt');                   // restore would re-add it
    await uploadFile(projectId, 'extra.txt', 'new since snap'); // restore would remove it

    const diff = await diffCheckpointVsCurrent(projectId, 'u1', cpId!);
    expect(diff).toBeTruthy();
    const byPath = Object.fromEntries(diff!.changes.map((c) => [c.path, c.status]));
    expect(byPath['keep.txt']).toBe('unchanged');
    expect(byPath['change.txt']).toBe('modified');
    expect(byPath['gone.txt']).toBe('added');   // in snapshot, missing now → restore adds
    expect(byPath['extra.txt']).toBe('removed'); // not in snapshot → restore removes
  });
});
