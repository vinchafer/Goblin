/**
 * AKT 2 · PHASE 5 · U5.2 — the state machine's tests.
 *
 * These are the tests that hold the phase's honesty contract. They are written
 * against the RULES rather than against the implementation: every path INTO
 * unknown (cron gap, timeout, our own outage) and the single path OUT of it has
 * its own case, and there is an explicit case for every way a green could appear
 * without a measurement behind it.
 */

import { describe, it, expect } from 'vitest';
import {
  DEBOUNCE_WINDOW,
  CERT_WARN_DAYS,
  MIN_FRESHNESS_MS,
  MIN_UPTIME_COVERAGE_MS,
  deriveState,
  expiryOutcome,
  freshnessMsFor,
  uptimeSummary,
  type CheckOutcome,
  type CheckRow,
} from './ops-check-state';

const NOW = Date.parse('2026-08-14T12:00:00.000Z');
const MIN = 60_000;
/** The cadence the beta actually runs at (P5-a: 5 minutes at =17 apps). */
const FRESH = freshnessMsFor('entry', 5);

/** Rows newest-first, `agoMinutes` counted back from NOW. */
function rows(...spec: Array<[CheckOutcome, number]>): CheckRow[] {
  return spec.map(([outcome, agoMinutes]) => ({
    outcome,
    measuredAt: new Date(NOW - agoMinutes * MIN).toISOString(),
  }));
}

describe('deriveState — the paths INTO unknown', () => {
  it('no rows at all is unknown/never_checked, never healthy', () => {
    const d = deriveState([], { now: NOW, freshnessMs: FRESH });
    expect(d.state).toBe('unknown');
    expect(d.reason).toBe('never_checked');
    expect(d.measuredAt).toBeNull();
    expect(d.lastOutcome).toBeNull();
  });

  it('CRON GAP: a stale ok row is unknown, not healthy — no optimistic caching of green', () => {
    // Two perfectly good measurements. They are simply old.
    const d = deriveState(rows(['ok', 60], ['ok', 65]), { now: NOW, freshnessMs: FRESH });
    expect(d.state).toBe('unknown');
    expect(d.reason).toBe('stale');
    // The measurement time is still reported: "we last looked an hour ago" is the
    // useful sentence, and it needs the timestamp.
    expect(d.measuredAt).toBe(new Date(NOW - 60 * MIN).toISOString());
    expect(d.lastOutcome).toBe('ok');
  });

  it('CRON GAP: a stale FAIL row is also unknown — staleness beats the outcome both ways', () => {
    const d = deriveState(rows(['fail', 90], ['fail', 95]), { now: NOW, freshnessMs: FRESH });
    expect(d.state).toBe('unknown');
    expect(d.reason).toBe('stale');
  });

  it('TIMEOUT: a newest inconclusive row is unknown even when the row behind it was ok', () => {
    const d = deriveState(rows(['unknown', 1], ['ok', 6]), { now: NOW, freshnessMs: FRESH });
    expect(d.state).toBe('unknown');
    expect(d.reason).toBe('inconclusive');
  });

  it('TIMEOUT: a newest inconclusive row is unknown even when the row behind it FAILED', () => {
    // The strict direction matters as much as the kind one: we do not get to call
    // an app down on the strength of a check we could not complete.
    const d = deriveState(rows(['unknown', 1], ['fail', 6]), { now: NOW, freshnessMs: FRESH });
    expect(d.state).toBe('unknown');
    expect(d.reason).toBe('inconclusive');
  });

  it('OUR OWN OUTAGE: a whole window of inconclusive rows never becomes down', () => {
    const d = deriveState(rows(['unknown', 1], ['unknown', 6], ['unknown', 11]), { now: NOW, freshnessMs: FRESH });
    expect(d.state).toBe('unknown');
  });

  it('rule order: staleness is evaluated BEFORE the outcome', () => {
    // A stale inconclusive row reports `stale` (the actionable reason: the runner
    // is not running) rather than `inconclusive` (which would suggest one bad call).
    const d = deriveState(rows(['unknown', 120]), { now: NOW, freshnessMs: FRESH });
    expect(d.reason).toBe('stale');
  });
});

