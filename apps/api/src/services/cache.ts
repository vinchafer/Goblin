// In-memory TTL cache. Process-local — each instance has its own copy.
// For shared cache across instances, swap this module out for a Redis-backed
// implementation in a dedicated session. We deliberately removed the
// @upstash/redis dependency in 11A-4 because it was never configured in
// production and the dynamic-import dance was hiding a missing dep error.

import logger from '../lib/logger';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const MAX_ENTRIES = 5_000;
const store = new Map<string, CacheEntry<unknown>>();

function evictIfNeeded(): void {
  if (store.size <= MAX_ENTRIES) return;
  const firstKey = store.keys().next().value;
  if (firstKey !== undefined) store.delete(firstKey);
}

function memGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

function memSet<T>(key: string, value: T, ttlMs: number): void {
  evictIfNeeded();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function memDel(key: string): void {
  store.delete(key);
}

function memDelPattern(pattern: string): void {
  const prefix = pattern.replace('*', '');
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  return memGet<T>(key);
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  memSet(key, value, ttlSeconds * 1000);
}

export async function cacheDel(key: string): Promise<void> {
  memDel(key);
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  memDelPattern(pattern);
}

export function cacheKey(...parts: string[]): string {
  return parts.join(':');
}

export function cacheSize(): number {
  return store.size;
}

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupTimer: NodeJS.Timeout | null = null;
function ensureCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of store.entries()) {
      if (entry.expiresAt < now) {
        store.delete(key);
        removed++;
      }
    }
    if (removed > 0) logger.debug({ removed, remaining: store.size }, 'cache cleanup');
  }, CLEANUP_INTERVAL_MS);
  if (cleanupTimer.unref) cleanupTimer.unref();
}
ensureCleanup();

export const TTL = {
  MODEL_LIST: 60,
  USER_PLAN: 5 * 60,
  FILE_TREE: 30,
  GITHUB_STATUS: 2 * 60,
} as const;
