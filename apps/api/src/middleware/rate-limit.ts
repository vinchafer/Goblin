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

export function rateLimitMiddleware(limit: number, windowMs: number, storeName: string = 'default') {
  return async (c: Context, next: Next) => {
    const store = getStore(storeName);
    const clientId = getClientId(c);
    const now = Date.now();

    let entry = store.get(clientId);
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(clientId, entry);
    }

    entry.count++;

    if (entry.count > limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.header('Retry-After', retryAfter.toString());
      return c.json({ error: 'Rate limit exceeded. Please slow down.' }, 429);
    }

    c.header('X-RateLimit-Limit', limit.toString());
    c.header('X-RateLimit-Remaining', (limit - entry.count).toString());
    c.header('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000).toString());

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