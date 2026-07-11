import type { Context, Next } from 'hono';

// NOTE: In-memory store — resets on every deploy/restart and is NOT shared across
// multiple API instances. Acceptable for single-instance Phase 1; replace with a
// Redis-backed limiter (e.g. @hono-rate-limiter/redis) before horizontal scaling.
const stores = new Map<string, Map<string, { count: number; resetAt: number }>>();

function getStore(name: string): Map<string, { count: number; resetAt: number }> {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  return stores.get(name)!;
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [, store] of stores) {
    for (const [key, entry] of store) {
      if (entry.resetAt < now) {
        store.delete(key);
      }
    }
  }
}, 5 * 60 * 1000);

function getClientId(c: Context): string {
  const userId = c.get('userId');
  if (userId) return `user:${userId}`;
  return c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown';
}

// D-2: honest German copy for every 429 — "du gehst zu schnell", not a silent drop.
export const RATE_LIMIT_MESSAGE_DE = 'Du gehst gerade etwas zu schnell — bitte einen kurzen Moment warten und erneut versuchen.';

export interface RateLimitHit {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
  resetAt: number;
}

/**
 * D-2 — the single fixed-window accounting primitive, shared by the middleware and by
 * routes that must count only AFTER their own eligibility checks (e.g. an agent run
 * that should not burn quota on a 409-ineligible probe). Records one hit for `clientId`
 * in `storeName` and reports whether it stayed within `limit` over `windowMs`.
 */
export function hitRateLimit(storeName: string, clientId: string, limit: number, windowMs: number): RateLimitHit {
  const store = getStore(storeName);
  const now = Date.now();
  let entry = store.get(clientId);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(clientId, entry);
  }
  entry.count++;
  const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    retryAfterSec,
    resetAt: entry.resetAt,
  };
}

export function rateLimitMiddleware(limit: number, windowMs: number, storeName: string = 'default') {
  return async (c: Context, next: Next) => {
    const hit = hitRateLimit(storeName, getClientId(c), limit, windowMs);

    if (!hit.allowed) {
      c.header('Retry-After', hit.retryAfterSec.toString());
      return c.json({ error: RATE_LIMIT_MESSAGE_DE, retryAfterSeconds: hit.retryAfterSec }, 429);
    }

    c.header('X-RateLimit-Limit', limit.toString());
    c.header('X-RateLimit-Remaining', hit.remaining.toString());
    c.header('X-RateLimit-Reset', Math.ceil(hit.resetAt / 1000).toString());

    await next();
  };
}

// Per-route rate limiters
export const generalRateLimit = rateLimitMiddleware(60, 60 * 1000, 'general');
export const strictRateLimit = rateLimitMiddleware(10, 60 * 1000, 'strict');

// Chat stream: max 20 requests/minute per user
export const chatStreamRateLimit = rateLimitMiddleware(20, 60 * 1000, 'chat-stream');

// Project generate: max 5 requests/minute per user
export const projectGenerateRateLimit = rateLimitMiddleware(5, 60 * 1000, 'project-generate');

// BYOK keys: max 10 requests/minute per user
export const byokKeysRateLimit = rateLimitMiddleware(10, 60 * 1000, 'byok-keys');