'use client';

// F-05 · FOUNDER-WALK-3 U1 — the single onboarding-completion transition.
//
// One mechanism, every completion path. Before this, each finish path did its own
// `document.cookie = …; await patchOnboardingState(…); router.push(…)` — and the
// AWAIT was the wedge: a suspended cross-origin fetch in a backgrounded PWA never
// settled, so the navigation carrying ?onboarded=1 never fired and the spinner
// hung forever (the founder's P0 regression). See lib/onboarding-gate.ts for the
// full diagnosis. This module makes the transition unwedgeable:
//   • the completion cookie is still written first (the fast path),
//   • the best-effort write is RACED against a budget so it can never block the nav,
//   • the navigation ALWAYS carries the ?onboarded=1 signal (fixes the old bare
//     /dashboard integrations path too),
//   • a watchdog HARD-navigates if the soft navigation is still stuck on /welcome.

import {
  onboardedCookieString,
  DASHBOARD_ONBOARDED_URL,
  ONBOARDING_MUTATION_BUDGET_MS,
  ONBOARDING_WATCHDOG_MS,
  shouldForceOnboardingNavigation,
} from './onboarding-gate';

type Navigate = (url: string) => void;

/**
 * Resolve `p`, or resolve `undefined` after `ms` — whichever comes first. Never
 * rejects (a rejected `p` resolves `undefined`) and never hangs. This is what
 * keeps a stalled completion fetch from wedging the post-onboarding navigation.
 */
export function withBudget<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([
    Promise.resolve(p).catch(() => undefined),
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms)),
  ]);
}

/**
 * Arm the transition watchdog. After ONBOARDING_WATCHDOG_MS, if the app is still
 * on a /welcome path (the soft navigation never resolved — a suspended PWA, a
 * hung RSC fetch, a dropped cookie), hard-navigate to the dashboard WITH the
 * signal. A full-document request is the one channel standalone WebKit can't drop,
 * and middleware promotes ?onboarded=1 into the durable cookie on it. Invisible
 * when the soft navigation works (the guard sees /dashboard and no-ops).
 */
export function armOnboardingWatchdog(): void {
  if (typeof window === 'undefined') return;
  window.setTimeout(() => {
    try {
      if (shouldForceOnboardingNavigation(window.location.pathname)) {
        window.location.assign(DASHBOARD_ONBOARDED_URL);
      }
    } catch {
      /* ignore — best-effort belt-and-braces */
    }
  }, ONBOARDING_WATCHDOG_MS);
}

/**
 * Complete onboarding and enter the dashboard. Shared by every completion path
 * (welcome/build finish, welcome/integrations finish, the chrome forward-leg).
 *
 * @param mutation  the best-effort persistence promise (patchOnboardingState);
 *                  raced against a budget, never awaited to completion.
 * @param navigate  the soft navigation (router.push / router.replace). Always
 *                  called with DASHBOARD_ONBOARDED_URL so the signal is carried.
 */
export async function completeOnboarding(opts: {
  mutation?: Promise<unknown>;
  navigate: Navigate;
}): Promise<void> {
  // 1. Fast-path handshake cookie — the server guard trusts it same-navigation.
  if (typeof document !== 'undefined') {
    try { document.cookie = onboardedCookieString(); } catch { /* ignore */ }
  }
  // 2. Best-effort write, but NEVER block the transition on it. A stalled fetch
  //    resolves to undefined at the budget and we navigate regardless.
  if (opts.mutation) {
    await withBudget(opts.mutation, ONBOARDING_MUTATION_BUDGET_MS);
  }
  // 3. Soft navigation, always carrying ?onboarded=1.
  opts.navigate(DASHBOARD_ONBOARDED_URL);
  // 4. Belt-and-braces: force a hard navigation if we're still stuck on /welcome.
  armOnboardingWatchdog();
}
