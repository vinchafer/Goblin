/**
 * Goblin-hosted (Layer 2) TELEMETRY — pure aggregation + reconciliation. No network.
 *
 * SESSION 4 (HR-1 — "must hold 1000%"): every Goblin-hosted inference call is one
 * `completion_costs` row carrying user_id, created_at (ts → date/month derivable),
 * model (= the tier id 'goblin/efficient' = Swift | 'goblin/premium' = Forge →
 * tier derivable), tokens_in, tokens_out and cost_usd. This module turns a month's
 * rows into the founder's operating view AND proves the one invariant that must
 * never break: the spend the founder pays (raw tokens → weighted cost units) is the
 * SAME number the user's cap counts.
 *
 *   completion_costs raw tokens  ==  telemetry per-user rollup  ==  cap rollup
 *
 * The cap (lib/goblin-cap.ts) weights Swift + Forge×FORGE_WEIGHT into cost units.
 * The telemetry rollup re-aggregates the SAME rows per user and weights them with
 * the SAME function — so a divergence can only mean a row was dropped, double
 * counted, or mis-classified. `reconcile()` asserts there is none.
 *
 * Two-level truth (HR-3): aggregates by user id only — never email/name. Carries NO
 * provider name, NO model slug. The estimated $ cost lives here because the founder
 * view is the ONLY surface allowed to show it (his own operating data).
 *
 * Zero/unknown provider tokens (HR-1): a call whose provider returned 0/unknown
 * tokens is NEVER dropped — its row is recorded with tokens 0 and surfaced here via
 * `zeroTokenCompletions` (the explicit "recorded as zero, flagged" count).
 */

import { weightedCostUnits, nextMonthlyResetISO, type CapState } from './goblin-cap';

/** One Goblin-hosted completion row (the subset telemetry needs). */
export interface CompletionRow {
  user_id: string;
  /** The tier id stored in completion_costs.model ('goblin/efficient' | 'goblin/premium'). */
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  created_at: string;
}

export type GoblinTier = 'swift' | 'forge';

/** Classify a completion_costs.model value into a Goblin tier. Forge = premium. */
export function tierOf(model: string): GoblinTier {
  return model === 'goblin/premium' ? 'forge' : 'swift';
}

export interface UserRollup {
  userId: string;
  plan: string;
  swiftTokens: number;
  forgeTokens: number;
  tokens: number;
  /** Weighted cost units for this user (Swift + Forge×4.4) — the cap's unit. */
  weightedUnits: number;
  completions: number;
  /** Completions whose provider reported 0 tokens (recorded, never dropped). */
  zeroTokenCompletions: number;
  estimatedCostUsd: number;
}

export interface Reconciliation {
  /** Raw (tokens_in + tokens_out) summed straight off the rows. */
  completionCostsTokens: number;
  /** Same raw total re-summed from the per-user rollups. */
  telemetryTokens: number;
  /** Weighted cost units from the grand Swift/Forge totals (what the cap charges). */
  capRollupUnits: number;
  /** Weighted cost units re-summed from the per-user rollups. */
  telemetryRollupUnits: number;
  /** True ⇔ all three agree exactly. A false here is a tracking bug (HR-1). */
  consistent: boolean;
}

export interface TelemetrySummary {
  /** First-of-month ISO (UTC) for the window these rows belong to. */
  month: string;
  /** ISO date the monthly allowance resets (start of next month). */
  resetDate: string;
  totalSwiftTokens: number;
  totalForgeTokens: number;
  totalTokens: number;
  /** Weighted cost units across all users — internal economics (founder only). */
  weightedCostUnits: number;
  /** Estimated wholesale $ (sum of cost_usd) — FOUNDER-ONLY surface (HR-2/HR-3). */
  estimatedCostUsd: number;
  activeUsers: number;
  completions: number;
  /** Completions recorded with zero provider tokens (flagged, never dropped). */
  zeroTokenCompletions: number;
  /** Mean raw tokens per active user (0 when no users). */
  avgTokensPerUser: number;
  /** Active-user count per plan bucket. */
  planDistribution: Record<string, number>;
  /** Heaviest users by weighted cost units (by user id — no PII). */
  topUsers: UserRollup[];
  reconciliation: Reconciliation;
}

const PLAN_BUCKETS = ['trial', 'build', 'pro', 'power'] as const;

/** Normalize a plan string into a known bucket, else 'other'. */
function planBucket(plan?: string | null): string {
  const p = (plan ?? '').toLowerCase();
  return (PLAN_BUCKETS as readonly string[]).includes(p) ? p : 'other';
}

