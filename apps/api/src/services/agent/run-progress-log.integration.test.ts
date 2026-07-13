// F-40 U3 gate: progress streams into the log AS the run executes.
//
// Wires the REAL orchestrator (runAgent) through the run registry with a step-gated model,
// and proves two things the SPIKE called for:
//   1. a connected client receives step events INCREMENTALLY — step 1 lands before step 2's
//      model turn has even started (not buffered to the end);
//   2. afterwards the durable event log (0091) holds the full ordered sequence — the single
//      source of truth a re-attaching client replays.
//
// This is the "one source of truth, reuse the streaming path" property: the same emit path
// feeds the live client and the persisted log — no parallel plumbing (the F-29 anti-pattern).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RunEvent } from './run-events';

const logStore: Array<RunEvent & { runId: string; userId: string }> = [];
vi.mock('./run-events', () => ({
  appendRunEvent: vi.fn(async (i: { runId: string; userId: string; seq: number; type: string; payload: Record<string, unknown> }) => {
    logStore.push({ runId: i.runId, userId: i.userId, seq: i.seq, type: i.type as RunEvent['type'], payload: i.payload });
  }),
  loadRunEvents: vi.fn(async (runId: string, userId: string, since = 0) =>
    logStore.filter((e) => e.runId === runId && e.userId === userId && e.seq > since)
      .sort((a, b) => a.seq - b.seq).map((e) => ({ seq: e.seq, type: e.type, payload: e.payload })),
  ),
}));

// eslint-disable-next-line import/first
import { startRun, streamRunEvents, __resetRunRegistry } from './run-registry';
// eslint-disable-next-line import/first
import { runAgent } from './orchestrator';
// eslint-disable-next-line import/first
import type { AgentModel, ModelTurn, ToolExecutor, ToolResult, ToolSpec, RunResult } from './types';

const TOOLS: ToolSpec[] = [
  { name: 'write_file', description: '', parameters: {} },
  { name: 'save_draft', description: '', parameters: {} },
  { name: 'finish', description: '', parameters: {} },
];

const executor: ToolExecutor = async (call): Promise<ToolResult> => {
  if (call.name === 'write_file') {
    return { ok: true, summary: `${call.args.path} · NEU`, file: { path: String(call.args.path), classification: 'NEU' } };
  }
  if (call.name === 'save_draft') return { ok: true, summary: 'Entwurf gesichert ✓' };
  return { ok: false, summary: 'x', error: { code: 'unknown_tool', message: 'x' } };
};

function nativeTurn(name: string, args: Record<string, unknown> = {}): ModelTurn {
  return { content: `Ich rufe ${name}`, toolCalls: [{ id: `c-${name}`, name, args }], usage: { inputTokens: 50, outputTokens: 10 } };
}

/** A model whose Nth turn blocks on gates[N] until the test releases it. */
function gatedModel(turns: ModelTurn[], gates: Array<Promise<void>>): AgentModel {
  let i = 0;
  return {
    supportsNativeTools: true,
    async turn() {
      const idx = i++;
      if (gates[idx]) await gates[idx];
      return turns[Math.min(idx, turns.length - 1)]!;
    },
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

describe('F-40 U3 — progress streams into the log as the run executes', () => {
  beforeEach(() => { logStore.length = 0; __resetRunRegistry(); });
  afterEach(() => { __resetRunRegistry(); });

  it('a connected client sees steps incrementally, and the log holds the full ordered sequence', async () => {
    const g0 = deferred(); // gate turn 0 (write index.html)
    const g1 = deferred(); // gate turn 1 (write app.js)
    // turn 2 (finish) is ungated → runs as soon as turn 1 releases.

    startRun<RunResult>({
      runId: 'run-live', userId: 'u1', projectId: 'p1', sessionId: 's1', modelSlug: 'goblin/efficient',
      execute: ({ emit, stopSignal }) =>
        runAgent({
          runId: 'run-live', userId: 'u1', projectId: 'p1', sessionId: 's1',
          modelSlug: 'goblin/efficient', systemPrompt: 'SYS', userMessage: 'Baue eine App',
          tools: TOOLS, executor,
          model: gatedModel(
            [nativeTurn('write_file', { path: 'index.html', content: '<html>' }),
             nativeTurn('write_file', { path: 'app.js', content: 'x' }),
             nativeTurn('finish', { report: 'Fertig.' })],
            [g0.promise, g1.promise],
          ),
          bill: async () => {},
          emit: (e) => { emit(e); }, stopSignal,
        }),
      onComplete: () => {}, onError: () => {},
    });

    // Attach a connected client. Run the stream in the background; collect frames as they land.
    const frames: RunEvent[] = [];
    const streamP = streamRunEvents('run-live', 'u1', 0, async (ev) => { frames.push(ev); });

    // Before any turn runs, only the leading meta frame is visible — nothing buffered.
    await tick();
    expect(frames.map((f) => f.type)).toEqual(['meta']);

    // Release turn 0 → the FIRST step must arrive while turn 1 is still gated (incremental,
    // not buffered to the end).
    g0.resolve();
    await tick(20);
    const stepsAfterT0 = frames.filter((f) => f.type === 'agent_step');
    expect(stepsAfterT0).toHaveLength(1);
    expect(stepsAfterT0[0]!.payload).toMatchObject({ tool: 'write_file', summary: 'index.html · NEU' });
    // The run is NOT finished yet — no report/done while turn 1 is gated.
    expect(frames.some((f) => f.type === 'agent_report' || f.type === 'done')).toBe(false);

    // Release the rest → the run completes.
    g1.resolve();
    await streamP;

    // The client saw both steps, the report, and the terminal done — in order.
    const types = frames.map((f) => f.type);
    expect(types.filter((t) => t === 'agent_step')).toHaveLength(2);
    expect(types).toContain('agent_report');
    expect(types[types.length - 1]).toBe('done');
    const seqs = frames.map((f) => f.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));

    // The DURABLE LOG holds the same full ordered sequence (the replay source).
    const logged = logStore.filter((e) => e.runId === 'run-live').sort((a, b) => a.seq - b.seq);
    expect(logged.map((e) => e.type)).toEqual(frames.map((f) => f.type));
    expect(logged.map((e) => e.seq)).toEqual(frames.map((f) => f.seq));
    // Ground-truth ordering: meta first, two write steps, a report, then done.
    expect(logged[0]!.type).toBe('meta');
    expect(logged.filter((e) => e.type === 'agent_step')).toHaveLength(2);
    expect(logged[logged.length - 1]!.type).toBe('done');
  });
});
