// WAVE-H · H4 gate — concurrency admission control (the N-6 / N-1 closer).
//
// Proves, deterministically (no model, no DB — run-events mocked), that:
//   • a per-user concurrent cap sheds the (cap+1)-th run for that user with an HONEST
//     verdict (reason 'per_user_limit'), never a throw and never a silent admit;
//   • a global cap sheds beyond the box ceiling (reason 'global_limit');
//   • a flood of N runs never admits MORE than the caps allow, and the peak in-flight
//     (admissionSnapshot) stays at/under the cap — the number BASELINE.md showed unbounded;
//   • a cap of 0 disables the gate (LIVE USERS: the founder can turn it off);
//   • slots free as runs finish, so a shed user gets in on retry (queue, not failure);
//   • after everything drains, in-flight and subscribers return to 0 (no leak).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RunEvent } from './run-events';

// In-memory stand-in for the 0091 event log (same shape the registry test uses).
const logStore: Array<RunEvent & { runId: string; userId: string }> = [];
vi.mock('./run-events', () => ({
  appendRunEvent: vi.fn(async (i: { runId: string; userId: string; seq: number; type: string; payload: Record<string, unknown> }) => {
    logStore.push({ runId: i.runId, userId: i.userId, seq: i.seq, type: i.type as RunEvent['type'], payload: i.payload });
  }),
  loadRunEvents: vi.fn(async (runId: string, userId: string, since = 0) =>
    logStore.filter((e) => e.runId === runId && e.userId === userId && e.seq > since).sort((a, b) => a.seq - b.seq)),
}));

// eslint-disable-next-line import/first
import { startRun, checkAdmission, admissionSnapshot, __resetRunRegistry } from './run-registry';

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

/** A run that stays in-flight until we resolve it — lets us hold slots open on purpose. */
function heldRun(runId: string, userId: string) {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const res = startRun<void>({
    runId, userId, projectId: `p-${userId}`, sessionId: `s-${runId}`, modelSlug: 'goblin/efficient',
    execute: async () => { await gate; },
    onComplete: () => {}, onError: () => {},
  });
  return { res, release };
}

describe('WAVE-H H4 — concurrency admission (N-6 closer)', () => {
  beforeEach(() => {
    logStore.length = 0;
    __resetRunRegistry();
    delete process.env.AGENT_GLOBAL_MAX_CONCURRENT;
    delete process.env.AGENT_MAX_CONCURRENT_PER_USER;
    delete process.env.AGENT_CAPACITY_RETRY_AFTER_SEC;
  });
  afterEach(() => {
    __resetRunRegistry();
    delete process.env.AGENT_GLOBAL_MAX_CONCURRENT;
    delete process.env.AGENT_MAX_CONCURRENT_PER_USER;
    delete process.env.AGENT_CAPACITY_RETRY_AFTER_SEC;
    vi.restoreAllMocks();
  });

  it('per-user cap: the (cap+1)-th concurrent run for one user is shed, honestly', () => {
    process.env.AGENT_MAX_CONCURRENT_PER_USER = '2';
    process.env.AGENT_GLOBAL_MAX_CONCURRENT = '0'; // isolate the per-user cap
    process.env.AGENT_CAPACITY_RETRY_AFTER_SEC = '7';

    const a = heldRun('r1', 'alice');
    const b = heldRun('r2', 'alice');
    expect(a.res.admitted).toBe(true);
    expect(b.res.admitted).toBe(true);

    // Third concurrent run for alice → rejected, honest verdict, NO throw.
    const c = startRun<void>({
      runId: 'r3', userId: 'alice', projectId: 'p', sessionId: 's', modelSlug: 'goblin/efficient',
      execute: async () => {}, onComplete: () => {}, onError: () => {},
    });
    expect(c.admitted).toBe(false);
    if (!c.admitted) {
      expect(c.reason).toBe('per_user_limit');
      expect(c.retryAfterSec).toBe(7);
    }
    // A different user is unaffected by alice's saturation.
    const d = heldRun('r4', 'bob');
    expect(d.res.admitted).toBe(true);

    a.release(); b.release(); d.release();
  });

  it('slot frees on completion → a shed user gets in on retry (queue, not failure)', async () => {
    process.env.AGENT_MAX_CONCURRENT_PER_USER = '1';
    process.env.AGENT_GLOBAL_MAX_CONCURRENT = '0';

    const first = heldRun('r1', 'alice');
    expect(first.res.admitted).toBe(true);
    // Second is shed while the first holds the only slot.
    expect(checkAdmission('alice').admitted).toBe(false);

    // First finishes → its slot frees.
    first.release();
    await tick(10);

    // Retry now succeeds — the run was deferred, not lost.
    const retry = heldRun('r2', 'alice');
    expect(retry.res.admitted).toBe(true);
    retry.release();
  });

  it('global cap: a flood of many users never admits beyond the box ceiling', () => {
    process.env.AGENT_GLOBAL_MAX_CONCURRENT = '5';
    process.env.AGENT_MAX_CONCURRENT_PER_USER = '0'; // isolate the global cap

    const held: Array<{ release: () => void }> = [];
    let admitted = 0;
    let rejectedGlobal = 0;
    // 20 distinct users, one run each — 4× the global ceiling.
    for (let i = 0; i < 20; i++) {
      const r = heldRun(`run-${i}`, `user-${i}`);
      if (r.res.admitted) { admitted += 1; held.push(r); }
      else if (r.res.admitted === false && r.res.reason === 'global_limit') rejectedGlobal += 1;
    }
    expect(admitted).toBe(5);
    expect(rejectedGlobal).toBe(15);
    // The number BASELINE.md showed unbounded (peakInFlight=N) is now bounded to the cap.
    expect(admissionSnapshot().inFlight).toBe(5);
    for (const h of held) h.release();
  });

  it('cap = 0 disables the gate entirely (LIVE USERS founder knob)', () => {
    process.env.AGENT_GLOBAL_MAX_CONCURRENT = '0';
    process.env.AGENT_MAX_CONCURRENT_PER_USER = '0';
    const held: Array<{ release: () => void }> = [];
    for (let i = 0; i < 30; i++) {
      const r = heldRun(`run-${i}`, 'alice'); // same user, would blow any per-user cap
      expect(r.res.admitted).toBe(true);
      held.push(r);
    }
    expect(admissionSnapshot().inFlight).toBe(30);
    for (const h of held) h.release();
  });

  it('flood drains cleanly: no leaked subscribers, in-flight back to 0', async () => {
    process.env.AGENT_GLOBAL_MAX_CONCURRENT = '8';
    process.env.AGENT_MAX_CONCURRENT_PER_USER = '2';

    const releases: Array<() => void> = [];
    let admitted = 0;
    let rejected = 0;
    for (let i = 0; i < 40; i++) {
      const r = heldRun(`run-${i}`, `user-${i % 6}`);
      if (r.res.admitted) { admitted += 1; releases.push(r.release); }
      else rejected += 1;
    }
    // Never more than the global ceiling admitted at once.
    expect(admitted).toBeLessThanOrEqual(8);
    expect(rejected).toBe(40 - admitted);
    expect(admissionSnapshot().inFlight).toBeLessThanOrEqual(8);

    for (const rel of releases) rel();
    await tick(20);
    const snap = admissionSnapshot();
    expect(snap.inFlight).toBe(0);
    expect(snap.totalSubscribers).toBe(0);
  });
});