/**
 * Aggregate a month's Goblin-hosted completion rows into the founder telemetry
 * summary, with a built-in reconciliation proof. Pure + defensive: malformed token
 * values are floored to 0 (never NaN/negative) so a single bad row can't poison the
 * totals or throw.
 *
 * @param rows    completion_costs rows already scoped to source_tier='goblin_hosted'
 *                and the target month.
 * @param planByUser  user_id → subscription plan (for the plan distribution).
 * @param topN    how many heaviest users to surface (default 10).
 * @param now     clock injection for the reset date (tests).
 */
export function aggregateTelemetry(
  rows: CompletionRow[],
  planByUser: Record<string, string> = {},
  topN = 10,
  now: Date = new Date(),
): TelemetrySummary {
  const byUser = new Map<string, UserRollup>();

  let totalSwift = 0;
  let totalForge = 0;
  let totalCost = 0;
  let completions = 0;
  let zeroToken = 0;

  for (const r of rows ?? []) {
    const tin = Number.isFinite(r.tokens_in) && r.tokens_in > 0 ? Math.floor(r.tokens_in) : 0;
    const tout = Number.isFinite(r.tokens_out) && r.tokens_out > 0 ? Math.floor(r.tokens_out) : 0;
    const tok = tin + tout;
    const cost = Number.isFinite(r.cost_usd) && r.cost_usd > 0 ? r.cost_usd : 0;
    const tier = tierOf(r.model);

    completions += 1;
    totalCost += cost;
    if (tok === 0) zeroToken += 1;
    if (tier === 'forge') totalForge += tok; else totalSwift += tok;

    let u = byUser.get(r.user_id);
    if (!u) {
      u = {
        userId: r.user_id,
        plan: planBucket(planByUser[r.user_id]),
        swiftTokens: 0, forgeTokens: 0, tokens: 0,
        weightedUnits: 0, completions: 0, zeroTokenCompletions: 0, estimatedCostUsd: 0,
      };
      byUser.set(r.user_id, u);
    }
    if (tier === 'forge') u.forgeTokens += tok; else u.swiftTokens += tok;
    u.tokens += tok;
    u.completions += 1;
    if (tok === 0) u.zeroTokenCompletions += 1;
    u.estimatedCostUsd += cost;
  }

  // Per-user weighted units (after all rows accumulated, weight once per user).
  for (const u of byUser.values()) {
    u.weightedUnits = weightedCostUnits(u.swiftTokens, u.forgeTokens);
    u.estimatedCostUsd = Number(u.estimatedCostUsd.toFixed(6));
  }

  const users = [...byUser.values()];
  const activeUsers = users.length;
  const totalTokens = totalSwift + totalForge;

  // Plan distribution over ACTIVE users (one bucket each).
  const planDistribution: Record<string, number> = { trial: 0, build: 0, pro: 0, power: 0, other: 0 };
  for (const u of users) planDistribution[u.plan] = (planDistribution[u.plan] ?? 0) + 1;

  const topUsers = [...users].sort((a, b) => b.weightedUnits - a.weightedUnits).slice(0, topN);

  // ── Reconciliation (HR-1): three independent paths must match ───────────────
  const completionCostsTokens = totalTokens; // raw straight off the rows
  const telemetryTokens = users.reduce((s, u) => s + u.tokens, 0);
  const capRollupUnits = weightedCostUnits(totalSwift, totalForge);
  // Re-aggregate the per-user RAW splits, then weight once — identical to the cap
  // path when no rows were dropped/double-counted/mis-tiered.
  const reSwift = users.reduce((s, u) => s + u.swiftTokens, 0);
  const reForge = users.reduce((s, u) => s + u.forgeTokens, 0);
  const telemetryRollupUnits = weightedCostUnits(reSwift, reForge);
  const consistent =
    completionCostsTokens === telemetryTokens && capRollupUnits === telemetryRollupUnits;

  return {
    month: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10),
    resetDate: nextMonthlyResetISO(now),
    totalSwiftTokens: totalSwift,
    totalForgeTokens: totalForge,
    totalTokens,
    weightedCostUnits: capRollupUnits,
    estimatedCostUsd: Number(totalCost.toFixed(6)),
    activeUsers,
    completions,
    zeroTokenCompletions: zeroToken,
    avgTokensPerUser: activeUsers > 0 ? Math.round(totalTokens / activeUsers) : 0,
    planDistribution,
    topUsers,
    reconciliation: {
      completionCostsTokens,
      telemetryTokens,
      capRollupUnits,
      telemetryRollupUnits,
      consistent,
    },
  };
}

// Re-export for consumers that render cap state alongside telemetry.
export type { CapState };
