// K4 (Wave-K, Layer 4) gate — each behavioral flag fires on its fixture, and does NOT
// fire on the honest baseline. Flags INFORM only; these tests assert the decision + emit,
// never any punitive action (there is none — account actions stay founder decisions).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  evalPublishVelocity, evalContentFanout, evalRepeatedBlocks, hashContent,
  collectPublishSignals, NEW_ACCOUNT_WINDOW_MS,
} from './signals';
import * as platformEvents from '../../lib/platform-events';

describe('K4 evalPublishVelocity — new-account publish velocity', () => {
  it('FIRES when a fresh account publishes ≥ threshold in the first hour', () => {
    const sig = evalPublishVelocity(5 * 60_000, 5); // 5 min old, 5 publishes
    expect(sig?.kind).toBe('publish_velocity');
    expect(sig?.detail.publishes).toBe(5);
  });
  it('does NOT fire for an established account (past the window)', () => {
    expect(evalPublishVelocity(NEW_ACCOUNT_WINDOW_MS + 1, 20)).toBeNull();
  });
  it('does NOT fire below threshold (honest new user)', () => {
    expect(evalPublishVelocity(60_000, 2)).toBeNull();
  });
  it('does NOT fire when account age is unknown', () => {
    expect(evalPublishVelocity(null, 99)).toBeNull();
  });
});

describe('K4 evalContentFanout — near-identical content across projects', () => {
  const hash = hashContent(['<html>phish</html>']);
  it('FIRES when the same content hash spans ≥ threshold projects', () => {
    const prior = [
      { projectId: 'a', hash }, { projectId: 'b', hash }, // +1 current = 3 distinct
    ];
    const sig = evalContentFanout(hash, prior);
    expect(sig?.kind).toBe('content_fanout');
    expect(sig?.detail.distinct_projects).toBe(3);
  });
  it('does NOT fire when hashes differ (distinct honest projects)', () => {
    const prior = [{ projectId: 'a', hash: hashContent(['other']) }];
    expect(evalContentFanout(hash, prior)).toBeNull();
  });
  it('counts distinct projects only (same project re-publishing is not fan-out)', () => {
    const prior = [{ projectId: 'a', hash }, { projectId: 'a', hash }];
    expect(evalContentFanout(hash, prior)).toBeNull(); // 1 other + current = 2 < 3
  });
});

describe('K4 evalRepeatedBlocks — probing behavior', () => {
  it('FIRES at/above the block threshold', () => {
    expect(evalRepeatedBlocks(3)?.kind).toBe('repeated_policy_blocks');
  });
  it('does NOT fire below threshold (a single honest mistake)', () => {
    expect(evalRepeatedBlocks(1)).toBeNull();
  });
});

describe('K4 collectPublishSignals — emits abuse_signal on fixtures, best-effort', () => {
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { spy = vi.spyOn(platformEvents, 'trackEvent').mockImplementation(() => {}); });
  afterEach(() => { spy.mockRestore(); });

  it('emits publish_velocity + content_fanout for an abusive fixture', async () => {
    const hash = hashContent(['<html>kit</html>']);
    await collectPublishSignals(
      {
        accountAgeMs: async () => 60_000, // 1 min old
        publishesInWindow: async () => 6, // above default threshold 5
        priorContentHashes: async () => [{ projectId: 'a', hash }, { projectId: 'b', hash }],
      },
      'u1', 'p-now', hash,
    );
    const kinds = spy.mock.calls.map((c) => (c[0] as { meta?: { signal?: string } }).meta?.signal);
    expect(kinds).toContain('publish_velocity');
    expect(kinds).toContain('content_fanout');
  });

  it('emits NOTHING for an honest established user', async () => {
    await collectPublishSignals(
      {
        accountAgeMs: async () => NEW_ACCOUNT_WINDOW_MS * 10,
        publishesInWindow: async () => 1,
        priorContentHashes: async () => [],
      },
      'u2', 'p2', hashContent(['unique']),
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('degrades silently when a dependency throws (never breaks the publish)', async () => {
    await expect(collectPublishSignals(
      {
        accountAgeMs: async () => { throw new Error('db down'); },
        publishesInWindow: async () => { throw new Error('db down'); },
        priorContentHashes: async () => { throw new Error('db down'); },
      },
      'u3', 'p3', 'deadbeef',
    )).resolves.toBeUndefined();
  });
});
