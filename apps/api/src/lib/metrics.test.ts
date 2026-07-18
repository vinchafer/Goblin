// WAVE-H · H5 gate (#12) — a synthetic incident must be visible on the metrics surface.
// Deterministic: nowMs injected, counters reset per test. Proves the founder sees an error
// spike, capacity shedding, an OPEN circuit, and the agent success rate in ONE snapshot.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  recordHttp, recordAgentRun, metricsSnapshot, __resetMetricsForTest,
} from './metrics';
import { getCircuitBreaker } from '../middleware/circuit-breaker';

const NOW = 1_700_000_000_000; // fixed clock inside one window

describe('WAVE-H H5 — metrics surface (#12)', () => {
  beforeEach(() => __resetMetricsForTest());
  afterEach(() => __resetMetricsForTest());

  it('quiet system: no alerts, honest nulls before any data', () => {
    const snap = metricsSnapshot(NOW);
    expect(snap.alerts).toEqual([]);
    expect(snap.http.window.errorRatePct).toBeNull(); // too few samples → not a fake 0%
    expect(snap.agent.successRatePct).toBeNull();
  });

  it('error spike → error_rate_high alert with the actual %', () => {
    // 40 requests, 8 of them 5xx = 20% (>= 10% threshold, >= 20 samples).
    for (let i = 0; i < 32; i++) recordHttp(200, NOW);
    for (let i = 0; i < 8; i++) recordHttp(500, NOW);
    const snap = metricsSnapshot(NOW);
    expect(snap.http.window.errorRatePct).toBe(20);
    expect(snap.alerts).toContain('error_rate_high:20%');
  });

  it('a 4xx flood does NOT raise the error alert (only 5xx are errors)', () => {
    for (let i = 0; i < 30; i++) recordHttp(429, NOW); // rate-limited, not a server error
    const snap = metricsSnapshot(NOW);
    expect(snap.http.window.errorRatePct).toBe(0);
    expect(snap.alerts.some((a) => a.includes('error_rate_high'))).toBe(false);
  });

  it('capacity shedding → alert + per-reason breakdown', () => {
    recordAgentRun('admission_rejected', { reason: 'global_limit' }, NOW);
    recordAgentRun('admission_rejected', { reason: 'per_user_limit' }, NOW);
    recordAgentRun('admission_rejected', { reason: 'global_limit' }, NOW);
    const snap = metricsSnapshot(NOW);
    expect(snap.agent.admissionRejected).toBe(3);
    expect(snap.agent.admissionReasons).toEqual({ global_limit: 2, per_user_limit: 1 });
    expect(snap.alerts).toContain('capacity_shedding:3');
  });

  it('agent success rate reflects finished vs failed', () => {
    recordAgentRun('started'); recordAgentRun('started'); recordAgentRun('started'); recordAgentRun('started');
    recordAgentRun('finished', { outcome: 'finished' });
    recordAgentRun('finished', { outcome: 'published' });
    recordAgentRun('finished', { outcome: 'stopped' });
    recordAgentRun('finished', { outcome: 'error' });
    const snap = metricsSnapshot(NOW);
    expect(snap.agent.started).toBe(4);
    expect(snap.agent.finished).toBe(4);
    expect(snap.agent.failed).toBe(1);
    expect(snap.agent.successRatePct).toBe(75); // 3 of 4 non-error
    expect(snap.agent.outcomes).toMatchObject({ finished: 1, published: 1, stopped: 1, error: 1 });
  });

  it('an OPEN circuit breaker surfaces as an alert', async () => {
    const breaker = getCircuitBreaker('wave-h-metrics-probe', { failureThreshold: 2, resetTimeout: 60_000, successThreshold: 1 });
    const boom = async () => { throw new Error('provider down'); };
    for (let i = 0; i < 2; i++) { await breaker.execute(boom).catch(() => {}); }
    const snap = metricsSnapshot(NOW);
    expect(snap.circuits.some((c) => c.name === 'wave-h-metrics-probe' && c.state === 'OPEN')).toBe(true);
    expect(snap.alerts.some((a) => a.startsWith('circuit_open:'))).toBe(true);
  });

  it('rolling window ages out old error buckets (rate is "recently", not "since boot")', () => {
    // 20 errors far in the past — outside the window when we snapshot "now".
    const past = NOW - 60_000 * 60; // 60 minutes ago (window is 15)
    for (let i = 0; i < 20; i++) recordHttp(500, past);
    // A clean present.
    for (let i = 0; i < 30; i++) recordHttp(200, NOW);
    const snap = metricsSnapshot(NOW);
    expect(snap.http.total).toBe(50);            // cumulative counts everything
    expect(snap.http.window.errorRatePct).toBe(0); // but the WINDOW is clean
    expect(snap.alerts.some((a) => a.includes('error_rate_high'))).toBe(false);
  });
});
