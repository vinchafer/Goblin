// WAVE-D · D-2 gate — the fixed-window limiter primitive + the middleware's honest
// German 429. Trips exactly at the threshold; legitimate use under the limit is allowed;
// windows are per-store and per-client.

import { describe, it, expect } from 'vitest';
import { hitRateLimit, rateLimitMiddleware, RATE_LIMIT_MESSAGE_DE } from './rate-limit';

describe('hitRateLimit — trips at the threshold', () => {
  it('allows exactly `limit` hits then denies', () => {
    const store = `t-${Math.floor(performance.now())}-a`;
    for (let i = 1; i <= 3; i++) {
      expect(hitRateLimit(store, 'user:x', 3, 60_000).allowed).toBe(true);
    }
    const denied = hitRateLimit(store, 'user:x', 3, 60_000);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThan(0);
    expect(denied.remaining).toBe(0);
  });

  it('is isolated per client id', () => {
    const store = `t-${Math.floor(performance.now())}-b`;
    expect(hitRateLimit(store, 'user:a', 1, 60_000).allowed).toBe(true);
    expect(hitRateLimit(store, 'user:a', 1, 60_000).allowed).toBe(false);
    // a different user is unaffected
    expect(hitRateLimit(store, 'user:b', 1, 60_000).allowed).toBe(true);
  });

  it('is isolated per store name', () => {
    const s1 = `t-${Math.floor(performance.now())}-c1`;
    const s2 = `t-${Math.floor(performance.now())}-c2`;
    expect(hitRateLimit(s1, 'user:x', 1, 60_000).allowed).toBe(true);
    expect(hitRateLimit(s1, 'user:x', 1, 60_000).allowed).toBe(false);
    expect(hitRateLimit(s2, 'user:x', 1, 60_000).allowed).toBe(true); // separate budget
  });
});

describe('rateLimitMiddleware — honest German 429', () => {
  function fakeCtx(userId: string) {
    const headers: Record<string, string> = {};
    let jsonBody: unknown = null;
    let jsonStatus = 200;
    return {
      ctx: {
        get: (k: string) => (k === 'userId' ? userId : undefined),
        header: (k: string, v: string) => { headers[k] = v; },
        req: { header: () => undefined },
        json: (body: unknown, status?: number) => { jsonBody = body; jsonStatus = status ?? 200; return { body, status }; },
      },
      read: () => ({ headers, jsonBody, jsonStatus }),
    };
  }

  it('returns a German 429 with Retry-After once the limit is exceeded', async () => {
    const mw = rateLimitMiddleware(1, 60_000, `mw-${Math.floor(performance.now())}`);
    let nextCalls = 0;
    const next = async () => { nextCalls++; };

    const a = fakeCtx('u1');
    await mw(a.ctx as never, next); // 1st — allowed
    expect(nextCalls).toBe(1);

    const b = fakeCtx('u1');
    await mw(b.ctx as never, next); // 2nd — denied
    const { headers, jsonBody, jsonStatus } = b.read();
    expect(nextCalls).toBe(1); // next NOT called on the denied request
    expect(jsonStatus).toBe(429);
    expect((jsonBody as { error: string }).error).toBe(RATE_LIMIT_MESSAGE_DE);
    expect((jsonBody as { retryAfterSeconds: number }).retryAfterSeconds).toBeGreaterThan(0);
    expect(headers['Retry-After']).toBeDefined();
  });
});
