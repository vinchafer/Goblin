// FEEL-3a A1 gate: agent_runs persistence in both schema modes.
// Verifies the run row is created with 0001-era columns, finalized with the 0081
// log columns when they exist, and — critically — that a missing-column error on
// finalize retries with the bare lifecycle update so a pre-0081 DB keeps the row.

import { describe, it, expect, beforeEach, vi } from 'vitest';

type UpdateResult = { error: { message: string } | null };
type SelectResult = { data: unknown; error: { message: string; code?: string } | null };

let inserted: Array<Record<string, unknown>>;
let updated: Array<Record<string, unknown>>;
let insertResult: { data: { id: string } | null; error: { message: string } | null };
let updateResults: UpdateResult[];
// U2 (0106 heartbeat tests): a queue of .select() results — findActiveRun/
// isRunHeartbeatStale each issue ONE select per call (with the pre-0106 fallback
// re-querying, so a fallback scenario consumes two from the queue in order).
let selectResults: SelectResult[];

function fakeSelectChain(result: SelectResult) {
  const c = {
    eq: () => c,
    order: () => c,
    limit: () => c,
    maybeSingle: () => Promise.resolve(result),
  };
  return c;
}

const fakeSupabase = {
  from: (_table: string) => ({
    insert: (row: Record<string, unknown>) => {
      inserted.push(row);
      return {
        select: () => ({
          single: () => Promise.resolve(insertResult),
        }),
      };
    },
    update: (row: Record<string, unknown>) => {
      updated.push(row);
      return {
        eq: () => Promise.resolve(updateResults.shift() ?? { error: null }),
      };
    },
    // U2 (0106): findActiveRun/isRunHeartbeatStale read via .select(...).eq()...maybeSingle().
    select: (_columns: string) => fakeSelectChain(selectResults.shift() ?? { data: null, error: null }),
  }),
};

vi.mock('../../lib/supabase', () => ({ getSupabaseAdmin: () => fakeSupabase }));

// eslint-disable-next-line import/first
import {
  createAgentRun, finalizeAgentRun, touchRunHeartbeat, isRunHeartbeatStale, findActiveRun,
  __resetHeartbeatProbe,
} from './run-store';

