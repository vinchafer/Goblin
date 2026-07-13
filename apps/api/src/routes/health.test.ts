// F-35 (FIX-WAVE 2) GATE — /api/health reachability on the primary domain.
//
// Root cause: health was mounted only at `/health`, but justgoblin.com
// (→ www) rewrites ONLY `/api/*` to the Railway API. So the domain's
// `/api/health` hit Railway `/api/health` (unmounted → 404) and `/health`
// was never rewritten. Fix: dual-mount at `/api/health` too (mirroring the
// existing /version + /api/version pattern). This test mounts the SAME health
// router at `/api/health` and proves the canonical path returns {status:"ok"}
// and that the deep variant is reachable — deterministic, no live deploy.

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { health } from './health';

// Mirror index.ts: the router is mounted at BOTH paths; the domain reaches it
// via /api/health.
function app() {
  const a = new Hono();
  a.route('/health', health);
  a.route('/api/health', health);
  return a;
}

describe('/api/health (primary-domain canonical path)', () => {
  it('GET /api/health → 200 {status:"ok"}', async () => {
    const res = await app().request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('version');
  });

  it('GET /health still works (direct Railway origin path)', async () => {
    const res = await app().request('/health');
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('ok');
  });

  it('GET /api/health/deep is reachable and returns a checks report', async () => {
    const res = await app().request('/api/health/deep');
    // 200 (ok/degraded) or 503 (down) — both are valid reachable responses; the
    // point is it is no longer a 404.
    expect([200, 503]).toContain(res.status);
    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('checks');
  });
});
