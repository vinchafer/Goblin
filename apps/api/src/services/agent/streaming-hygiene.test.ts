// WAVE-H · H3 gate — SSE / connection hygiene under concurrency (closes ticket #15:
// "SSE socket stays open server-side after `done`"). State-first: F-40 rebuilt run
// streaming, so this MEASURES the current behavior rather than assuming the pre-F-40 finding.
//
// The server-side leak canary is admissionSnapshot().totalSubscribers — the sum of attached
// SSE sinks across every live run. #15 is CLOSED iff that returns to 0 after a stream ends,
// by ANY exit: a terminal `done`/`error` frame, or a client disconnect. Proven here for:
//   • normal completion — the stream resolves on the terminal frame and detaches;
//   • client disconnect mid-run — the subscriber detaches promptly AND the run keeps going
//     (F-40: disconnect ≠ stop), so no zombie subscriber and no lost run;
//   • N concurrent streams — all resolve, subscribers back to 0, handles evict;
//   • one slow client can't starve the others (per-stream serialized delivery).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RunEvent } from './run-events';

const logStore: Array<RunEvent & { runId: string; userId: string }> = [];
vi.mock('./run-events', () => ({
  appendRunEvent: vi.fn(async (i: { runId: string; userId: string; seq: number; type: string; payload: Record<string, unknown> }) => {
    logStore.push({ runId: i.runId, userId: i.userId, seq: i.seq, type: i.type as RunEvent['type'], payload: i.payload });
  }),
  loadRunEvents: vi.fn(async (runId: string, userId: string, since = 0) =>
    logStore.filter((e) => e.runId === runId && e.userId === userId && e.seq > since).sort((a, b) => a.seq - b.seq)),
}));

// eslint-disable-next-line import/first
import { startRun, streamRunEvents, admissionSnapshot, __resetRunRegistry } from './run-registry';

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

/** A run whose completion we control, so we can attach streams while it is live. */
function heldRun(runId: string, userId: string) {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  startRun<void>({
    runId, userId, projectId: `p-${userId}`, sessionId: `s-${runId}`, modelSlug: 'goblin/efficient',
    execute: async ({ emit }) => { emit({ type: 'agent_narration', text: 'x' }); await gate; },
    onComplete: () => {}, onError: () => {},
  });
  return { release };
}

describe('WAVE-H H3 — SSE hygiene (#15 closer)', () => {
  beforeEach(() => {
    logStore.length = 0;
    __resetRunRegistry();
    // Disable admission caps so hygiene is measured, not admission.
    process.env.AGENT_GLOBAL_MAX_CONCURRENT = '0';
    process.env.AGENT_MAX_CONCURRENT_PER_USER = '0';
  });
  afterEach(() => {
    __resetRunRegistry();
    delete process.env.AGENT_GLOBAL_MAX_CONCURRENT;
    delete process.env.AGENT_MAX_CONCURRENT_PER_USER;
    vi.restoreAllMocks();
  });

  it('normal completion: the stream resolves on `done` and detaches (0 leaked subscribers)', async () => {
    const { release } = heldRun('r1', 'alice');
    const frames: RunEvent[] = [];
    const streamP = streamRunEvents('r1', 'alice', 0, (ev) => { frames.push(ev); });
    await tick();
    // While live + attached, exactly one subscriber is registered.
    expect(admissionSnapshot().totalSubscribers).toBe(1);

    release();
    await streamP; // resolves ONLY when the stream saw the terminal frame and exited

    expect(frames.some((f) => f.type === 'done')).toBe(true);
    // #15: the server-side subscriber is gone the instant the stream ended.
    expect(admissionSnapshot().totalSubscribers).toBe(0);
  });

  it('client disconnect mid-run: subscriber detaches promptly AND the run keeps going', async () => {
    const { release } = heldRun('r2', 'bob');
    const ctrl = new AbortController();
    const frames: RunEvent[] = [];
    const streamP = streamRunEvents('r2', 'bob', 0, (ev) => { frames.push(ev); }, { signal: ctrl.signal });
    await tick();
    expect(admissionSnapshot().totalSubscribers).toBe(1);

    // Simulate the client closing the tab: abort the request signal.
    ctrl.abort();
    await streamP; // must resolve on disconnect (not hang)
    expect(admissionSnapshot().totalSubscribers).toBe(0);

    // F-40 invariant: the RUN is still live (disconnect ≠ stop) — no subscriber, but running.
    expect(admissionSnapshot().inFlight).toBe(1);
    release();
    await tick(10);
    expect(admissionSnapshot().inFlight).toBe(0);
  });

  it('N concurrent streams all resolve and return subscribers to 0', async () => {
    const N = 25;
    const releases: Array<() => void> = [];
    const streams: Array<Promise<void>> = [];
    for (let i = 0; i < N; i++) {
      const { release } = heldRun(`run-${i}`, `user-${i}`);
      releases.push(release);
      streams.push(streamRunEvents(`run-${i}`, `user-${i}`, 0, () => {}));
    }
    await tick();
    expect(admissionSnapshot().totalSubscribers).toBe(N);

    releases.forEach((r) => r());
    await Promise.all(streams);
    expect(admissionSnapshot().totalSubscribers).toBe(0);
  });

  it('one slow client cannot starve the others (per-stream serialized delivery)', async () => {
    const fast = heldRun('fast', 'alice');
    const slow = heldRun('slow', 'bob');

    let fastDone = false;
    const fastP = streamRunEvents('fast', 'alice', 0, () => {}).then(() => { fastDone = true; });
    // The slow sink stalls on every frame — but only ITS OWN stream, not the fast one.
    const slowP = streamRunEvents('slow', 'bob', 0, async () => { await tick(40); });

    await tick();
    fast.release();
    await fastP;
    // The fast stream completed while the slow client was still stalling — no head-of-line block.
    expect(fastDone).toBe(true);
    expect(admissionSnapshot().totalSubscribers).toBe(1); // only the slow one remains

    slow.release();
    await slowP;
    expect(admissionSnapshot().totalSubscribers).toBe(0);
  });
});