describe('run-store — A1 agent_runs persistence', () => {
  beforeEach(() => {
    inserted = [];
    updated = [];
    insertResult = { data: { id: 'run-1' }, error: null };
    updateResults = [];
  });

  it('creates a run row with 0001-era columns and status running', async () => {
    const id = await createAgentRun({
      userId: 'u1',
      projectId: 'p1',
      model: 'goblin/efficient',
      sourceTier: 'goblin_hosted',
    });
    expect(id).toBe('run-1');
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      user_id: 'u1',
      project_id: 'p1',
      model_used: 'goblin/efficient',
      source_tier: 'goblin_hosted',
      status: 'running',
    });
    // create must NOT depend on any 0081 column.
    expect(inserted[0]).not.toHaveProperty('step_log');
    expect(inserted[0]).not.toHaveProperty('outcome');
  });

  it('returns null when the insert fails (loop still runs, evidence lost)', async () => {
    insertResult = { data: null, error: { message: 'boom' } };
    const id = await createAgentRun({ userId: 'u1', projectId: 'p1', model: 'm' });
    expect(id).toBeNull();
  });

  it('finalize writes the 0081 log columns + the A-6 0088 report card when they exist', async () => {
    await finalizeAgentRun('run-1', {
      status: 'success',
      outcome: 'finished',
      inputTokens: 1200,
      outputTokens: 340,
      iterations: 4,
      toolsUsed: ['read_file', 'write_file', 'save_draft', 'finish'],
      steps: [
        { tool: 'read_file', args: 'index.html', outcome: 'ok', ms: 12 },
        { tool: 'write_file', args: 'script.js · GEÄNDERT +14 −2', outcome: 'ok', ms: 30 },
      ],
      report: { state: 'draft-saved', files: [], modelText: 'Fertig.' },
    });
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({
      status: 'success',
      outcome: 'finished',
      iterations: 4,
      input_tokens: 1200,
      output_tokens: 340,
    });
    expect(updated[0]!.tools_used).toEqual(['read_file', 'write_file', 'save_draft', 'finish']);
    expect((updated[0]!.step_log as unknown[])).toHaveLength(2);
    // A-6: the report card is persisted so a stop/abort can recover it via REST.
    expect(updated[0]!.report).toMatchObject({ state: 'draft-saved', modelText: 'Fertig.' });
  });

  it('finalize drops ONLY the 0088 report column when it is absent — keeps the 0081 log (pre-0088 tolerant)', async () => {
    // First update (with report) errors as if pre-0088; the retry keeps the 0081 log,
    // dropping only report, so a pre-0088 DB still records the full step log.
    updateResults = [{ error: { message: 'column "report" does not exist' } }, { error: null }];
    await finalizeAgentRun('run-1', {
      status: 'success',
      outcome: 'finished',
      iterations: 2,
      toolsUsed: ['write_file'],
      steps: [{ tool: 'write_file', args: 'index.html · NEU', outcome: 'ok', ms: 8 }],
      report: { state: 'draft-saved', files: [], modelText: 'x' },
    });
    expect(updated).toHaveLength(2);
    expect(updated[0]).toHaveProperty('report');
    // The retry keeps the 0081 columns but drops report.
    expect(updated[1]).toHaveProperty('step_log');
    expect(updated[1]).toHaveProperty('outcome', 'finished');
    expect(updated[1]).not.toHaveProperty('report');
  });

  it('finalize falls back to the bare lifecycle update when 0081 columns are absent — pre-migration tolerant', async () => {
    // 3-tier fallback: full(0081+report) errors, keep-log(0081, no report) still errors as
    // if pre-0081, then the bare lifecycle update keeps the row.
    updateResults = [
      { error: { message: 'column "report" does not exist' } },
      { error: { message: 'column "step_log" does not exist' } },
      { error: null },
    ];
    await finalizeAgentRun('run-1', {
      status: 'success',
      outcome: 'budget',
      inputTokens: 5,
      outputTokens: 5,
      iterations: 8,
      toolsUsed: ['list_files'],
      steps: [{ tool: 'list_files', args: '', outcome: 'ok', ms: 3 }],
      report: { state: 'stopped', files: [], modelText: '' },
    });
    expect(updated).toHaveLength(3);
    // First attempt carried report + the 0081 columns...
    expect(updated[0]).toHaveProperty('report');
    expect(updated[0]).toHaveProperty('step_log');
    // ...the keep-log retry dropped report but kept the 0081 columns...
    expect(updated[1]).not.toHaveProperty('report');
    expect(updated[1]).toHaveProperty('step_log');
    // ...the final fallback dropped everything but the lifecycle fields.
    expect(updated[2]).not.toHaveProperty('step_log');
    expect(updated[2]).not.toHaveProperty('outcome');
    expect(updated[2]).not.toHaveProperty('tools_used');
    expect(updated[2]).toMatchObject({ status: 'success', input_tokens: 5, output_tokens: 5 });
    expect(updated[2]).toHaveProperty('completed_at');
  });

  it('finalize on an empty runId is a no-op', async () => {
    await finalizeAgentRun('', {
      status: 'failed',
      outcome: 'error',
      iterations: 0,
      toolsUsed: [],
      steps: [],
    });
    expect(updated).toHaveLength(0);
  });
});

