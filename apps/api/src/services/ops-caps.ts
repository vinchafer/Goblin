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
  /**
   * PHASE 4 · U4.6 — form submissions per app per UTC MONTH, enforced at the
   * ingest endpoint.
   *
   * ── Why a second dimension and not a second number on the first ─────────────
   * `dailyRequests` defends the FLEET's shared allowance: one app must not be able
   * to eat every other app's serving budget. This one defends something else
   * entirely — the storage the platform is holding on behalf of strangers, and the
   * e-mail volume a single form can generate. They have different units, different
   * enforcement points and different failure modes, so they are different fields.
   *
   * ── The DIFFERENT enforcement point, stated because it is easy to miss ──────
   * `dailyRequests` is enforced at the ROUTER, out of the KV record, with no
   * database round-trip. A monthly number cannot be: it needs a counter that
   * survives a month, and the router's KV day-counter expires after 48 hours. So
   * this one is counted where the submission is stored — in the app's own database
   * (`usage_months`) — which is also the only place that can count it exactly once.
   *
   * ── The number (P4-c) ───────────────────────────────────────────────────────
   * 500/month is a PLANNING NUMBER, not a measured one, and the founder has not
   * ratified it. It is here rather than in a constant somewhere so it can be
   * retuned for the whole fleet without a deploy of anything but this file, exactly
   * as 10.000/day can. Where it comes from: at ten form apps (the D1 free-plan
   * ceiling) it is 5.000 rows a month against a free allowance of 100.000 rows
   * WRITTEN PER DAY — three orders of magnitude of headroom, so the number is not
   * defending the Cloudflare bill. It is defending the owner's inbox and the
   * plausibility of a beta contact form. A real business hitting 500 leads a month
   * through a Goblin form is a conversation, not an incident.
   */
  monthlySubmissions: number;
  /** Human-readable, for the report and any future UI. */
  description: string;
}

export const DEFAULT_CAPS_PROFILE = 'free-static';

export const CAPS_PROFILES: Record<string, CapsProfile> = {
  'free-static': {
    dailyRequests: 10_000,
    monthlySubmissions: 500,
    description:
      'Beta-Profil: statische App auf dem kostenlosen Kontingent, 10.000 Aufrufe pro Tag '
      + 'und 500 Formular-Einsendungen pro Monat.',
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

/**
 * The monthly submission ceiling for a profile name.
 *
 * Same rule as above, and it matters more here: an UNKNOWN profile falls back to
 * the DEFAULT, never to "unlimited". A typo in a column must not be the reason an
 * app can accept an unbounded amount of other people's personal data.
 */
export function monthlySubmissionBudget(capsProfile: string | null | undefined): number {
  const profile = CAPS_PROFILES[(capsProfile ?? '').trim() || DEFAULT_CAPS_PROFILE];
  return (profile ?? CAPS_PROFILES[DEFAULT_CAPS_PROFILE]!).monthlySubmissions;
}
