// Redis cache wrapper with in-memory fallback.
// Uses Upstash Redis when UPSTASH_REDIS_URL is set, otherwise pure in-memory Map.

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// Simple in-memory LRU-ish cache (no eviction — TTL cleanup on get)
const memCache = new Map<string, CacheEntry<unknown>>();

function memGet<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { memCache.delete(key); return null; }
  return entry.value as T;
}

function memSet<T>(key: string, value: T, ttlMs: number): void {
  memCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function memDel(key: string): void {
  memCache.delete(key);
}

function memDelPattern(pattern: string): void {
  const prefix = pattern.replace('*', '');
  for (const key of memCache.keys()) {
    if (key.startsWith(prefix)) memCache.delete(key);
  }
}

// Redis client — lazy-init, only if UPSTASH_REDIS_URL is set
let redisClient: { get: (k: string) => Promise<string | null>; set: (k: string, v: string, opts: { ex: number }) => Promise<unknown>; del: (k: string) => Promise<unknown> } | null = null;
let redisAvailable = true;

async function getRedis() {
  if (!redisAvailable || !process.env.UPSTASH_REDIS_URL) return null;
  if (redisClient) return redisClient;
  try {
    const { Redis } = await import('@upstash/redis');
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN ?? '',
    });
    return redisClient;
  } catch {
    redisAvailable = false;
    return null;
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = await getRedis();
  if (redis) {
    try {
      const raw = await redis.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      redisAvailable = false;
    }
  }
  return memGet<T>(key);
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
      return;
    } catch {
      redisAvailable = false;
    }
  }
  memSet(key, value, ttlSeconds * 1000);
}

export async function cacheDel(key: string): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    try { await redis.del(key); return; } catch { redisAvailable = false; }
  }
  memDel(key);
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  // Redis SCAN not supported in Upstash free — fall back to mem
  memDelPattern(pattern);
}

export function cacheKey(...parts: string[]): string {
  return parts.join(':');
}

// TTL constants
export const TTL = {
  MODEL_LIST: 60,          // 60s
  USER_PLAN: 5 * 60,       // 5min
  FILE_TREE: 30,           // 30s
  GITHUB_STATUS: 2 * 60,  // 2min
} as const;
