// F-32 (FIX-WAVE 3) — the purchase-confirmation moment's decision + content.
//
// D-A moved the trial banner's "your app is live, keep building" emotion here: a
// single celebratory confirmation the first time a purchase is VERIFIED. The
// honesty invariant is the whole point — we celebrate ONLY the webhook-confirmed
// plan flip (billing status planState === 'paid'), NEVER the checkout redirect,
// so a failed or still-pending checkout can never trigger a false celebration.
//
// "Show once" is keyed on the plan the user last acknowledged (a per-plan marker):
// the moment fires on the transition into a paid plan and not again for that plan.
//
// Pure + deterministic → unit-testable without a session (the F-32 gate).

import { PLAN_BUILDS } from './plan-builds';
import { STORAGE_GB } from './plan-storage';
import { t, type Lang } from './use-lang';

export type PaidPlan = 'build' | 'pro' | 'power';
const PAID_PLANS: readonly PaidPlan[] = ['build', 'pro', 'power'];

export function isPaidPlan(plan: string | null | undefined): plan is PaidPlan {
  return !!plan && (PAID_PLANS as readonly string[]).includes(plan);
}

export interface ConfirmationGateInput {
  /** billing status planState — the DERIVED, webhook-confirmed truth. */
  planState: 'comped' | 'paid' | 'trial' | 'none' | undefined;
  /** billing status plan key. */
  plan: string | null | undefined;
  /** The plan the user last saw the confirmation for (per-plan seen marker); null if none. */
  lastConfirmedPlan: string | null;
}

export interface ConfirmationGateResult {
  show: boolean;
  plan: PaidPlan | null;
}

/**
 * Decide whether to show the purchase-confirmation moment. TRUE only when the
 * subscription is VERIFIED paid (planState==='paid') for a real paid plan the
 * user hasn't been congratulated on yet. Everything else — trial, none, comped,
 * an unknown/undefined state (still-pending or failed checkout) — is FALSE.
 */
export function shouldShowPurchaseConfirmation(input: ConfirmationGateInput): ConfirmationGateResult {
  const { planState, plan, lastConfirmedPlan } = input;
  if (planState !== 'paid') return { show: false, plan: null };   // never celebrate an unverified purchase
  if (!isPaidPlan(plan)) return { show: false, plan: null };
  if (lastConfirmedPlan === plan) return { show: false, plan: null }; // already celebrated this plan
  return { show: true, plan };
}

/** Human plan name for the headline. */
export function planDisplayName(plan: PaidPlan): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1); // Build / Pro / Power
}

/**
 * The "what's now unlocked" lines — REAL numbers pulled from the single sources
 * (PLAN_BUILDS, STORAGE_GB), never hardcoded, so they can't drift from what the
 * server enforces. Builds is an honest estimate ("≈ … je nach Komplexität").
 */
export function unlockedFeatures(plan: PaidPlan, lang: Lang): string[] {
  const builds = PLAN_BUILDS[plan].toLocaleString(lang === 'en' ? 'en-US' : 'de-DE');
  const gb = STORAGE_GB[plan];
  return [
    t(lang, `≈ ${builds} Builds / Monat — je nach Komplexität`, `≈ ${builds} builds / month — varies by complexity`),
    t(lang, `${gb} GB Cloud-Speicher`, `${gb} GB cloud storage`),
    t(lang, 'Unbegrenzte Projekte', 'Unlimited projects'),
    t(lang, 'BYOK — alle Provider, kein Goblin-Limit', 'BYOK — every provider, no Goblin limit'),
  ];
}
