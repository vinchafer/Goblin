// AKT 2 · PHASE 2.5 · U-C4 — the observer hook on the REAL runner.
//
// ops-console.test.ts drives the job wrapper against a mocked runner, which means
// it cannot prove anything about the hook itself. This file uses the real
// runOpsE2E, stopped at the preflight (an unprovisioned router makes it return
// after two steps by design), and checks the two properties the wrapper depends on:
//
//   • every step the runner records is also handed to onStep, in order, with the
//     same content — otherwise the console would show a different run than the one
//     that happened;
//   • an observer that THROWS cannot damage the run. This matters more than it
//     looks: by the time a later step fires, the run is midway through writing to
//     production R2 and KV, and a rendering bug must not be able to abandon it
//     there.

import { describe, it, expect, vi } from 'vitest';

// The preflight is the only substrate call made before the early return; stub it
// as "not provisioned" so the run stops without touching Cloudflare at all.
vi.mock('./ops-router-deploy', () => ({
  routerStatus: async () => ({
    scriptName: 'goblin-router',
    domain: 'justgoblin.app',
    pattern: '*.justgoblin.app/*',
    workerDeployed: false,
    zoneFound: true,
    wildcardProxied: null,
    routeBound: false,
    notes: ['worker not deployed'],
    timestamp: '2026-07-29T00:00:00.000Z',
  }),
}));

vi.mock('../lib/supabase', () => ({ getSupabaseAdmin: () => ({}) }));

const { runOpsE2E } = await import('./ops-e2e');

const OPTS = { userId: 'u-founder', actor: 'vinc.hafner3@gmail.com' };

describe('the onStep observer', () => {
  it('receives exactly the steps the report ends up containing, in order', async () => {
    const seen: Array<{ step: string; ok: boolean }> = [];
    const report = await runOpsE2E({ ...OPTS, onStep: (s) => seen.push({ step: s.step, ok: s.ok }) });

    expect(report.steps.length).toBeGreaterThan(0);
    expect(seen).toEqual(report.steps.map((s) => ({ step: s.step, ok: s.ok })));
    // The preflight blocked, so the run stopped after preflight + scan battery.
    expect(seen.map((s) => s.step)).toEqual(['preflight:router', 'scan:battery']);
    expect(seen[0]!.ok).toBe(false);
  });

  it('hands over the SAME object the report carries, propagation values included', async () => {
    const seen: unknown[] = [];
    const report = await runOpsE2E({ ...OPTS, onStep: (s) => seen.push(s) });
    expect(seen).toEqual(report.steps);
  });

  it('completes the run and returns a full report when the observer throws every time', async () => {
    const thrower = vi.fn(() => {
      throw new Error('render crashed');
    });
    const report = await runOpsE2E({ ...OPTS, onStep: thrower });

    expect(thrower).toHaveBeenCalledTimes(report.steps.length);
    expect(report.steps.map((s) => s.step)).toEqual(['preflight:router', 'scan:battery']);
    // The numbers are still produced — the run was not abandoned partway.
    expect(report.numbers.scanBattery).toMatch(/^\d+\/\d+$/);
    expect(report.notes.some((n) => n.startsWith('BLOCKED-ON-DNS'))).toBe(true);
  });

  it('runs identically with no observer at all — the hook is optional', async () => {
    const withOut = await runOpsE2E(OPTS);
    const withOne = await runOpsE2E({ ...OPTS, onStep: () => {} });
    expect(withOut.steps.map((s) => s.step)).toEqual(withOne.steps.map((s) => s.step));
    expect(withOut.numbers.scanBattery).toBe(withOne.numbers.scanBattery);
  });
});