describe('deriveState — the path OUT of unknown', () => {
  it('one fresh ok measurement leaves unknown immediately', () => {
    const d = deriveState(rows(['ok', 1]), { now: NOW, freshnessMs: FRESH });
    expect(d.state).toBe('healthy');
    expect(d.reason).toBe('all_ok');
    expect(d.samples).toBe(1);
  });

  it('there is no path out that does not go through a fresh row', () => {
    // Exhaustive over the outcome vocabulary: with every row stale, no outcome
    // produces anything but unknown. This is the "no carried-forward state" rule
    // stated as a property rather than as three examples.
    for (const outcome of ['ok', 'warn', 'fail', 'unknown'] as CheckOutcome[]) {
      const d = deriveState(rows([outcome, 240], [outcome, 245]), { now: NOW, freshnessMs: FRESH });
      expect(d.state).toBe('unknown');
    }
  });
});

describe('deriveState — healthy / degraded / down', () => {
  it('a full window of ok is healthy', () => {
    const d = deriveState(rows(['ok', 1], ['ok', 6], ['ok', 11]), { now: NOW, freshnessMs: FRESH });
    expect(d.state).toBe('healthy');
  });

  it('ONE failure is degraded, not down — the debounce, from the breaking side', () => {
    const d = deriveState(rows(['fail', 1], ['ok', 6]), { now: NOW, freshnessMs: FRESH });
    expect(d.state).toBe('degraded');
    expect(d.reason).toBe('mixed');
  });

  it('TWO consecutive failures are down', () => {
    const d = deriveState(rows(['fail', 1], ['fail', 6]), { now: NOW, freshnessMs: FRESH });
    expect(d.state).toBe('down');
    expect(d.reason).toBe('sustained_failure');
  });

  it('ONE recovery is degraded, not healthy — the debounce, from the recovering side', () => {
    const d = deriveState(rows(['ok', 1], ['fail', 6]), { now: NOW, freshnessMs: FRESH });
    expect(d.state).toBe('degraded');
  });

  it('TWO consecutive recoveries are healthy', () => {
    const d = deriveState(rows(['ok', 1], ['ok', 6], ['fail', 11]), { now: NOW, freshnessMs: FRESH });
    expect(d.state).toBe('healthy');
  });

  it('a warn is degraded, never healthy and never down', () => {
    const d = deriveState(rows(['warn', 1], ['warn', 6]), { now: NOW, freshnessMs: FRESH });
    expect(d.state).toBe('degraded');
  });

  it('one failure plus one inconclusive is NOT down — a full window of failures is required', () => {
    // The inconclusive row is not a second failure. Counting it as one would mean
    // reporting "down" on the strength of a check that never completed.
    const d = deriveState(rows(['fail', 1], ['unknown', 6]), { now: NOW, freshnessMs: FRESH });
    expect(d.state).toBe('degraded');
  });

  it('rows handed over oldest-first still derive from the NEWEST measurement', () => {
    const oldestFirst = [...rows(['fail', 1], ['fail', 6])].reverse();
    expect(deriveState(oldestFirst, { now: NOW, freshnessMs: FRESH }).state).toBe('down');
  });

  it('an unparseable timestamp is discarded, not treated as now', () => {
    const bad: CheckRow[] = [{ outcome: 'ok', measuredAt: 'not-a-date' }];
    expect(deriveState(bad, { now: NOW, freshnessMs: FRESH }).state).toBe('unknown');
    expect(deriveState(bad, { now: NOW, freshnessMs: FRESH }).reason).toBe('never_checked');
  });

  it('the debounce window is two', () => {
    expect(DEBOUNCE_WINDOW).toBe(2);
  });
});

describe('freshnessMsFor', () => {
  it('per-tick subjects allow three missed ticks', () => {
    expect(freshnessMsFor('entry', 10)).toBe(30 * MIN);
    expect(freshnessMsFor('form_store', 15)).toBe(45 * MIN);
  });

  it('never drops below the floor, so one slow tick is not a gap', () => {
    expect(freshnessMsFor('entry', 5)).toBe(MIN_FRESHNESS_MS);
    expect(freshnessMsFor('entry', 1)).toBe(MIN_FRESHNESS_MS);
  });

  it('slow-moving subjects carry their own threshold and ignore the cadence', () => {
    expect(freshnessMsFor('cert', 5)).toBe(6 * 60 * MIN);
    expect(freshnessMsFor('domain', 5)).toBe(48 * 60 * MIN);
    expect(freshnessMsFor('domain', 60)).toBe(48 * 60 * MIN);
  });
});

