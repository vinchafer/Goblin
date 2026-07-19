// WAVE-H · H5 (#12) — the founder-reachable metrics endpoint: admin-gated, and a synthetic
// incident is visible in the GET body. Deterministic — no DB touched by this route.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { admin } from './admin';
import { recordHttp, recordAgentRun, __resetMetricsForTest } from '../lib/metrics';

const KEY = 'test-admin-key-wave-h';

describe('GET /api/admin/metrics (H5 #12)', () => {
  beforeEach(() => { process.env.ADMIN_API_KEY = KEY; __resetMetricsForTest(); });
  afterEach(() => { delete process.env.ADMIN_API_KEY; __resetMetricsForTest(); });

  it('rejects without the admin key (401)', async () => {
    const res = await admin.request('/metrics');
    expect(res.status).toBe(401);
  });

  it('with the key: returns the live snapshot, and shows a synthetic incident', async () => {
    // Synthesize an error spike + capacity shedding.
    for (let i = 0; i < 30; i++) recordHttp(200);
    for (let i = 0; i < 6; i++) recordHttp(500);
    recordAgentRun('admission_rejected', { reason: 'global_limit' });

    const res = await admin.request('/metrics', { headers: { 'x-admin-key': KEY } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('attention'); // something is alerting
    expect(body.alerts.some((a: string) => a.startsWith('error_rate_high'))).toBe(true);
    expect(body.alerts).toContain('capacity_shedding:1');
    expect(body.http.total).toBe(36);
    expect(body).toHaveProperty('live');
    expect(body).toHaveProperty('circuits');
    expect(body).toHaveProperty('timestamp');
  });

  it('with the key on a quiet system: status ok, no alerts', async () => {
    const res = await admin.request('/metrics', { headers: { 'x-admin-key': KEY } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.alerts).toEqual([]);
  });
});
