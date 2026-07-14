// F-05 (FIX-WAVE 3) — the single onboarding-gate decision.
//
// THE BUG (reproduced in shape, pinned in code): a post-onboarding flicker-loop.
// Two guards read the SAME `onboarding_steps.completed` flag through DIFFERENT
// Supabase clients on the onboarding-exit path:
//   • BACK leg  — app/dashboard/layout.tsx (server, USER-scoped SSR client, RLS
//                 applied): reads falsy → redirect('/welcome/language').
//   • FWD  leg  — app/welcome/_components/chrome.tsx (client, API SERVICE-ROLE
//                 read, RLS bypassed): reads true → router.replace('/dashboard').
// The completion write (welcome/build → PUT /api/onboarding/state) is done by the
// service role and is best-effort/async. In the window between that write
// committing and it becoming visible to the user-scoped SSR read — replication
// lag, or a straight RLS read-asymmetry that hides the row from the user client —
// the back leg reads stale-false and bounces to /welcome, the forward leg reads
// fresh-true and bounces to /dashboard: an endless oscillation. It only fires for
// `isNewUser` (< 10 min old) accounts, i.e. exactly the post-onboarding moment,
// which is why the founder saw it right after finishing and escaped by typing
// /dashboard manually.
//
// THE FIX: a synchronous handshake the server guard can trust in the SAME
// navigation, independent of DB replication/RLS. On completion the client sets a
// short-lived `goblin_onboarded` cookie (see ONBOARDED_COOKIE) BEFORE navigating;
// the dashboard guard treats its presence as authoritative "already onboarded"
// and never bounces back. This is a grace state that never bounces backward: once
// completion has been signalled this session the back leg is dead, so the loop is
// mathematically impossible even while the DB read is still stale. The cookie is
// honest — it means "this user finished the onboarding flow" (they clicked
// Finish), a client fact, not a claim that any server write persisted.
//
// Pure and deterministic → unit-testable without a session (the F-05 gate).

export interface OnboardingGateInput {
  /** Account created within the new-user window (< 10 min). Only new users are gated. */
  isNewUser: boolean;
  /** Reactivated (un-deleted) account — a returning user, never replay onboarding. */
  isReactivated: boolean;
  /** onboarding_steps.completed as read by the user-scoped SSR client (may be stale/RLS-filtered). */
  onboardingCompleted: boolean;
  /** The synchronous completion signal (goblin_onboarded cookie present). The loop-breaker. */
  justOnboarded: boolean;
}

export interface OnboardingGateResult {
  /** When true, the dashboard layout redirects the user to /welcome/language. */
  redirectToOnboarding: boolean;
}

/**
 * The back-leg decision. Redirect a fresh user into onboarding ONLY when every
 * "still needs onboarding" condition holds AND we have no trustworthy signal that
 * they just finished. `justOnboarded` (the cookie) short-circuits the redirect so
 * a stale/RLS-filtered `onboardingCompleted === false` can never re-open the loop.
 */
export function resolveOnboardingGate(input: OnboardingGateInput): OnboardingGateResult {
  const { isNewUser, isReactivated, onboardingCompleted, justOnboarded } = input;

  // Loop-breaker: once completion has been signalled this session, the back leg
  // is permanently dead — regardless of what the (possibly stale) DB read says.
  if (justOnboarded) return { redirectToOnboarding: false };

  if (!isNewUser) return { redirectToOnboarding: false };
  if (isReactivated) return { redirectToOnboarding: false };
  if (onboardingCompleted) return { redirectToOnboarding: false };

  return { redirectToOnboarding: true };
}

/**
 * The completion cookie contract. `path=/` so both the /welcome (forward-leg) and
 * /dashboard (back-leg) origins see it; a 30-minute max-age comfortably outlasts
 * any realistic replication lag yet self-expires once the DB is consistent, after
 * which the normal completed-flag read takes over. SameSite=Lax so it rides the
 * top-level navigation into the dashboard.
 */
export const ONBOARDED_COOKIE = {
  name: 'goblin_onboarded',
  value: '1',
  maxAgeSeconds: 30 * 60,
} as const;

/** The exact document.cookie string the client writes on onboarding completion. */
export function onboardedCookieString(): string {
  return `${ONBOARDED_COOKIE.name}=${ONBOARDED_COOKIE.value}; path=/; max-age=${ONBOARDED_COOKIE.maxAgeSeconds}; SameSite=Lax`;
}