// FOUNDER-WALK-7 · U2 — the phantom-session fix. heartbeat_at (0106) is the signal
// that turns "status='running' since forever" into "verified alive N seconds ago."
// Reuses the ONE fakeSupabase above (now select()-capable) rather than a second
// vi.mock — vi.mock calls are hoisted module-wide, so a second one for the same
// module would just clobber the first instead of scoping to this describe block.
describe('run-store — U2 heartbeat (0106, pre-migration tolerant)', () => {
  beforeEach(() => {
    inserted = [];
    updated = [];
    updateResults = [];
    selectResults = [];
    __resetHeartbeatProbe();
  });

  it('touchRunHeartbeat writes heartbeat_at and degrades silently on a missing-column error', async () => {
    updateResults = [{ error: null }];
    await touchRunHeartbeat('run-1');
    expect(updated).toHaveLength(1);
    expect(updated[0]).toHaveProperty('heartbeat_at');

    updateResults = [{ error: { message: 'column "heartbeat_at" does not exist' } }];
    await expect(touchRunHeartbeat('run-2')).resolves.toBeUndefined(); // never throws
  });

  it('touchRunHeartbeat on an empty runId is a no-op', async () => {
    await touchRunHeartbeat('');
    expect(updated).toHaveLength(0);
  });

  it('isRunHeartbeatStale: fresh heartbeat → not stale', async () => {
    selectResults = [{ data: { status: 'running', heartbeat_at: new Date().toISOString() }, error: null }];
    expect(await isRunHeartbeatStale('run-1')).toBe(false);
  });

  it('isRunHeartbeatStale: heartbeat older than 90s → stale', async () => {
    selectResults = [{ data: { status: 'running', heartbeat_at: new Date(Date.now() - 120_000).toISOString() }, error: null }];
    expect(await isRunHeartbeatStale('run-1')).toBe(true);
  });

  it('isRunHeartbeatStale: no heartbeat written yet → never guess stale', async () => {
    selectResults = [{ data: { status: 'running', heartbeat_at: null }, error: null }];
    expect(await isRunHeartbeatStale('run-1')).toBe(false);
  });

  it('isRunHeartbeatStale: already terminal → not this check\'s job', async () => {
    selectResults = [{ data: { status: 'success', heartbeat_at: new Date(Date.now() - 999_999).toISOString() }, error: null }];
    expect(await isRunHeartbeatStale('run-1')).toBe(false);
  });

  it('isRunHeartbeatStale: missing-column error → false, never claims staleness pre-migration', async () => {
    selectResults = [{ data: null, error: { message: 'column agent_runs.heartbeat_at does not exist' } }];
    expect(await isRunHeartbeatStale('run-1')).toBe(false);
  });

  it('findActiveRun: fresh heartbeat wins even on an OLD row (heartbeat, not raw age, decides)', async () => {
    selectResults = [{
      data: { id: 'run-1', status: 'running', created_at: new Date(Date.now() - 15 * 60_000).toISOString(), heartbeat_at: new Date().toISOString() },
      error: null,
    }];
    const active = await findActiveRun('session-1', 'user-1', 10 * 60_000);
    expect(active).toMatchObject({ runId: 'run-1', status: 'running' });
  });

  it('findActiveRun: stale heartbeat on a fresh-looking row → zombie, not offered', async () => {
    selectResults = [{
      data: { id: 'run-1', status: 'running', created_at: new Date().toISOString(), heartbeat_at: new Date(Date.now() - 120_000).toISOString() },
      error: null,
    }];
    // staleAfterMs (age-based) would still call this "active" — heartbeat overrides it.
    const active = await findActiveRun('session-1', 'user-1', 20 * 60_000);
    expect(active).toBeNull();
  });

  it('findActiveRun: no heartbeat column (pre-0106) → falls back to the old age-only heuristic, honest degrade', async () => {
    // First call (with heartbeat_at in the select) errors as a missing column; the
    // fallback select (without it) succeeds.
    selectResults = [
      { data: null, error: { message: 'column agent_runs.heartbeat_at does not exist' } },
      { data: { id: 'run-1', status: 'running', created_at: new Date().toISOString() }, error: null },
    ];
    const active = await findActiveRun('session-1', 'user-1', 20 * 60_000);
    expect(active).toMatchObject({ runId: 'run-1', heartbeatAt: null });
  });

  it('findActiveRun: pre-0106 fallback still expires by raw age past staleAfterMs', async () => {
    selectResults = [
      { data: null, error: { message: 'column agent_runs.heartbeat_at does not exist' } },
      { data: { id: 'run-1', status: 'running', created_at: new Date(Date.now() - 30 * 60_000).toISOString() }, error: null },
    ];
    const active = await findActiveRun('session-1', 'user-1', 20 * 60_000);
    expect(active).toBeNull();
  });

  it('findActiveRun: no row → null', async () => {
    selectResults = [{ data: null, error: null }];
    expect(await findActiveRun('session-1', 'user-1', 60_000)).toBeNull();
  });
});
