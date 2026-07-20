import { describe, it, expect } from 'vitest';
import { setAvailability, reconcileToggle, type Toggleable } from './optimistic-toggle';

const seed = (): Toggleable[] => [
  { id: 'a', available: false },
  { id: 'b', available: true },
];

describe('setAvailability', () => {
  it('sets the target model and leaves others untouched', () => {
    const out = setAvailability(seed(), 'a', true);
    expect(out.find((m) => m.id === 'a')!.available).toBe(true);
    expect(out.find((m) => m.id === 'b')!.available).toBe(true);
  });

  it('is a no-op for an unknown id', () => {
    expect(setAvailability(seed(), 'zzz', true)).toEqual(seed());
  });
});

describe('reconcileToggle (the divergence fix)', () => {
  it('a FAILED toggle reverts to server truth — no divergence', () => {
    const models = seed();
    const original = models.find((m) => m.id === 'a')!.available; // false = server truth
    // optimistic flip on click:
    const optimistic = setAvailability(models, 'a', !original);
    expect(optimistic.find((m) => m.id === 'a')!.available).toBe(true);
    // request fails → reconcile back to the server value:
    const reconciled = reconcileToggle(optimistic, 'a', original);
    expect(reconciled.find((m) => m.id === 'a')!.available).toBe(false);
  });

  it('a SUCCESSFUL toggle keeps the new value (server confirms it)', () => {
    const models = seed();
    const target = !models.find((m) => m.id === 'b')!.available; // false
    const optimistic = setAvailability(models, 'b', target);
    const reconciled = reconcileToggle(optimistic, 'b', target); // server agrees
    expect(reconciled.find((m) => m.id === 'b')!.available).toBe(false);
  });
});
