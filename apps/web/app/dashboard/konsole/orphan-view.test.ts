// AKT 2 · X1-S — the one rule this card exists to keep: null is not zero.
//
// Every test here is a variation on that. The interesting cases are not the happy
// ones; they are the ones where a sloppy `!list?.length` would have produced a
// green pill for an answer that says nothing.

import { describe, it, expect } from 'vitest';
import { findingOf, verdictOf, findingClass, verdictClass, type OrphanReportBody } from './orphan-view';

function report(over: Partial<OrphanReportBody> = {}): OrphanReportBody {
  return {
    orphans: [],
    routeOrphans: [],
    routesOnDeletedApps: [],
    knownApps: 1,
    prefixesInR2: 1,
    routesInKv: 1,
    notes: [],
    timestamp: '2026-08-13T00:00:00.000Z',
    ...over,
  };
}

describe('findingOf — three states, and null is its own', () => {
  it('reads null as unknown, never as clean', () => {
    expect(findingOf(null)).toEqual({ kind: 'unknown' });
    expect(findingClass(findingOf(null))).toBe('unknown');
  });

  it('reads a missing field as unknown too', () => {
    // An older API that never sends the field must not read as a swept-clean plane.
    expect(findingOf(undefined)).toEqual({ kind: 'unknown' });
  });

  it('reads an empty list as a real, earned zero', () => {
    expect(findingOf([])).toEqual({ kind: 'clean' });
    expect(findingClass(findingOf([]))).toBe('ok');
  });

  it('carries the names through when something was found', () => {
    expect(findingOf(['a', 'b'])).toEqual({ kind: 'found', names: ['a', 'b'] });
    expect(findingClass(findingOf(['a']))).toBe('bad');
  });
});

describe('verdictOf', () => {
  it('is clean only when all three lists really came back empty', () => {
    expect(verdictOf(report())).toBe('clean');
    expect(verdictClass('clean')).toBe('ok');
  });

  it('is unknown when nothing at all could be checked', () => {
    expect(verdictOf(report({ orphans: null, routeOrphans: null, routesOnDeletedApps: null }))).toBe('unknown');
    expect(verdictClass('unknown')).toBe('unknown');
  });

  it('is incomplete when one half answered and the other did not', () => {
    // R2 readable, KV not: the half that matters most is the missing one.
    expect(verdictOf(report({ routeOrphans: null, routesOnDeletedApps: null }))).toBe('incomplete');
    // And the other way around.
    expect(verdictOf(report({ orphans: null }))).toBe('incomplete');
    expect(verdictClass('incomplete')).toBe('warn');
  });

  it('never turns a null into a clean sweep', () => {
    for (const key of ['orphans', 'routeOrphans', 'routesOnDeletedApps'] as const) {
      expect(verdictOf(report({ [key]: null }))).not.toBe('clean');
    }
  });

  it('lets a real finding outrank an incomplete check', () => {
    // KV found a publicly reachable orphan AND R2 was unreadable. The finding is
    // actionable now; "incomplete" would bury it.
    expect(verdictOf(report({ routeOrphans: ['phish'], orphans: null }))).toBe('found');
    expect(verdictClass('found')).toBe('bad');
  });

  it('flags a route on a deleted app on its own', () => {
    expect(verdictOf(report({ routesOnDeletedApps: ['halb-abgebaut'] }))).toBe('found');
  });
});
