// Public, user-facing "≈ N Builds / month" proxy for each plan's Goblin allowance.
//
// TWO-LEVEL TRUTH (HR-1/HR-6): the real limit is a weighted monthly allowance defined
// SERVER-SIDE in apps/api/src/lib/goblin-cap.ts. The internal economics (token/weight/
// $/provider) live there and never reach the client — including this file. Here we keep
// ONLY the rounded, public Build figures. The exact derivation (each plan's allowance ÷
// a single documented divisor, COST_UNITS_PER_BUILD) lives next to the allowances in
// goblin-cap.ts; if real telemetry shifts the average, change it there and update the
// rounded figures below.
//
//   trial  ≈ 100 Builds      build ≈ 350 Builds
//   pro    ≈ 600 Builds      power ≈ 1,200 Builds
//
// Deliberately CONSERVATIVE (the divisor under-counts rather than over-promises) and
// ascending (no Build > Pro inversion). These are intentionally lower than the retired
// "200 / 800 / 3,000 AI requests" copy — that metric over-promised at the cap. The
// Build figure is honest to the weighted allowance. Round numbers + "≈" by design;
// never invent precision.

export const PLAN_BUILDS: Record<'trial' | 'build' | 'pro' | 'power', number> = {
  trial: 100,
  build: 350,
  pro: 600,
  power: 1200,
};

/** Localized "≈ N Builds / month" feature line. DE/EN parity; "Builds" is a loanword. */
export function buildsPerMonth(plan: keyof typeof PLAN_BUILDS, lang: 'de' | 'en'): string {
  const n = PLAN_BUILDS[plan].toLocaleString(lang === 'en' ? 'en-US' : 'de-DE');
  return lang === 'en' ? `≈ ${n} Builds / month` : `≈ ${n} Builds / Monat`;
}
