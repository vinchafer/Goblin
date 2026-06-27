// Public, user-facing "≈ N Builds / month" proxy for each plan's Goblin allowance.
//
// TWO-LEVEL TRUTH (HR-1/HR-6): the real limit is a weighted monthly allowance defined
// SERVER-SIDE in apps/api/src/lib/goblin-cap.ts. The internal economics (token/weight/
// $/provider) live there and never reach the client. Here we keep ONLY the rounded,
// public Build figures — and we DERIVE them from the same two numbers the server uses
// (each plan's allowance ÷ COST_UNITS_PER_BUILD) so the figures can never drift from
// the server. Mirror those two inputs here; the rounded result is computed, not typed.
//
// COST_UNITS_PER_BUILD is RECONCILED to the CFO dashboard (financial single source of
// truth): one build ≈ 0.15M cost units ("reines Swift"). If telemetry shifts the
// average, change it in goblin-cap.ts AND here (keep them equal) — the rounded figures
// below recompute automatically.
//
//   trial ≈ 33 Builds      build ≈ 116 Builds
//   pro   ≈ 200 Builds     power ≈ 411 Builds

/** Cost units per build — MUST equal apps/api/src/lib/goblin-cap.ts COST_UNITS_PER_BUILD. */
export const COST_UNITS_PER_BUILD = 150_000;

/** Monthly allowance per plan (cost units) — mirrors GOBLIN_MONTHLY_ALLOWANCE (Tier 1). */
const MONTHLY_ALLOWANCE: Record<'trial' | 'build' | 'pro' | 'power', number> = {
  trial: 4_900_000,
  build: 17_400_000,
  pro: 30_000_000,
  power: 61_700_000,
};

/** Rounded "≈ N Builds / month" per plan, derived from the single divisor above. */
export const PLAN_BUILDS: Record<'trial' | 'build' | 'pro' | 'power', number> = {
  trial: Math.round(MONTHLY_ALLOWANCE.trial / COST_UNITS_PER_BUILD),
  build: Math.round(MONTHLY_ALLOWANCE.build / COST_UNITS_PER_BUILD),
  pro: Math.round(MONTHLY_ALLOWANCE.pro / COST_UNITS_PER_BUILD),
  power: Math.round(MONTHLY_ALLOWANCE.power / COST_UNITS_PER_BUILD),
};

/** Localized "≈ N Builds / month" feature line. DE/EN parity; "Builds" is a loanword. */
export function buildsPerMonth(plan: keyof typeof PLAN_BUILDS, lang: 'de' | 'en'): string {
  const n = PLAN_BUILDS[plan].toLocaleString(lang === 'en' ? 'en-US' : 'de-DE');
  return lang === 'en' ? `≈ ${n} Builds / month` : `≈ ${n} Builds / Monat`;
}
