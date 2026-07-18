// WAVE-H · H2 gate — the version endpoint is cacheable (static/CDN header) and stable per
// boot. Before H2 it set `buildTime: new Date()` (changed every request → uncacheable) and
// no Cache-Control. This proves the header is present and the body is byte-stable across
// calls, so a browser/edge can serve repeat version polls without a round trip.

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { versionHandler, BOOT_TIME } from './version-handler';

function app() {
  const a = new Hono();
  a.get('/version', versionHandler);
  a.get('/api/version', versionHandler);
  return a;
}

describe('WAVE-H H2 — version endpoint caching', () => {
  it('sets a public Cache-Control so repeats are served from cache', async () => {
    const res = await app().request('/api/version');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=30');
  });

  it('body is stable per boot (buildTime is boot time, not request time)', async () => {
    const a = app();
    const b1 = await (await a.request('/api/version')).json();
    await new Promise((r) => setTimeout(r, 5));
    const b2 = await (await a.request('/api/version')).json();
    expect(b1.buildTime).toBe(BOOT_TIME);
    expect(b2.buildTime).toBe(BOOT_TIME); // did NOT advance to "now" — cacheable + honest
    expect(b1).toEqual(b2);
  });

  it('both mount points answer identically', async () => {
    const a = app();
    const legacy = await (await a.request('/version')).json();
    const canonical = await (await a.request('/api/version')).json();
    expect(legacy).toEqual(canonical);
  });
});
