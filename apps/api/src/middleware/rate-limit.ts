import type { Context, Next } from 'hono';

const generalStore = new Map<string, { count: number; resetAt: number }>();
const strictStore = new Map<string, { count: number; resetAt: number }>();

// Cleanup old entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of generalStore.entries()) {
    if (entry.resetAt < now) {
      generalStore.delete(key);
    }
  }
  for (const [key, entry] of strictStore.entries()) {
    if (entry.resetAt < now) {
      strictStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function rateLimitMiddleware(limit: number, windowMs: number, store: Map<string, { count: number; resetAt: number }>) {
  return async (c: Context, next: Next) => {
    const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown';
    const now = Date.now();

    let entry = store.get(ip);

    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(ip, entry);
    }

    entry.count++;

    if (entry.count > limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.header('Retry-After', retryAfter.toString());
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    c.header('X-RateLimit-Limit', limit.toString());
    c.header('X-RateLimit-Remaining', (limit - entry.count).toString());
    c.header('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000).toString());

    await next();
  };
}

export const generalRateLimit = rateLimitMiddleware(100, 60 * 1000, generalStore);
export const strictRateLimit = rateLimitMiddleware(10, 60 * 1000, strictStore);