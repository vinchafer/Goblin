// Sprint 10.9-3 — Per-provider health monitoring + circuit breaker.
//
// Tracks a rolling-window error rate per provider from real routing outcomes
// (model-router records every success/failure here). When a provider degrades,
// the ModelPicker shows a badge and streamCompletion auto-routes to the user's
// fallback chain. Also catches the slug-failure class (§1): a provider
// "model not found / invalid model" for a slug that came straight from
// discovery is both a provider error AND a flagged suspect slug, so the weekly
// digest can surface "slug X failed routing".
//
// State is in-memory and per-process (acceptable for a beta breaker — a fresh
// process simply starts 'healthy'). Transitions are persisted to
// provider_health_events for the digest + admin dashboard.

import { getSupabaseAdmin } from '../lib/supabase';

export type HealthState = 'healthy' | 'degraded' | 'down';

interface Outcome {
  ts: number;
  ok: boolean;
}

interface ProviderWindow {
  outcomes: Outcome[];
  state: HealthState;
}

// Tunable per §7d: widen to 15min if 5min produces false positives.
const WINDOW_MS = Number(process.env.HEALTH_WINDOW_MS) || 5 * 60 * 1000;
const DEGRADE_ERROR_RATE = 0.10;
const RECOVER_ERROR_RATE = 0.05;
const MIN_VOLUME = 10;

const windows = new Map<string, ProviderWindow>();

// slug → { count, lastTs } for discovery slugs that failed routing as "model not
// found / invalid model". Surfaced in the weekly digest + admin dashboard.
const suspectSlugs = new Map<string, { count: number; lastTs: number }>();

function win(provider: string): ProviderWindow {
  let w = windows.get(provider);
  if (!w) {
    w = { outcomes: [], state: 'healthy' };
    windows.set(provider, w);
  }
  return w;
}

function prune(w: ProviderWindow, now: number): void {
  const cutoff = now - WINDOW_MS;
  if (w.outcomes.length && w.outcomes[0]!.ts < cutoff) {
    w.outcomes = w.outcomes.filter((o) => o.ts >= cutoff);
  }
}

function stats(w: ProviderWindow): { errorRate: number; volume: number } {
  const volume = w.outcomes.length;
  if (volume === 0) return { errorRate: 0, volume: 0 };
  const errors = w.outcomes.reduce((n, o) => n + (o.ok ? 0 : 1), 0);
  return { errorRate: errors / volume, volume };
}

/** Detect the slug-failure class from a provider error message. */
export function isModelNotFound(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  if (code === 'model_not_found') return true;
  const status = (err as { status?: number })?.status;
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  if (status === 404 && /model/.test(msg)) return true;
  return (
    /model[_\s-]?not[_\s-]?found/.test(msg) ||
    /invalid[_\s]?model/.test(msg) ||
    /(unknown|unsupported|does not exist).{0,20}model/.test(msg) ||
    /model.{0,20}(does not exist|not available)/.test(msg)
  );
}

/**
 * Record one routing outcome. `slug` + `modelNotFound` let a discovery slug that
 * the provider rejected be flagged as suspect (hard slug rule, §1).
 */
export function recordOutcome(
  provider: string,
  ok: boolean,
  opts: { slug?: string; modelNotFound?: boolean } = {},
): void {
  const now = Date.now();
  const w = win(provider);
  prune(w, now);
  w.outcomes.push({ ts: now, ok });

  if (!ok && opts.modelNotFound && opts.slug) {
    const cur = suspectSlugs.get(opts.slug) ?? { count: 0, lastTs: 0 };
    suspectSlugs.set(opts.slug, { count: cur.count + 1, lastTs: now });
  }

  const { errorRate, volume } = stats(w);
  const prev = w.state;
  let next = prev;
  if (volume >= MIN_VOLUME && errorRate > DEGRADE_ERROR_RATE) {
    next = 'degraded';
  } else if (prev === 'degraded' && errorRate < RECOVER_ERROR_RATE) {
    // The bad events have aged out of the window → sustained recovery.
    next = 'healthy';
  }

  if (next !== prev) {
    w.state = next;
    void persistTransition(provider, next, errorRate, volume);
  }
}

export interface ProviderHealth {
  provider: string;
  state: HealthState;
  errorRate: number;
  volume: number;
}

export function getHealth(provider: string): ProviderHealth {
  const w = win(provider);
  prune(w, Date.now());
  // A provider whose error events aged out recovers lazily on read too.
  const { errorRate, volume } = stats(w);
  if (w.state === 'degraded' && errorRate < RECOVER_ERROR_RATE) {
    w.state = 'healthy';
    void persistTransition(provider, 'healthy', errorRate, volume);
  }
  return { provider, state: w.state, errorRate, volume };
}

export function getAllHealth(): ProviderHealth[] {
  return [...windows.keys()].map(getHealth);
}

/** Map of provider → state, for the ModelPicker badge. */
export function getHealthMap(): Record<string, HealthState> {
  const out: Record<string, HealthState> = {};
  for (const h of getAllHealth()) {
    if (h.state !== 'healthy') out[h.provider] = h.state;
  }
  return out;
}

export interface SuspectSlug {
  slug: string;
  count: number;
  lastTs: number;
}

export function getSuspectSlugs(): SuspectSlug[] {
  return [...suspectSlugs.entries()].map(([slug, v]) => ({ slug, count: v.count, lastTs: v.lastTs }));
}

async function persistTransition(
  provider: string,
  state: HealthState,
  errorRate: number,
  volume: number,
): Promise<void> {
  try {
    await getSupabaseAdmin().from('provider_health_events').insert({
      provider,
      state,
      error_rate: Number(errorRate.toFixed(4)),
      volume,
    });
  } catch {
    // provider_health_events may not exist yet (0063 unapplied) — non-fatal.
  }
}
