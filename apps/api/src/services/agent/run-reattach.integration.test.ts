// F-40 U4 gate: a returning client re-attaches to an in-flight (or just-finished) run.
//
//   1. disconnect/reconnect mid-run: client A starts a run and disconnects after the first
//      step; client B re-attaches from seq 0 and receives the FULL step history replayed
//      PLUS the subsequent live events, ending in the terminal frame;
//   2. finished-while-away: a run completes with no client attached; a later re-attach
//      replays the whole sequence including the agent_report frame → the report card renders.
//
// Drives the REAL orchestrator through the registry; run-events is an in-memory stand-in
// for the durable log (0091).

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
  { name: 'finish', description: '', parameters: {} },
];
const executor: ToolExecutor = async (call): Promise<ToolResult> =>
  call.name === 'write_file'
    ? { ok: true, summary: `${call.args.path} · NEU`, file: { path: String(call.args.path), classification: 'NEU' } }
    : { ok: false, summary: 'x', error: { code: 'e', message: 'x' } };

function nativeTurn(name: string, args: Record<string, unknown> = {}): ModelTurn {
  return { content: '', toolCalls: [{ id: `c-${name}-${args.path ?? ''}`, name, args }], usage: { inputTokens: 20, outputTokens: 5 } };
}
function gatedModel(turns: ModelTurn[], gates: Array<Promise<void>>): AgentModel {
  let i = 0;
  return { supportsNativeTools: true, async turn() { const idx = i++; if (gates[idx]) await gates[idx]; return turns[Math.min(idx, turns.length - 1)]!; } };
}
function deferred() { let resolve!: () => void; const promise = new Promise<void>((r) => { resolve = r; }); return { promise, resolve }; }
const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

function startGatedRun(runId: string, turns: ModelTurn[], gates: Array<Promise<void>>, onComplete: () => void = () => {}) {
  startRun<RunResult>({
    runId, userId: 'u1', projectId: 'p1', sessionId: 's1', modelSlug: 'goblin/efficient',
    execute: ({ emit, stopSignal }) =>
      runAgent({
        runId, userId: 'u1', projectId: 'p1', sessionId: 's1', modelSlug: 'goblin/efficient',
        systemPrompt: 'SYS', userMessage: 'Baue', tools: TOOLS, executor,
        model: gatedModel(turns, gates), bill: async () => {}, emit: (e) => { emit(e); }, stopSignal,
      }),
    onComplete, onError: () => {},
  });
}

describe('F-40 U4 — client re-attach', () => {
  beforeEach(() => { logStore.length = 0; __resetRunRegistry(); });
  afterEach(() => { __resetRunRegistry(); });

  it('disconnect mid-run then reconnect: the returning client gets full history + live continuation', async () => {
    const g0 = deferred(), g1 = deferred();
    startGatedRun('run-A', [
      nativeTurn('write_file', { path: 'index.html', content: '<html>' }),
      nativeTurn('write_file', { path: 'app.js', content: 'x' }),
      nativeTurn('finish', { report: 'Fertig.' }),
    ], [g0.promise, g1.promise]);

    // --- Client A: attaches, sees the first step, then LEAVES THE BROWSER. ---
    const aFrames: RunEvent[] = [];
    const aAbort = new AbortController();
    const aStream = streamRunEvents('run-A', 'u1', 0, async (ev) => { aFrames.push(ev); }, { signal: aAbort.signal });
    g0.resolve();
    await tick(20);
    expect(aFrames.some((f) => f.type === 'agent_step')).toBe(true); // A saw step 1
    aAbort.abort(); // disconnect
    await aStream;
    const aLastSeq = Math.max(...aFrames.map((f) => f.seq));

    // The run keeps going while nobody is attached.
    expect(aFrames.some((f) => f.type === 'done')).toBe(false);

    // --- Client B: RE-ATTACHES from seq 0 (fresh mount) and rehydrates. ---
    const bFrames: RunEvent[] = [];
    const bStream = streamRunEvents('run-A', 'u1', 0, async (ev) => { bFrames.push(ev); });
    await tick(10);
    // History replayed: B sees the meta + the first step that happened before it attached.
    expect(bFrames.map((f) => f.type)).toContain('meta');
    expect(bFrames.filter((f) => f.type === 'agent_step').length).toBeGreaterThanOrEqual(1);

    // Live continuation: release the rest; B receives the new step + report + terminal done.
    g1.resolve();
    await bStream;

    const bTypes = bFrames.map((f) => f.type);
    expect(bTypes.filter((t) => t === 'agent_step')).toHaveLength(2); // FULL history (both steps)
    expect(bTypes).toContain('agent_report');
    expect(bTypes[bTypes.length - 1]).toBe('done');
    const bSeqs = bFrames.map((f) => f.seq);
    expect(bSeqs).toEqual([...bSeqs].sort((a, b) => a - b)); // ordered, no gaps in delivery order
    expect(aLastSeq).toBeGreaterThan(0);
  });

  it('resume with a cursor: re-attaching from the last-seen seq replays ONLY newer events', async () => {
    const g0 = deferred(), g1 = deferred();
    startGatedRun('run-C', [
      nativeTurn('write_file', { path: 'index.html', content: '<html>' }),
      nativeTurn('write_file', { path: 'app.js', content: 'x' }),
      nativeTurn('finish', { report: 'Fertig.' }),
    ], [g0.promise, g1.promise]);

    const aFrames: RunEvent[] = [];
    const aAbort = new AbortController();
    const aStream = streamRunEvents('run-C', 'u1', 0, async (ev) => { aFrames.push(ev); }, { signal: aAbort.signal });
    g0.resolve();
    await tick(20);
    aAbort.abort();
    await aStream;
    const lastSeen = Math.max(...aFrames.map((f) => f.seq));

    // Re-attach from the cursor — no re-delivery of what client A already rendered.
    const bFrames: RunEvent[] = [];
    const bStream = streamRunEvents('run-C', 'u1', lastSeen, async (ev) => { bFrames.push(ev); });
    g1.resolve();
    await bStream;
    expect(bFrames.every((f) => f.seq > lastSeen)).toBe(true);
    expect(bFrames.map((f) => f.type)).toContain('done');
  });

  it('finished-while-away: a re-attach after completion replays the report card + done', async () => {
    const done = deferred();
    startGatedRun('run-B', [
      nativeTurn('write_file', { path: 'index.html', content: '<html>' }),
      nativeTurn('finish', { report: 'Fertig — als Entwurf gesichert.' }),
    ], [], () => { done.resolve(); });

    // Nobody attached — let it finish entirely.
    await done.promise;
    await tick(10);

    // The user returns AFTER it finished. Re-attach replays the whole sequence.
    const frames: RunEvent[] = [];
    await streamRunEvents('run-B', 'u1', 0, async (ev) => { frames.push(ev); });

    const report = frames.find((f) => f.type === 'agent_report');
    expect(report).toBeTruthy();
    expect((report!.payload as { report?: { modelText?: string } }).report?.modelText).toContain('Fertig');
    expect(frames[frames.length - 1]!.type).toBe('done'); // terminal → the stream closes, card renders
  });
});
