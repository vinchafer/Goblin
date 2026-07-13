// F-40 U1 gate: the agent_run_events store — append + ordered load, secret scrubbing,
// and pre-migration tolerance (a missing 0091 table no-ops the append and returns [] from
// load, so a pre-migration DB never crashes and same-process re-attach still works).

import { describe, it, expect, beforeEach, vi } from 'vitest';

interface Row { run_id: string; user_id: string; project_id: string; seq: number; type: string; payload: Record<string, unknown> }

let rows: Row[];
// When set, every insert/select resolves to this error (simulates a pre-0091 DB, etc.).
let forcedError: { code?: string; message: string } | null;

const fakeSupabase = {
  from: (_t: string) => ({
    insert: (row: Row) => {
      if (forcedError) return Promise.resolve({ error: forcedError });
      // Enforce the (run_id, seq) unique constraint like the real table.
      if (rows.some((r) => r.run_id === row.run_id && r.seq === row.seq)) {
        return Promise.resolve({ error: { code: '23505', message: 'duplicate key' } });
      }
      rows.push(row);
      return Promise.resolve({ error: null });
    },
    select: (_cols: string) => {
      const q = {
        _run: '' as string,
        _user: '' as string,
        _since: 0,
        eq(col: string, val: string) { if (col === 'run_id') this._run = val; if (col === 'user_id') this._user = val; return this; },
        gt(_col: string, val: number) { this._since = val; return this; },
        order() { return this; },
        limit() {
          if (forcedError) return Promise.resolve({ data: null, error: forcedError });
          const data = rows
            .filter((r) => r.run_id === this._run && r.user_id === this._user && r.seq > this._since)
            .sort((a, b) => a.seq - b.seq)
            .map((r) => ({ seq: r.seq, type: r.type, payload: r.payload }));
          return Promise.resolve({ data, error: null });
        },
      };
      return q;
    },
  }),
};

vi.mock('../../lib/supabase', () => ({ getSupabaseAdmin: () => fakeSupabase }));

// eslint-disable-next-line import/first
import { appendRunEvent, loadRunEvents, __resetRunEventsProbe } from './run-events';

const meta = { runId: 'run-1', userId: 'u1', projectId: 'p1' };

describe('run-events — F-40 U1 append-only event log', () => {
  beforeEach(() => {
    rows = [];
    forcedError = null;
    __resetRunEventsProbe();
  });

  it('appends events and loads them ordered by seq, filtered by since', async () => {
    await appendRunEvent({ ...meta, seq: 1, type: 'meta', payload: { model_slug: 'goblin/efficient' } });
    await appendRunEvent({ ...meta, seq: 2, type: 'agent_step', payload: { tool: 'write_file', summary: 'index.html · NEU', ok: true, ms: 12 } });
    await appendRunEvent({ ...meta, seq: 3, type: 'agent_report', payload: { report: { state: 'draft-saved' } } });

    const all = await loadRunEvents('run-1', 'u1', 0);
    expect(all.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(all[0]).toMatchObject({ type: 'meta', payload: { model_slug: 'goblin/efficient' } });

    // The resume cursor: only events after seq 1.
    const since = await loadRunEvents('run-1', 'u1', 1);
    expect(since.map((e) => e.seq)).toEqual([2, 3]);
  });

  it('scrubs secrets in the payload before persisting (narration/report may echo a key)', async () => {
    await appendRunEvent({
      ...meta, seq: 1, type: 'agent_narration',
      payload: { text: 'nutze sk-ABCDEF1234567890ABCDEF1234 fuer den call' },
    });
    const [ev] = await loadRunEvents('run-1', 'u1', 0);
    expect(String(ev!.payload.text)).not.toContain('sk-ABCDEF1234567890ABCDEF1234');
    expect(String(ev!.payload.text)).toContain('[REDACTED]');
  });

  it('is ownership-scoped: another user does not see the run events', async () => {
    await appendRunEvent({ ...meta, seq: 1, type: 'agent_step', payload: {} });
    const other = await loadRunEvents('run-1', 'intruder', 0);
    expect(other).toEqual([]);
  });

  it('a duplicate (run_id, seq) is a benign no-op (retry-safe), not a throw', async () => {
    await appendRunEvent({ ...meta, seq: 1, type: 'agent_step', payload: { a: 1 } });
    await appendRunEvent({ ...meta, seq: 1, type: 'agent_step', payload: { a: 2 } }); // duplicate seq
    const all = await loadRunEvents('run-1', 'u1', 0);
    expect(all).toHaveLength(1);
    expect(all[0]!.payload).toMatchObject({ a: 1 }); // first write wins, no crash
  });

  it('pre-migration tolerant: a missing 0091 table no-ops append and returns [] from load', async () => {
    forcedError = { code: '42P01', message: 'relation "public.agent_run_events" does not exist' };
    await appendRunEvent({ ...meta, seq: 1, type: 'agent_step', payload: {} }); // must not throw
    const all = await loadRunEvents('run-1', 'u1', 0);
    expect(all).toEqual([]);
    // Probe cached as absent → subsequent calls also no-op without touching the DB.
    forcedError = null; // even if the table "came back", the cached probe stays absent this process
    const again = await loadRunEvents('run-1', 'u1', 0);
    expect(again).toEqual([]);
  });
});
