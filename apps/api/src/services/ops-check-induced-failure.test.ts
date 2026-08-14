/**
 * AKT 2 · PHASE 5 · U5.6 — THE HEADLINE GATE.
 *
 * "Induced failure: state flips within N cycles, N reported as a number, and
 * recovers — 3/3 runs · UNKNOWN path demonstrated (pause the runner; the card says
 * UNKNOWN, not green)."
 *
 * The numbers are MEASURED by the harness against the shipped runner and the
 * shipped state machine, not asserted from the constants. If the debounce changes,
 * these numbers change with it and this file says so out loud.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runInducedFailureProof } from './ops-check-induced-failure';

beforeEach(() => {
  process.env.OPS_HOSTING_ENABLED = 'true';
  delete process.env.OPS_CHECKS_ENABLED;
});
afterEach(() => {
  delete process.env.OPS_HOSTING_ENABLED;
});

describe('U5.6 — break it on purpose, watch the state change', () => {
  it('flips and recovers, 3/3 runs, with the same cycle counts every time', async () => {
    const report = await runInducedFailureProof({ runs: 3 });

    expect(report.runs).toHaveLength(3);

    for (const run of report.runs) {
      // The first signal is ONE cycle after the break: a single failure is
      // `degraded`, which is the debounce working rather than hiding.
      expect(run.cyclesToFirstSignal, `run ${run.run} first signal`).toBe(1);
      // `down` needs the second consecutive failure.
      expect(run.cyclesToDown, `run ${run.run} down`).toBe(2);
      // Recovery is symmetrical: two consecutive successes.
      expect(run.cyclesToRecover, `run ${run.run} recover`).toBe(2);
    }

    // 3/3 agreeing is the gate; a run that differed would mean the state depended
    // on something other than the measurements.
    expect(report.consistent).toBe(true);
    expect(report.summary.cyclesToDown).toEqual([2, 2, 2]);
    expect(report.summary.cyclesToRecover).toEqual([2, 2, 2]);
  }, 30_000);

  it('passes through degraded before down — it never jumps straight to an outage', async () => {
    const report = await runInducedFailureProof({ runs: 1 });
    const run = report.runs[0]!;
    const afterBreak = run.observations.filter((o) => o.behaviour === 'broken');
    expect(afterBreak[0]?.state).toBe('degraded');
    expect(afterBreak[1]?.state).toBe('down');
  }, 30_000);

  it('every observation carries the time it was measured', async () => {
    const report = await runInducedFailureProof({ runs: 1 });
    for (const o of report.runs[0]!.observations) {
      expect(o.measuredAt, `cycle ${o.cycle}`).not.toBeNull();
      expect(Number.isFinite(Date.parse(o.measuredAt!))).toBe(true);
    }
  }, 30_000);
});

describe('U5.6 — the UNKNOWN path: pause the runner, and the card refuses to stay green', () => {
  it('goes healthy → UNKNOWN → healthy, and never reports a stale green', async () => {
    const report = await runInducedFailureProof({ runs: 1 });
    const u = report.unknownPath;

    expect(u.whileRunning).toBe('healthy');
    // THE gate. Nothing about the app changed — it is still serving 200. What
    // changed is that we stopped looking, and that is UNKNOWN, not "alles gut".
    expect(u.whilePaused).toBe('unknown');
    expect(u.pausedReason).toBe('stale');
    // The gap is DATED. "We last looked at 12:10" is the useful sentence, and it
    // needs the timestamp of the last real measurement to exist.
    expect(u.pausedMeasuredAt).not.toBeNull();
    // And it leaves UNKNOWN only by measuring again.
    expect(u.afterResume).toBe('healthy');
  }, 30_000);

  it('the pause that produces UNKNOWN is exactly three missed cycles', async () => {
    const report = await runInducedFailureProof({ runs: 1 });
    // 3 × 5 minutes, floored at 20 — so at the beta cadence it is 20 minutes.
    expect(report.freshnessMs).toBe(20 * 60_000);
    expect(report.cadenceMinutes).toBe(5);
  }, 30_000);
});
