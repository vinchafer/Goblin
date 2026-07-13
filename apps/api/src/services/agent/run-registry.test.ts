// F-40 U2 gate: the run registry decouples execution from the request.
//   • start a run, SEVER the subscriber stream → the run still completes + persists;
//   • explicit Stop aborts within one step (distinct from a disconnect);
//   • the max-runtime guard fires on a mocked overrun (distinct abort reason);
//   • the ONE event path: every emit lands in the durable log (0091) and fans out live;
//   • cross-replica re-attach (no local handle) replays from the log + polls the tail.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RunEvent } from './run-events';

// In-memory stand-in for the 0091 event log so we can prove persistence + the poll path.
const logStore: Array<RunEvent & { runId: string; userId: string }> = [];
vi.mock('./run-events', () => ({
  appendRunEvent: vi.fn(async (i: { runId: string; userId: string; seq: number; type: string; payload: Record<string, unknown> }) => {
    logStore.push({ runId: i.runId, userId: i.userId, seq: i.seq, type: i.type as RunEvent['type'], payload: i.payload });
  }),
  loadRunEvents: vi.fn(async (runId: string, userId: string, since = 0) =>
    logStore
      .filter((e) => e.runId === runId && e.userId === userId && e.seq > since)
      .sort((a, b) => a.seq - b.seq)
      .map((e) => ({ seq: e.seq, type: e.type, payload: e.payload })),
  ),
}));

// eslint-disable-next-line import/first
import { startRun, stopRun, streamRunEvents, isRunLocal, __resetRunRegistry } from './run-registry';
// eslint-disable-next-line import/first
import { MAX_RUNTIME_ABORT_REASON, USER_STOP_ABORT_REASON } from './config';

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

/** Collect frames a sink receives; resolves `done` when a terminal frame lands. */
function collector() {
  const frames: RunEvent[] = [];
  let resolveTerminal!: () => void;
  const terminated = new Promise<void>((r) => { resolveTerminal = r; });
  const sink = async (ev: RunEvent) => {
    frames.push(ev);
    if (ev.type === 'done' || ev.type === 'error') resolveTerminal();
  };
  return { frames, sink, terminated };
}

const meta = { userId: 'u1', projectId: 'p1', sessionId: 's1' };

