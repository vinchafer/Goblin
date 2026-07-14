// FW4 U3 (F-22): the first-token watchdog must give Goblin Forge a Forge-appropriate
// budget. The flat 45s cut off large Forge prompts ("Das Modell hat nicht rechtzeitig
// geantwortet"). Two layers: the pure deadline rule + the guard honouring it (a slow
// first token that WOULD have tripped 45s survives on Forge, still trips on Swift).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  firstTokenDeadlineMs,
  forgeFirstTokenTimeoutMs,
  FIRST_TOKEN_TIMEOUT_MS,
  streamCompletionGuarded,
} from './model-router';

describe('F-22 first-token deadline rule', () => {
  beforeEach(() => { delete process.env.FORGE_FIRST_TOKEN_TIMEOUT_MS; });

  it('Forge widens to its budget; other models keep the base', () => {
    expect(firstTokenDeadlineMs(FIRST_TOKEN_TIMEOUT_MS, 'goblin/premium')).toBe(90_000);
    expect(firstTokenDeadlineMs(FIRST_TOKEN_TIMEOUT_MS, 'goblin/efficient')).toBe(45_000);
    expect(firstTokenDeadlineMs(FIRST_TOKEN_TIMEOUT_MS, undefined)).toBe(45_000);
    expect(firstTokenDeadlineMs(FIRST_TOKEN_TIMEOUT_MS, null)).toBe(45_000);
  });

  it('a larger caller base always wins (widen-only, never narrow)', () => {
    expect(firstTokenDeadlineMs(120_000, 'goblin/premium')).toBe(120_000);
    expect(firstTokenDeadlineMs(30_000, 'goblin/premium')).toBe(90_000);
  });

  it('the Forge budget is env-overridable', () => {
    process.env.FORGE_FIRST_TOKEN_TIMEOUT_MS = '150000';
    expect(forgeFirstTokenTimeoutMs()).toBe(150_000);
    expect(firstTokenDeadlineMs(FIRST_TOKEN_TIMEOUT_MS, 'goblin/premium')).toBe(150_000);
    process.env.FORGE_FIRST_TOKEN_TIMEOUT_MS = 'garbage';
    expect(forgeFirstTokenTimeoutMs()).toBe(90_000); // invalid → default
  });
});

// A scripted source: yields `meta` immediately, then the first `delta` after
// `firstTokenDelayMs` (simulated via fake timers), then `done`.
function scriptedSource(model: string, firstTokenDelayMs: number) {
  return async function* () {
    yield JSON.stringify({ type: 'meta', model, source_tier: 'goblin_hosted' });
    await new Promise((r) => setTimeout(r, firstTokenDelayMs));
    yield JSON.stringify({ type: 'delta', content: 'Hallo' });
    yield JSON.stringify({ type: 'done' });
  };
}

async function collect(gen: AsyncGenerator<string, void, unknown>): Promise<Array<{ type?: string; message?: string }>> {
  const out: Array<{ type?: string; message?: string }> = [];
  for await (const t of gen) out.push(JSON.parse(t));
  return out;
}

describe('F-22 guard timing: Forge survives a slow first token, Swift still trips', () => {
  beforeEach(() => { vi.useFakeTimers(); delete process.env.FORGE_FIRST_TOKEN_TIMEOUT_MS; });
  afterEach(() => { vi.useRealTimers(); });

  it('Forge: first token at 60s (>45s base, <90s Forge budget) → streams, no timeout', async () => {
    const base = { userId: 'u1', projectId: null, message: 'Baue 5 Unterseiten', chatHistory: [], modelPreference: 'goblin/premium' } as never;
    const p = collect(streamCompletionGuarded(base, scriptedSource('goblin/premium', 60_000) as never));
    await vi.advanceTimersByTimeAsync(61_000);
    const events = await p;
    expect(events.some((e) => e.type === 'delta')).toBe(true);
    expect(events.some((e) => e.type === 'done')).toBe(true);
    expect(events.some((e) => e.type === 'error')).toBe(false);
  });

  it('Swift: first token at 60s (>45s base) → honest timeout error', async () => {
    const base = { userId: 'u1', projectId: null, message: 'x', chatHistory: [], modelPreference: 'goblin/efficient' } as never;
    const p = collect(streamCompletionGuarded(base, scriptedSource('goblin/efficient', 60_000) as never));
    await vi.advanceTimersByTimeAsync(61_000);
    const events = await p;
    const err = events.find((e) => e.type === 'error');
    expect(err).toBeTruthy();
    expect(err!.message).toMatch(/nicht rechtzeitig/);
  });
});
