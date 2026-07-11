// FEEL-3a A1 gate: agent_runs persistence in both schema modes.
// Verifies the run row is created with 0001-era columns, finalized with the 0081
// log columns when they exist, and — critically — that a missing-column error on
// finalize retries with the bare lifecycle update so a pre-0081 DB keeps the row.

import { describe, it, expect, beforeEach, vi } from 'vitest';

type UpdateResult = { error: { message: string } | null };

let inserted: Array<Record<string, unknown>>;
let updated: Array<Record<string, unknown>>;
let insertResult: { data: { id: string } | null; error: { message: string } | null };
let updateResults: UpdateResult[];

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
  }),
};

vi.mock('../../lib/supabase', () => ({ getSupabaseAdmin: () => fakeSupabase }));

// eslint-disable-next-line import/first
import { createAgentRun, finalizeAgentRun } from './run-store';

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
