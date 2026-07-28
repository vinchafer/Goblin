/**
 * AKT 2 · PHASE 2 · U2.6 — cap profiles (spike finding F3: denial-of-wallet).
 *
 * 0099 stores a cap profile as a NAME, not as numbers, precisely so the numbers can
 * live here: tunable without a migration, and retunable for the whole fleet at once.
 *
 * ── What is actually being defended ──────────────────────────────────────────
 * Not the Workers bill. Workers Free does not overspend — it HARD STOPS at 100,000
 * requests/day for the whole account, which is the accepted cost ceiling by design
 * (cf-deploy.ts header, ledger M-H1). The exposure is different and sharper:
 *
 *   1. One app can eat the whole plane. 100k/day is a FLEET budget. Without a
 *      per-app limit, a single app under a traffic flood — or one hostile person
 *      with a loop — takes every other builder's app down with it. The per-app
 *      budget is mostly about the OTHER apps.
 *   2. R2 Class B operations. R2 charges no egress, but reads are billable past the
 *      free tier, and every served file is a read. That is the part of this that
 *      can actually produce an invoice.
 *
 * ── The arithmetic, stated rather than implied ───────────────────────────────
 * At 10,000 requests/day per app, ten simultaneously-busy apps exhaust the account's
 * daily Workers allowance. During a beta with a handful of allowlisted apps that is
 * the right trade — generous enough that no honest app ever notices, small enough
 * that one app cannot silently become the whole bill. It is a founder-tunable
 * number, not a law, and the moment the beta widens it should be revisited.
 */

export interface CapsProfile {
  /** Requests per app per UTC day, enforced at the router. */
  dailyRequests: number;
  /** Human-readable, for the report and any future UI. */
  description: string;
}

export const DEFAULT_CAPS_PROFILE = 'free-static';

export const CAPS_PROFILES: Record<string, CapsProfile> = {
  'free-static': {
    dailyRequests: 10_000,
    description: 'Beta-Profil: statische App auf dem kostenlosen Kontingent, 10.000 Aufrufe pro Tag.',
  },
};

/**
 * The daily request budget for a profile name.
 *
 * An UNKNOWN profile falls back to the default rather than to "unlimited". A typo
 * in a column must never be the reason an app has no ceiling — that is the failure
 * this whole unit exists to prevent, and it would be silent.
 */
export function dailyRequestBudget(capsProfile: string | null | undefined): number {
  const profile = CAPS_PROFILES[(capsProfile ?? '').trim() || DEFAULT_CAPS_PROFILE];
  return (profile ?? CAPS_PROFILES[DEFAULT_CAPS_PROFILE]!).dailyRequests;
}
