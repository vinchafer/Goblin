import type { Context } from 'hono';

// Version handler — mounted at both /version (legacy) and /api/version so the path matches
// Vercel's /api/version and both surfaces answer identically. Extracted from index.ts so it
// is unit-testable (index.ts boots a server on import).
//
// WAVE-H · H2 (caching): the payload is stable per boot — BOOT_TIME is captured ONCE at
// module load, not recomputed per request (the old `buildTime: new Date()` changed every
// call: a minor honesty smell — it was the RESPONSE time, not a build time — and it made the
// response uncacheable). A public short-max-age Cache-Control lets the browser/edge serve
// repeat version polls without a round trip. Safe to cache publicly: not user-specific, and
// only changes on deploy (a <=30 s staleness window for new-deploy detection is acceptable).
export const BOOT_TIME = new Date().toISOString();

export const versionHandler = (c: Context) => {
  c.header('Cache-Control', 'public, max-age=30');
  return c.json({
    version: process.env.npm_package_version || '0.0.0',
    gitCommit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
    buildTime: BOOT_TIME,
    env: process.env.NODE_ENV,
    apiReady: true,
  });
};
