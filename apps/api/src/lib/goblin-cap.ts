/**
 * Goblin-bundled (Layer 2) fair-use config + cap logic — pure, no network.
 *
 * ── SESSION 3: ONE WEIGHTED ALLOWANCE ────────────────────────────────────────
 * Every plan (trial→power) can use BOTH Goblin models (Swift + Forge). The plans
 * differ ONLY in how much they can spend, expressed as a single monthly allowance
 * in "cost units". Forge costs ~4.4× more per token than Swift, so it consumes the
 * allowance ~4.4× faster — one weighted bar, never two budgets the user must track.
 *
 *   cost_units = swift_tokens + forge_tokens × FORGE_WEIGHT
 *
 * ── THE NUMBERS (LOCKED — founder + financial model; do NOT recompute) ────────
 * Blended DeepInfra cost (9:1 in:out), used ONLY to derive the weight:
 *   • Swift (DeepSeek V3.2, input caching) ≈ $0.162 / 1M tokens
 *   • Forge (Kimi K2.6)                    ≈ $0.715 / 1M tokens
 *   • FORGE_WEIGHT = 0.715 / 0.162 ≈ 4.4   (1 Forge token ≈ 4.4 Swift tokens)
 *
 * Monthly allowance per plan, in cost units ("Swift-equivalent M tokens"):
 *   • Trial 4.9M  (acquisition budget ≈ $0.80/user — ≈5× Bolt's free 1M + Forge
 *                  access; taste both models generously)
 *   • Build 17.4M (plan ≈ $11; ~70% margin floor at 100% Forge)
 *   • Pro   30.0M (plan ≈ $19)
 *   • Power 61.7M (plan ≈ $39)
 * Design guarantee: a typical user (~20% Forge) runs at ~85%+ gross margin; the
 * worst case (100% Forge to the cap) never drops below ~70% margin. Generous for
 * normal use, protected against the heavy tail.
 *
 * Daily safety net (anti-abuse firewall, NOT a user-facing limit) ≈ 1/5 of the
 * monthly allowance in cost units — sized so a normal weekend-builder never trips
 * it; only bots / runaway loops do. Plus the per-request output ceiling (8096,
 * kept next to the streaming client in goblin-hosted.ts).
 *
 * Two-level truth (HR-4): NOTHING here — "cost units", "$", "4.4", the provider —
 * ever reaches a user surface. The bar and copy speak only in "your monthly Goblin
 * allowance" / "X% used". These constants are internal economics.
 *
 * Pure + deterministic by design: trivially unit-testable, reusable on the API
 * (enforcement) and web (usage bar) sides. ONE config module (HR-1).
 */

export type CapState = 'ok' | 'warn' | 'over';

/**
 * Forge-to-Swift cost ratio. 1 Forge token consumes the allowance like
 * FORGE_WEIGHT Swift tokens. Derived from blended per-token cost (see header) —
 * locked, not tuned at runtime.
 */
export const FORGE_WEIGHT = 4.4;

/**
 * Monthly allowance per plan, in COST UNITS (Swift-equivalent tokens). A plan can
 * spend this as all-Swift, all-Forge (→ allowance / FORGE_WEIGHT Forge tokens), or
 * any mix. See header for the margin rationale behind each number.
 */
export const GOBLIN_MONTHLY_ALLOWANCE: Record<string, number> = {
  trial: 4_900_000,
  build: 17_400_000,
  pro: 30_000_000,
  power: 61_700_000,
};

/** Fallback allowance for an unknown/missing plan — the most conservative (trial,
 *  4.9M cost units; mirrors GOBLIN_MONTHLY_ALLOWANCE.trial). */
export const GOBLIN_DEFAULT_ALLOWANCE = 4_900_000;

/**
 * PUBLIC "Builds / month" proxy basis (HR-6, DD §A step 4). The pricing/plan copy may
 * NOT show cost units / tokens / $ / the Forge weight (two-level truth), so each plan's
 * allowance is translated into a tangible "≈ N Builds / month" figure using this single
 * documented divisor. A "build" = one agent run / generation turn; 50,000 cost units is
 * a deliberately CONSERVATIVE estimate of a typical mixed Swift/Forge build (≈50k Swift
 * tokens, or ≈11k Forge tokens at FORGE_WEIGHT), so the public numbers under-count rather
 * than over-promise. Adjust here if real telemetry shifts the average; the web copy
 * (apps/web/lib/plan-builds.ts) carries the rounded result and points back to this.
 *   trial  4.9M /50k ≈  98 → 100      build 17.4M /50k ≈ 348 → 350
 *   pro   30.0M /50k = 600 → 600      power 61.7M /50k ≈ 1234 → 1,200 (rounded down)
 */
export const COST_UNITS_PER_BUILD = 50_000;