describe('expiryOutcome', () => {
  it('a date we could not read is unknown — never ok', () => {
    expect(expiryOutcome(null)).toBe('unknown');
    expect(expiryOutcome(undefined)).toBe('unknown');
    expect(expiryOutcome(Number.NaN)).toBe('unknown');
  });

  it('expired is a failure', () => {
    expect(expiryOutcome(0)).toBe('fail');
    expect(expiryOutcome(-3)).toBe('fail');
  });

  it('inside the warning window is warn — it is still serving, and it is not fine', () => {
    expect(expiryOutcome(1)).toBe('warn');
    expect(expiryOutcome(CERT_WARN_DAYS)).toBe('warn');
  });

  it('outside the warning window is ok', () => {
    expect(expiryOutcome(CERT_WARN_DAYS + 1)).toBe('ok');
    expect(expiryOutcome(89)).toBe('ok');
  });
});

describe('uptimeSummary', () => {
  const WEEK = 7 * 24 * 60 * MIN;

  /** `count` rows spread evenly back over `spanMinutes`. */
  function series(count: number, spanMinutes: number, outcome: CheckOutcome = 'ok'): CheckRow[] {
    return Array.from({ length: count }, (_, i) => ({
      outcome,
      measuredAt: new Date(NOW - Math.round((i * spanMinutes) / Math.max(1, count - 1)) * MIN).toISOString(),
    }));
  }

  it('refuses a percentage below 24 hours of coverage — and says how much it has', () => {
    const s = uptimeSummary(series(100, 6 * 60), { now: NOW, windowMs: WEEK });
    expect(s.ratio).toBeNull();
    expect(s.measured).toBe(100);
    expect(s.coveredMs).toBeLessThan(MIN_UPTIME_COVERAGE_MS);
  });

  it('reports a measured ratio once coverage is sufficient', () => {
    const all = series(300, 48 * 60);
    const s = uptimeSummary(all, { now: NOW, windowMs: WEEK });
    expect(s.ratio).toBe(1);
    expect(s.measured).toBe(300);
  });

  it('inconclusive rows are OUT of the denominator and reported separately', () => {
    const measured = series(200, 48 * 60, 'ok');
    const blind: CheckRow[] = Array.from({ length: 40 }, (_, i) => ({
      outcome: 'unknown',
      measuredAt: new Date(NOW - (i + 1) * MIN).toISOString(),
    }));
    const s = uptimeSummary([...measured, ...blind], { now: NOW, windowMs: WEEK });
    // The exclusion is what would flatter the number, so the count that makes it
    // visible has to be there.
    expect(s.measured).toBe(200);
    expect(s.inconclusive).toBe(40);
    expect(s.ratio).toBe(1);
  });

  it('failures move the ratio, and the ratio is the measured proportion', () => {
    const ok = series(90, 48 * 60, 'ok');
    const bad: CheckRow[] = Array.from({ length: 10 }, (_, i) => ({
      outcome: 'fail',
      measuredAt: new Date(NOW - (i + 1) * MIN).toISOString(),
    }));
    const s = uptimeSummary([...ok, ...bad], { now: NOW, windowMs: WEEK });
    expect(s.ratio).toBeCloseTo(0.9, 10);
    expect(s.ok).toBe(90);
    expect(s.measured).toBe(100);
  });

  it('a warn counts as reachable — a cert warning is not downtime', () => {
    const s = uptimeSummary(series(200, 48 * 60, 'warn'), { now: NOW, windowMs: WEEK });
    expect(s.ratio).toBe(1);
  });

  it('rows outside the window are ignored', () => {
    const old: CheckRow[] = [{ outcome: 'fail', measuredAt: new Date(NOW - 30 * 24 * 60 * MIN).toISOString() }];
    const s = uptimeSummary([...series(200, 48 * 60), ...old], { now: NOW, windowMs: WEEK });
    expect(s.measured).toBe(200);
  });

  it('an empty window is null, not zero — no data must never render as 0 % down', () => {
    const s = uptimeSummary([], { now: NOW, windowMs: WEEK });
    expect(s.ratio).toBeNull();
    expect(s.measured).toBe(0);
    expect(s.coveredMs).toBe(0);
  });

  it('coverage is measured from the rows, never assumed from the window', () => {
    const s = uptimeSummary(series(300, 48 * 60), { now: NOW, windowMs: WEEK });
    expect(s.windowMs).toBe(WEEK);
    // Two days of rows in a seven-day window: the surface must be able to say so.
    expect(s.coveredMs).toBeLessThan(WEEK);
    expect(s.coveredMs).toBeGreaterThanOrEqual(MIN_UPTIME_COVERAGE_MS);
  });
});
