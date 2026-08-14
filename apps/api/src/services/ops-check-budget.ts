/**
 * AKT 2 · PHASE 5 · U5.1 — the cadence, derived from the request budget.
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * THE FAN-OUT SHAPE, AND THE NUMBER THE PROMPT GOT WRONG.
 *
 * Spike finding F2 says K0 must be ONE scheduled fan-out over the app list, never
 * one cron trigger per app. The Phase-5 prompt gives the ceiling as 250 triggers
 * per account. `docs/OPS_SPIKE_0_DECISION_TABLE.md` §2 — retrieved 2026-07-25 from
 * Cloudflare's own limits page — says:
 *
 *     Cron Triggers | Account-level limit: 5 (Free) / 250 (Paid).
 *
 * Goblin runs Workers FREE (founder decision D2-amended 2026-07-27, ledger M-H1).
 * The ceiling that binds us is FIVE. A trigger per Living App would break at five
 * apps, not at two hundred and fifty — the finding is an order of magnitude more
 * urgent than the prompt believed, and it is why the number below is zero.
 *
 * THIS PHASE USES 0 OF 5 CRON TRIGGERS. The fan-out runs in the Railway API process
 * that is already always-on, already next to the registry, and already holds the
 * credentials — so there is no second deploy surface and no shared secret between a
 * Worker and the platform API. See docs/ACT2_PHASE5_DECISIONS.md §P5-a.
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * ── What this module defends ────────────────────────────────────────────────────
 * Workers Free hard-stops at 100.000 requests/day ACCOUNT-WIDE, shared by every
 * Living App and the router (cf-deploy.ts:16, ledger M-H1 — which carries its own
 * provenance warning: that figure is inherited from the lean-substrate decision
 * record and was not re-fetched from live docs).
 *
 * The spike measured the consequence from the other side (§2.2, profile B): 8.640 of
 * a typical app's 10.640 monthly requests — 81,2 % — are Goblin's own heartbeat. At
 * low traffic, which is MOST Living Apps, the monitoring IS the load. So the cadence
 * is a genuine cost lever and is treated as one here rather than hard-coded to five
 * minutes and forgotten.
 */

/**
 * The fleet's daily request ceiling on Workers Free, account-wide.
 *
 * INHERITED, not re-verified in this session — same provenance caveat M-H1 carries.
 * It is a constant here so that the day it is re-checked, one edit moves every
 * number this module derives.
 */
export const FLEET_DAILY_REQUEST_LIMIT = 100_000;

/**
 * The share of that ceiling the heartbeat is allowed to spend: 5 %.
 *
 * Why not more: the heartbeat must never crowd out real traffic. The ceiling is
 * account-wide, so every request we spend watching is a request an actual visitor
 * cannot make. Five per cent is generous inside the beta radius and small enough
 * that our own watching can never be the reason an app goes dark at 23:00 UTC.
 *
 * Why not less: below roughly this share the cadence at even a handful of apps
 * stretches past the point where "heartbeat" is an honest word for it.
 */
export const HEARTBEAT_DAILY_REQUEST_BUDGET = 5_000;

/** The fastest we will ever check. Faster buys nothing a builder can act on. */
export const MIN_CADENCE_MINUTES = 5;

/**
 * The slowest we will ever check — and the point at which the runner starts SAYING
 * it is over budget instead of stretching further.
 *
 * Past an hour, detection (two cycles, so up to two hours) stops being something
 * anybody should call a heartbeat. Stretching silently past this would keep the
 * arithmetic tidy while quietly turning the product into something else.
 */
export const MAX_CADENCE_MINUTES = 60;

const MINUTES_PER_DAY = 1440;

/** Round up to the next multiple of five, so the cadence is a number a human says. */
function roundUpToFive(minutes: number): number {
  return 5 * Math.ceil(minutes / 5);
}

export interface CadencePlan {
  /** Minutes between checks of one app. */
  cadenceMinutes: number;
  /** Requests this plan sends through the router per day, at this fleet size. */
  requestsPerDay: number;
  /** That figure as a share of the account's daily ceiling, 0..1. */
  shareOfFleetLimit: number;
  /**
   * TRUE when the cadence has hit `MAX_CADENCE_MINUTES` and the fleet is still big
   * enough to exceed the budget. The runner keeps working — it does not stop
   * watching apps because a number went red — but it REPORTS this, the console
   * shows it, and it becomes founder decision G-P5-1 (raise the share, go Workers
   * Paid at $5/month, or stretch the cadence and change what we promise).
   *
   * The alternative — quietly overrunning — is how a budget becomes a surprise.
   */
  overBudget: boolean;
}

/**
 * The cadence for a given number of ACTIVE apps.
 *
 *     cadence = clamp( roundUpToFive( apps × 1440 / budget ), 5 … 60 )
 *
 * Only apps that are actually being checked count. Suspended, failed and torn-down
 * apps are not checked (the runner filters them), so counting them here would make
 * the fleet look busier than it is and slow the checks down for no reason.
 *
 * Bands at the shipped constants — held by ops-check-budget.test.ts, and the same
 * arithmetic the decisions document tabulates:
 *
 *     1–17 apps → 5 min · 18–34 → 10 · 35–52 → 15 · … · 191–208 → 60 · ≥209 over budget
 */
export function cadenceFor(activeAppCount: number): CadencePlan {
  const apps = Math.max(0, Math.floor(activeAppCount));
  if (apps === 0) {
    // Nothing to check. The cadence is still reported (the console shows it), and
    // it is the floor rather than zero — there is no "infinite cadence".
    return { cadenceMinutes: MIN_CADENCE_MINUTES, requestsPerDay: 0, shareOfFleetLimit: 0, overBudget: false };
  }
  const ideal = (apps * MINUTES_PER_DAY) / HEARTBEAT_DAILY_REQUEST_BUDGET;
  const cadenceMinutes = Math.min(MAX_CADENCE_MINUTES, Math.max(MIN_CADENCE_MINUTES, roundUpToFive(ideal)));
  const requestsPerDay = requestsPerDayFor(apps, cadenceMinutes);
  return {
    cadenceMinutes,
    requestsPerDay,
    shareOfFleetLimit: requestsPerDay / FLEET_DAILY_REQUEST_LIMIT,
    overBudget: requestsPerDay > HEARTBEAT_DAILY_REQUEST_BUDGET,
  };
}

/**
 * The formula, exported so the ledger, the console and the tests all quote the same
 * one instead of three copies that can drift:
 *
 *     requests/day = active apps × (1440 / cadence minutes) × API instances
 *
 * The instance factor is NOT applied here, and its absence is deliberate rather
 * than forgotten: the runner is in-process, so N Railway instances run N fan-outs
 * and the true volume is N times this. Nothing in this codebase can currently
 * observe the instance count, and multiplying by a guess would be worse than
 * stating the shape. It is stated — in the ledger row M-K1, in the decisions
 * document §P5-a, and in the carry-forward register.
 */
export function requestsPerDayFor(activeAppCount: number, cadenceMinutes: number): number {
  if (activeAppCount <= 0 || cadenceMinutes <= 0) return 0;
  return Math.round(activeAppCount * (MINUTES_PER_DAY / cadenceMinutes));
}
