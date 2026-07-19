// WAVE-H · H4 — the client capacity helpers: honest copy (DE+EN, no fabricated state),
// capacity detection, and the bounded-wait clamp.

import { describe, it, expect } from 'vitest';
import {
  isAtCapacity, capacityWaitMs, capacityWaitingCopy, capacityGaveUpCopy, AGENT_AT_CAPACITY,
} from './agent-capacity';

describe('WAVE-H H4 client capacity helpers', () => {
  it('recognizes an agent_at_capacity shed and ignores everything else', () => {
    expect(isAtCapacity({ code: AGENT_AT_CAPACITY })).toBe(true);
    expect(isAtCapacity({ code: 'agent_not_eligible' })).toBe(false);
    expect(isAtCapacity(new Error('boom'))).toBe(false);
    expect(isAtCapacity(null)).toBe(false);
    expect(isAtCapacity(undefined)).toBe(false);
  });

  it('clamps the retry wait: default when absent, capped at 30s', () => {
    expect(capacityWaitMs(undefined)).toBe(8000);
    expect(capacityWaitMs(0)).toBe(8000);
    expect(capacityWaitMs(5)).toBe(5000);
    expect(capacityWaitMs(999)).toBe(30000);
  });

  it('waiting copy is localized and truthful (defer, not fail) for both reasons', () => {
    // global cap → "auf Anschlag / at capacity", never a claim the run failed.
    expect(capacityWaitingCopy('de', 'global_limit')).toContain('auf Anschlag');
    expect(capacityWaitingCopy('en', 'global_limit')).toContain('at capacity');
    // per-user cap → "you already have a run going".
    expect(capacityWaitingCopy('de', 'per_user_limit')).toContain('schon einen Lauf');
    expect(capacityWaitingCopy('en', 'per_user_limit')).toContain('already have a run');
    // No English leak in the DE strings and vice-versa (feeling invariant).
    expect(capacityWaitingCopy('de', 'global_limit')).not.toMatch(/capacity|your run/i);
    expect(capacityWaitingCopy('en', 'global_limit')).not.toMatch(/Anschlag|dein Lauf/);
  });

  it('give-up copy is an honest "still busy, try again", never a fake success/failure', () => {
    expect(capacityGaveUpCopy('de')).toContain('noch ausgelastet');
    expect(capacityGaveUpCopy('en')).toContain('still busy');
    // Never claims the run ran or failed — it asks the user to retry.
    expect(capacityGaveUpCopy('de')).not.toMatch(/fehlgeschlagen|fertig|erledigt/i);
  });
});
