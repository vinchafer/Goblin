/**
 * Goblin-bundled (Layer 2) fair-use token cap — pure logic, no network.
 *
 * v6.1 API-first pivot, existential condition #3: hard per-user token caps. The
 * heavy tail in agentic coding is brutal (a Max-class user burns 300-835M tok/mo),
 * and Goblin's wedge selects precisely for those users — so the cap is what keeps
 * Layer 2 margin-positive. These functions turn a monthly token total (from the
 * goblin_hosted_monthly_tokens rollup, mig 0067) into a display/enforcement status.
 *
 * Pure + deterministic by design so it is trivially unit-testable and reusable on
 * both the API (enforcement) and the web (usage bar) sides.
 */

export type CapState = 'ok' | 'warn' | 'over';

/**
 * Monthly soft caps per plan, in tokens. Base plan ~40-60M (financial deep-dive
 * §3); upper tiers carry the heavy tail (Forge ~250M). Placeholders the founder
 * can tune — the shape is what matters.
 */
export const GOBLIN_MONTHLY_TOKEN_CAPS: Record<string, number> = {
  build: 40_000_000,
  pro: 120_000_000,
  power: 250_000_000,
};

/** Fallback cap for an unknown/missing plan — the conservative base cap. */
export const GOBLIN_DEFAULT_CAP = 40_000_000;

/** Show the "approaching limit" warning at this fraction of the cap. */
export const GOBLIN_CAP_WARN_RATIO = 0.8;

export interface CapStatus {
  usedTokens: number;
  capTokens: number;
  remainingTokens: number;
  /** used / cap, clamped to [0, 1] for bar rendering. */
  ratio: number;
  /** ratio as a 0-100 integer percent. */
  percent: number;
  state: CapState;
}

/** Resolve the monthly token cap for a plan id (case-insensitive). */
export function monthlyCapForPlan(plan?: string | null): number {
  if (!plan) return GOBLIN_DEFAULT_CAP;
  return GOBLIN_MONTHLY_TOKEN_CAPS[plan.toLowerCase()] ?? GOBLIN_DEFAULT_CAP;
}

/**
 * Compute the cap status for a monthly token total. Defensive against bad input
 * (negative, NaN, non-positive cap) so a malformed rollup row can never throw or
 * render a broken bar.
 */
export function computeCapStatus(usedTokens: number, plan?: string | null): CapStatus {
  const used = Number.isFinite(usedTokens) && usedTokens > 0 ? Math.floor(usedTokens) : 0;
  const capRaw = monthlyCapForPlan(plan);
  const cap = Number.isFinite(capRaw) && capRaw > 0 ? capRaw : GOBLIN_DEFAULT_CAP;

  const remainingTokens = Math.max(0, cap - used);
  const rawRatio = used / cap;
  const ratio = Math.min(1, Math.max(0, rawRatio));
  const percent = Math.round(ratio * 100);

  let state: CapState = 'ok';
  if (used >= cap) state = 'over';
  else if (rawRatio >= GOBLIN_CAP_WARN_RATIO) state = 'warn';

  return { usedTokens: used, capTokens: cap, remainingTokens, ratio, percent, state };
}
