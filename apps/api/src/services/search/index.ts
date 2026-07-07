// F4.3 — search adapter factory, budget knobs, and per-user daily cap.
//
// Two layers, mirroring the model stack's Vercel philosophy:
//   • PLATFORM key (BRAVE_SEARCH_API_KEY) — the bundled default. Its searches are
//     platform COGS, protected by a per-user daily cap (SEARCH_DAILY_CAP, default 25).
//   • USER key (BYOK 'brave') — routed through the SAME adapter, but cap-EXEMPT and
//     zero platform cost (the user's own free Brave quota). JIT-offered at the cap.
//
// The daily counter is in-memory per instance (mirrors the M8 dictation cap): it
// resets on deploy and is not shared across replicas — a deliberate v1 abuse guard,
// not a billing ledger. Promote to a persisted counter if search volume grows.

import { createBraveProvider } from './brave';
import { getActiveKeyByProvider } from '../byok-service';
import type { SearchProvider } from './types';

export type { SearchProvider, SearchResult } from './types';

/** Max web searches a single agent run may make (spec §4 default 3). Env-overridable. */
export function agentMaxSearchesPerRun(): number {
  const raw = Number(process.env.AGENT_MAX_SEARCHES);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 3;
}

/** Per-user daily platform-search cap (spec §4 default 25). Env-overridable. */
export function searchDailyCap(): number {
  const raw = Number(process.env.SEARCH_DAILY_CAP);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 25;
}

/** The platform (bundled) provider, or null when no platform key is configured. */
export function getPlatformSearchProvider(): SearchProvider | null {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  return key ? createBraveProvider(key) : null;
}

// ── In-memory per-user daily counter (UTC day) ──────────────────────────────────
const dailyCounts = new Map<string, { day: string; count: number }>();
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** How many platform searches this user has left today (does not consume). */
export function remainingPlatformSearches(userId: string): number {
  const cap = searchDailyCap();
  const entry = dailyCounts.get(userId);
  if (!entry || entry.day !== today()) return cap;
  return Math.max(0, cap - entry.count);
}

/** Record one platform search against the user's daily allowance. */
export function recordPlatformSearch(userId: string): void {
  const day = today();
  const entry = dailyCounts.get(userId);
  if (!entry || entry.day !== day) dailyCounts.set(userId, { day, count: 1 });
  else entry.count += 1;
}

/** TEST-ONLY: reset the in-memory counter so cap tests are deterministic. */
export function __resetSearchCountsForTest(): void {
  dailyCounts.clear();
}

export interface ResolvedSearch {
  provider: SearchProvider;
  /** 'user' = the caller's own BYOK Brave key (cap-exempt); 'platform' = bundled key. */
  source: 'user' | 'platform';
  /** True when this route does NOT count against the platform daily cap / COGS. */
  capExempt: boolean;
}

/**
 * Resolve which provider serves this user's search. Prefers the user's own Brave key
 * (BYOK 'brave') — cap-exempt, zero platform cost — and falls back to the platform
 * key. Returns null when neither is available (no search capability at all).
 */
export async function resolveSearchProvider(userId: string): Promise<ResolvedSearch | null> {
  // User key first (layered like BYOK models): their own free quota, cap-exempt.
  try {
    const userKey = await getActiveKeyByProvider(userId, 'brave');
    if (userKey) {
      return { provider: createBraveProvider(userKey), source: 'user', capExempt: true };
    }
  } catch {
    // A stored-but-undecryptable key must not kill search — fall through to platform.
  }
  const platform = getPlatformSearchProvider();
  if (platform) return { provider: platform, source: 'platform', capExempt: false };
  return null;
}
