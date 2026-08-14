// AKT 2 · PHASE 5 · U5.4 — the console's judgements about what it received.
//
// Two properties this file exists to keep, both of which a JSX-only implementation
// would leave untested:
//   • no path from an absent measurement to a green pill;
//   • worst-first puts UNKNOWN above `degraded`, because a blind instrument is how
//     a real outage stays unnoticed.

import { describe, it, expect } from 'vitest';
import {
  STATE_SEVERITY,
  anythingNotFine,
  measuredStamp,
  stateClass,
  worstFirst,
  type ChecksBody,
  type CheckState,
  type SubjectStateView,
} from './checks-view';

function subject(over: Partial<SubjectStateView> = {}): SubjectStateView {
  return {
    subjectKey: 'entry',
    state: 'healthy',
    reason: 'all_ok',
    measuredAt: '2026-08-14T12:00:00.000Z',
    lastOutcome: 'ok',
    samples: 2,
    ...over,
  };
}

function body(over: Partial<ChecksBody> = {}): ChecksBody {
  return { available: true, registryAvailable: true, checksAvailable: true, rows: [], platform: [], ...over };
}

describe('stateClass — UNKNOWN is never green and never red', () => {
  it('maps the four states to the console’s four pills', () => {
    expect(stateClass('healthy')).toBe('ok');
    expect(stateClass('degraded')).toBe('warn');
    expect(stateClass('down')).toBe('bad');
    expect(stateClass('unknown')).toBe('unknown');
  });

  it('has no state at all that produces "ok" other than healthy', () => {
    const states: CheckState[] = ['healthy', 'degraded', 'down', 'unknown'];
    expect(states.filter((s) => stateClass(s) === 'ok')).toEqual(['healthy']);
  });
});

describe('worst-first ordering', () => {
  it('ranks down > unknown > degraded > healthy', () => {
    // Pinned rather than implied: this is an operational judgement, and the
    // surprising half of it (unknown above degraded) is the half worth defending.
    expect(STATE_SEVERITY.down).toBeLessThan(STATE_SEVERITY.unknown);
    expect(STATE_SEVERITY.unknown).toBeLessThan(STATE_SEVERITY.degraded);
    expect(STATE_SEVERITY.degraded).toBeLessThan(STATE_SEVERITY.healthy);
  });

  it('sorts a fleet worst-first and breaks ties by name', () => {
    const rows = [
      { appName: 'gut', entry: subject() },
      { appName: 'blind', entry: subject({ state: 'unknown', reason: 'stale' }) },
      { appName: 'kaputt', entry: subject({ state: 'down', reason: 'sustained_failure' }) },
      { appName: 'auch-gut', entry: subject() },
      { appName: 'wackelt', entry: subject({ state: 'degraded', reason: 'mixed' }) },
    ];
    expect(worstFirst(rows).map((r) => r.appName)).toEqual(['kaputt', 'blind', 'wackelt', 'auch-gut', 'gut']);
  });

  it('does not mutate the array it was given', () => {
    const rows = [
      { appName: 'gut', entry: subject() },
      { appName: 'kaputt', entry: subject({ state: 'down', reason: 'sustained_failure' }) },
    ];
    worstFirst(rows);
    expect(rows[0]?.appName).toBe('gut');
  });
});

describe('anythingNotFine — blindness counts as not fine', () => {
  it('is false only when everything measured is healthy', () => {
    expect(
      anythingNotFine(body({ rows: [{ appId: 'a', appName: 'x', url: '', registryStatus: 'active', entry: subject(), formStore: null }], platform: [subject({ subjectKey: 'web' })] })),
    ).toBe(false);
  });

  it('is true when a subject is unknown', () => {
    expect(anythingNotFine(body({ platform: [subject({ subjectKey: 'web', state: 'unknown', reason: 'never_checked', measuredAt: null })] }))).toBe(true);
  });

  it('is true when the store could not be read at all', () => {
    expect(anythingNotFine(body({ available: false }))).toBe(true);
    // `null` — we could not even ask — is also not fine, and is not the same as false.
    expect(anythingNotFine(body({ available: null }))).toBe(true);
  });

  it('is true when only a nested form store is unhealthy', () => {
    expect(
      anythingNotFine(
        body({
          rows: [
            {
              appId: 'a',
              appName: 'x',
              url: '',
              registryStatus: 'active',
              entry: subject(),
              formStore: subject({ subjectKey: 'form_store', state: 'down', reason: 'sustained_failure' }),
            },
          ],
        }),
      ),
    ).toBe(true);
  });
});

describe('measuredStamp', () => {
  it('returns null rather than a placeholder, so a caller must decide what to say', () => {
    // A helper that quietly returned a dash would let a caller print a state
    // beside it without noticing that no measurement exists.
    expect(measuredStamp(null, 'de')).toBeNull();
    expect(measuredStamp('not-a-date', 'de')).toBeNull();
  });

  it('formats a real timestamp', () => {
    expect(measuredStamp('2026-08-14T12:00:00.000Z', 'de')).toBeTruthy();
    expect(measuredStamp('2026-08-14T12:00:00.000Z', 'en')).toBeTruthy();
  });
});
