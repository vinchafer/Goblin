// WAVE-F F2 — the restore_checkpoint agent tool (chat-undo), wired through buildToolExecutor.
//
//  • agentToolsFor advertises restore_checkpoint ONLY when the run granted restore intent.
//  • With no argument, restore targets the newest checkpoint EXCLUDING the run's own pre-run
//    snapshot (excludeId) — so it undoes the PREVIOUS change, not this undo-run's snapshot.
//  • The result is a structured German success the model can quote in its report.

import { describe, it, expect, beforeEach, vi } from 'vitest';

interface Row { [k: string]: unknown }
const db: { [k: string]: Row[]; project_checkpoints: Row[]; agent_runs: Row[] } = { project_checkpoints: [], agent_runs: [] };

class Query {
  private rows: Row[];
  private filters: Array<(r: Row) => boolean> = [];
  private orderCol: string | null = null; private orderAsc = true; private limitN: number | null = null;
  private mode: 'select' | 'delete' = 'select';
  constructor(table: string) { this.rows = db[table] ?? (db[table] = []); }
  select(_c?: string) { this.mode = 'select'; return this; }
  insert(row: Row) { const r = { id: `cp-${db.project_checkpoints.length + 1}`, created_at: new Date(Date.now() + this.rows.length).toISOString(), ...row }; this.rows.push(r); return { select: () => ({ single: async () => ({ data: { id: r.id }, error: null }) }) }; }
  delete() { this.mode = 'delete'; return this; }
  eq(col: string, val: unknown) { this.filters.push((r) => r[col] === val); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orderCol = col; this.orderAsc = opts?.ascending ?? true; return this; }
  limit(n: number) { this.limitN = n; return this; }
  private _apply(): Row[] {
    let out = this.rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.orderCol) { const c = this.orderCol; out = [...out].sort((a, b) => (String(a[c]) < String(b[c]) ? -1 : 1) * (this.orderAsc ? 1 : -1)); }
    if (this.limitN != null) out = out.slice(0, this.limitN);
    return out;
  }
  async single() { const r = this._apply(); return { data: r[0] ?? null, error: null }; }
  async maybeSingle() { const r = this._apply(); return { data: r[0] ?? null, error: null }; }
  then(resolve: (v: { data: Row[]; error: null }) => void) { resolve({ data: this._apply(), error: null }); }
}
const fakeSupabase = { from: (t: string) => new Query(t) };
vi.mock('../../lib/supabase', () => ({ getSupabaseAdmin: () => fakeSupabase }));

// eslint-disable-next-line import/first
import { buildToolExecutor, agentToolsFor, RESTORE_CHECKPOINT_TOOL } from './tools';
// eslint-disable-next-line import/first
import { snapshotProject, __resetCheckpointProbe } from '../checkpoints/checkpoint-store';
// eslint-disable-next-line import/first
import { uploadFile, downloadFile } from '../file-storage';

const ctx = { userId: 'u1', projectId: 'proj-tool', sessionId: 's1' };

beforeEach(() => { db.project_checkpoints = []; db.agent_runs = []; __resetCheckpointProbe(); });

describe('agentToolsFor — restore gating', () => {
  it('advertises restore_checkpoint only when restore intent was granted', () => {
    expect(agentToolsFor({ search: false }).some((t) => t.name === 'restore_checkpoint')).toBe(false);
    expect(agentToolsFor({ search: false, restore: true }).some((t) => t.name === RESTORE_CHECKPOINT_TOOL.name)).toBe(true);
  });
});

describe('restore_checkpoint tool — default target excludes the run own pre-snapshot', () => {
  it('undoes the PREVIOUS change, not this undo-run own snapshot', async () => {
    // State v1, snapshot CP_prev (= v1) — the previous run's pre-snapshot.
    await uploadFile(ctx.projectId, 'app.js', 'v1');
    const cpPrev = await snapshotProject({ projectId: ctx.projectId, userId: ctx.userId, label: 'Vor: erste Änderung', createdBy: 'agent-run', runId: 'r-prev' });

    // The user changed it to v2, then asked to undo → this undo-run snapshots CP_now (= v2).
    await uploadFile(ctx.projectId, 'app.js', 'v2');
    const cpNow = await snapshotProject({ projectId: ctx.projectId, userId: ctx.userId, label: 'Vor: rückgängig', createdBy: 'agent-run', runId: 'r-now' });
    expect(cpNow).toBeTruthy();

    // The executor built for THIS run excludes cpNow.
    const exec = buildToolExecutor(fakeSupabase as never, { restoreExcludeCheckpointId: cpNow });
    const result = await exec({ id: 'c1', name: 'restore_checkpoint', args: {} }, { ...ctx, emitProgress: () => {} });

    expect(result.ok).toBe(true);
    expect(result.summary).toContain('Wiederhergestellt');
    // app.js is back to v1 (CP_prev), the change is undone.
    expect(await downloadFile(ctx.projectId, 'app.js')).toBe('v1');
    // The target was CP_prev, not CP_now.
    expect((result.data as { label?: string }).label).toBe('Vor: erste Änderung');
    void cpPrev;
  });

  it('honest tool error when there is no earlier checkpoint to restore', async () => {
    await uploadFile(ctx.projectId, 'only.txt', 'x');
    const cpNow = await snapshotProject({ projectId: ctx.projectId, userId: ctx.userId, label: 'Vor: rückgängig', createdBy: 'agent-run', runId: 'r-now' });
    const exec = buildToolExecutor(fakeSupabase as never, { restoreExcludeCheckpointId: cpNow });
    const result = await exec({ id: 'c1', name: 'restore_checkpoint', args: {} }, { ...ctx, emitProgress: () => {} });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('no_checkpoint');
  });
});