/**
 * Per-user / per-day hard guard, in COST UNITS (≈ 1/5 of the monthly allowance).
 * Anti-abuse firewall only — a normal user never reaches it; it stops bots and
 * runaway agent loops from draining a month of allowance (or Goblin's balance) in
 * a single day. Locked numbers, not allowance/5 at runtime.
 */
export const GOBLIN_DAILY_GUARD: Record<string, number> = {
  trial: 1_000_000,
  build: 3_500_000,
  pro: 6_000_000,
  power: 12_000_000,
};

/** Fallback daily guard for an unknown/missing plan — the most conservative (trial,
 *  1.0M cost units; mirrors GOBLIN_DAILY_GUARD.trial). */
export const GOBLIN_DEFAULT_DAILY_GUARD = 1_000_000;

/** Show the "approaching allowance" warning at this fraction of the allowance. */
export const GOBLIN_CAP_WARN_RATIO = 0.8;

export interface CapStatus {
  /** Weighted cost units consumed this month (internal — NOT shown to the user). */
  usedTokens: number;
  /** The plan's monthly allowance in cost units (internal). */
  capTokens: number;
  /** Remaining cost units (internal). */
  remainingTokens: number;
  /** used / allowance, clamped to [0, 1] for bar rendering. */
  ratio: number;
  /** ratio as a 0-100 integer percent — the ONLY number the bar shows. */
  percent: number;
  state: CapState;
  /** ISO date (YYYY-MM-DD) the allowance resets — start of next calendar month. */
  resetDate: string;
}

/**
 * Weight raw Swift/Forge token totals into a single cost-unit total.
 * Defensive against malformed input (negative/NaN → 0) so a bad rollup row can
 * never throw or render a broken bar.
 */
export function weightedCostUnits(swiftTokens: number, forgeTokens: number): number {
  const swift = Number.isFinite(swiftTokens) && swiftTokens > 0 ? swiftTokens : 0;
  const forge = Number.isFinite(forgeTokens) && forgeTokens > 0 ? forgeTokens : 0;
  return Math.floor(swift + forge * FORGE_WEIGHT);
}

/** Resolve the monthly allowance (cost units) for a plan id (case-insensitive). */
export function monthlyAllowanceForPlan(plan?: string | null): number {
  if (!plan) return GOBLIN_DEFAULT_ALLOWANCE;
  return GOBLIN_MONTHLY_ALLOWANCE[plan.toLowerCase()] ?? GOBLIN_DEFAULT_ALLOWANCE;
}

/** Resolve the per-day guard (cost units) for a plan id (case-insensitive). */
export function dailyGuardForPlan(plan?: string | null): number {
  if (!plan) return GOBLIN_DEFAULT_DAILY_GUARD;
  return GOBLIN_DAILY_GUARD[plan.toLowerCase()] ?? GOBLIN_DEFAULT_DAILY_GUARD;
}

/** ISO date (YYYY-MM-DD, UTC) of the next allowance reset = first of next month. */
export function nextMonthlyResetISO(now: Date = new Date()): string {
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return reset.toISOString().slice(0, 10);
}

/**
 * Compute the monthly cap status from raw Swift + Forge token totals (the weight is
 * applied here — single source). Defensive against bad input so a malformed rollup
 * can never throw or render a broken bar.
 */
export function computeCapStatus(
  swiftTokens: number,
  forgeTokens: number,
  plan?: string | null,
  now: Date = new Date(),
): CapStatus {
  const used = weightedCostUnits(swiftTokens, forgeTokens);
  const capRaw = monthlyAllowanceForPlan(plan);
  const cap = Number.isFinite(capRaw) && capRaw > 0 ? capRaw : GOBLIN_DEFAULT_ALLOWANCE;

  const remainingTokens = Math.max(0, cap - used);
  const rawRatio = used / cap;
  const ratio = Math.min(1, Math.max(0, rawRatio));
  const percent = Math.round(ratio * 100);

  let state: CapState = 'ok';
  if (used >= cap) state = 'over';
  else if (rawRatio >= GOBLIN_CAP_WARN_RATIO) state = 'warn';

  return {
    usedTokens: used,
    capTokens: cap,
    remainingTokens,
    ratio,
    percent,
    state,
    resetDate: nextMonthlyResetISO(now),
  };
}

/** True once this month's weighted usage has reached/exceeded the plan allowance. */
export function isOverMonthlyAllowance(
  swiftTokens: number,
  forgeTokens: number,
  plan?: string | null,
): boolean {
  return weightedCostUnits(swiftTokens, forgeTokens) >= monthlyAllowanceForPlan(plan);
}

/** True once TODAY's weighted usage has reached/exceeded the plan's daily guard. */
export function isOverDailyGuard(
  swiftTokensToday: number,
  forgeTokensToday: number,
  plan?: string | null,
): boolean {
  return weightedCostUnits(swiftTokensToday, forgeTokensToday) >= dailyGuardForPlan(plan);
}