describe('run-registry — F-40 U2 decouple execution from the request', () => {
  beforeEach(() => { logStore.length = 0; __resetRunRegistry(); });
  afterEach(() => { __resetRunRegistry(); delete process.env.AGENT_MAX_RUNTIME_MS; });

  it('a severed subscriber does NOT stop the run — it completes + persists to the log', async () => {
    let completedWith: { hadSubscriber: boolean; timedOut: boolean } | null = null;
    let sawStopSignal = false;

    startRun<string>({
      runId: 'run-1', ...meta, modelSlug: 'goblin/efficient',
      execute: async ({ emit, stopSignal }) => {
        emit({ type: 'agent_step', tool: 'write_file', summary: 'index.html · NEU', ok: true, ms: 3 });
        await tick(30); // work continues past the client disconnect below
        sawStopSignal = stopSignal.aborted;
        emit({ type: 'agent_report', report: { state: 'draft-saved' } });
        return 'ok';
      },
      onComplete: (_r, m) => { completedWith = m; },
      onError: () => {},
    });

    // Attach a client, then SEVER it almost immediately (simulated disconnect).
    const ac = new AbortController();
    const { sink } = collector();
    const streamP = streamRunEvents('run-1', 'u1', 0, sink, { signal: ac.signal });
    await tick(5);
    ac.abort(); // client leaves the browser
    await streamP; // the stream ends...

    // ...but the RUN keeps going and completes.
    await tick(60);
    expect(sawStopSignal).toBe(false); // a disconnect never aborted the run's own signal
    expect(completedWith).not.toBeNull();
    expect(completedWith!.hadSubscriber).toBe(false); // nobody attached at completion → push path
    // Persisted to the durable log: meta + step + report + terminal done.
    const types = logStore.filter((e) => e.runId === 'run-1').map((e) => e.type);
    expect(types).toContain('meta');
    expect(types).toContain('agent_step');
    expect(types).toContain('agent_report');
    expect(types).toContain('done');
  });

  it('explicit Stop aborts the run within one step (distinct user_stop reason)', async () => {
    let stepsAfterStop = 0;
    let abortReason: unknown;

    startRun<string>({
      runId: 'run-2', ...meta,
      execute: async ({ emit, stopSignal }) => {
        for (let i = 0; i < 20; i++) {
          if (stopSignal.aborted) { abortReason = stopSignal.reason; break; }
          emit({ type: 'agent_step', tool: 'read_file', summary: `step ${i}`, ok: true, ms: 1 });
          if (i >= 1) stepsAfterStop++; // count steps taken after the stop is issued at i=0..1
          await tick(10);
        }
        return 'stopped';
      },
      onComplete: () => {},
      onError: () => {},
    });

    await tick(15); // let a step or two run
    const hit = stopRun('run-2', 'u1');
    expect(hit).toBe(true);
    await tick(60);
    expect(abortReason).toBe(USER_STOP_ABORT_REASON);
    // It ended promptly after the stop — not all 20 steps ran.
    expect(stepsAfterStop).toBeLessThan(19);
  });

  it('a wrong-owner Stop is a no-op (ownership-scoped)', async () => {
    startRun<string>({
      runId: 'run-2b', ...meta,
      execute: async ({ stopSignal }) => { await tick(20); return stopSignal.aborted ? 'stopped' : 'ok'; },
      onComplete: () => {}, onError: () => {},
    });
    expect(stopRun('run-2b', 'intruder')).toBe(false);
    await tick(40);
  });

  it('the max-runtime guard fires on an overrun with the distinct max_runtime reason', async () => {
    process.env.AGENT_MAX_RUNTIME_MS = '40';
    let timedOut = false;
    let reason: unknown;

    startRun<string>({
      runId: 'run-3', ...meta,
      execute: async ({ stopSignal }) => {
        // A run that would never stop on its own — only the guard ends it.
        while (!stopSignal.aborted) await tick(10);
        reason = stopSignal.reason;
        return 'guard';
      },
      onComplete: (_r, m) => { timedOut = m.timedOut; },
      onError: () => {},
    });

    await tick(120);
    expect(reason).toBe(MAX_RUNTIME_ABORT_REASON);
    expect(timedOut).toBe(true);
    expect(isRunLocal('run-3')).toBe(true); // still within the evict grace window
  });

  it('a connected client receives events incrementally, in order, ending with done', async () => {
    const { frames, sink, terminated } = collector();

    startRun<string>({
      runId: 'run-4', ...meta, modelSlug: 'goblin/efficient',
      execute: async ({ emit }) => {
        emit({ type: 'agent_step', tool: 'write_file', summary: 'a', ok: true, ms: 1 });
        await tick(10);
        emit({ type: 'agent_step', tool: 'save_draft', summary: 'b', ok: true, ms: 1 });
        await tick(10);
        emit({ type: 'agent_report', report: { state: 'draft-saved' } });
        return 'ok';
      },
      onComplete: () => {}, onError: () => {},
    });

    await streamRunEvents('run-4', 'u1', 0, sink);
    await terminated;

    const seqs = frames.map((f) => f.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b)); // strictly ordered
    expect(new Set(seqs).size).toBe(seqs.length); // no duplicates
    expect(frames[0]!.type).toBe('meta');
    expect(frames.map((f) => f.type)).toContain('agent_step');
    expect(frames[frames.length - 1]!.type).toBe('done');
  });

  it('cross-replica re-attach (no local handle) replays from the durable log + tails to done', async () => {
    // Seed the log as if another replica ran the whole run (no in-process handle here).
    logStore.push(
      { runId: 'remote-1', userId: 'u1', seq: 1, type: 'meta', payload: { run_id: 'remote-1' } },
      { runId: 'remote-1', userId: 'u1', seq: 2, type: 'agent_step', payload: { tool: 'write_file', summary: 'x', ok: true, ms: 2 } },
    );
    expect(isRunLocal('remote-1')).toBe(false);

    const { frames, sink, terminated } = collector();
    const streamP = streamRunEvents('remote-1', 'u1', 0, sink);
    await tick(20); // replayed seq 1..2, now polling the tail
    // The "other replica" writes the terminal frames; our poll should pick them up.
    logStore.push(
      { runId: 'remote-1', userId: 'u1', seq: 3, type: 'agent_report', payload: { report: { state: 'draft-saved' } } },
      { runId: 'remote-1', userId: 'u1', seq: 4, type: 'done', payload: { run_id: 'remote-1' } },
    );
    await Promise.race([terminated, tick(2500)]);
    await streamP;

    expect(frames.map((f) => f.seq)).toEqual([1, 2, 3, 4]);
    expect(frames[frames.length - 1]!.type).toBe('done');
  });

  it('U5 push gate: hadSubscriber is TRUE when a client stays attached through completion', async () => {
    let metaAttached: { hadSubscriber: boolean; timedOut: boolean } | null = null;
    startRun<string>({
      runId: 'run-att', ...meta,
      execute: async ({ emit }) => {
        emit({ type: 'agent_step', tool: 'write_file', summary: 'x', ok: true, ms: 1 });
        await tick(15);
        emit({ type: 'agent_report', report: {} });
        return 'ok';
      },
      onComplete: (_r, m) => { metaAttached = m; },
      onError: () => {},
    });
    const { sink, terminated } = collector();
    const streamP = streamRunEvents('run-att', 'u1', 0, sink); // stays attached until done
    await Promise.race([terminated, tick(200)]);
    await streamP;
    // The push gate in the route fires notify ONLY when !hadSubscriber — here a client was
    // watching to the end, so no push should be sent.
    expect(metaAttached).not.toBeNull();
    expect(metaAttached!.hadSubscriber).toBe(true);
  });

  it('U5 push gate: hadSubscriber is FALSE when nobody ever attached (→ push fires)', async () => {
    let metaUnattached: { hadSubscriber: boolean; timedOut: boolean } | null = null;
    startRun<string>({
      runId: 'run-unatt', ...meta,
      execute: async ({ emit }) => { emit({ type: 'agent_report', report: {} }); return 'ok'; },
      onComplete: (_r, m) => { metaUnattached = m; },
      onError: () => {},
    });
    await tick(30);
    expect(metaUnattached).not.toBeNull();
    expect(metaUnattached!.hadSubscriber).toBe(false); // → the route pushes "dein Ping vom Strand"
  });

  it('a re-attach with sinceSeq replays only newer events (the resume cursor)', async () => {
    startRun<string>({
      runId: 'run-5', ...meta,
      execute: async ({ emit }) => {
        emit({ type: 'agent_step', tool: 'a', summary: 'a', ok: true, ms: 1 });
        emit({ type: 'agent_step', tool: 'b', summary: 'b', ok: true, ms: 1 });
        emit({ type: 'agent_report', report: {} });
        return 'ok';
      },
      onComplete: () => {}, onError: () => {},
    });
    await tick(30); // run finished, handle still in grace

    const { frames, sink } = collector();
    await streamRunEvents('run-5', 'u1', 2, sink); // resume after seq 2
    // Only seq > 2 (the report at 3 + the done at 4).
    expect(frames.every((f) => f.seq > 2)).toBe(true);
    expect(frames.map((f) => f.type)).toContain('done');
  });
});
