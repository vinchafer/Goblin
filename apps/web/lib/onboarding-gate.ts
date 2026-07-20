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

// ── F-05 · standalone hardening (Founder-Walk-1, U1) ─────────────────────────
//
// THE STANDALONE BUG. The handshake above has ONE channel: a client-written
// `document.cookie` that the SSR dashboard guard must read back on the very next
// navigation. In an installed iOS PWA (standalone WebKit) that JS-written cookie
// is not reliably visible to that same-navigation server read — standalone applies
// stricter/partitioned cookie storage + ITP than a Safari tab, and the client
// write may not be committed/sent before the RSC navigation request fires. When
// the sole loop-breaker goes missing, the dashboard guard sees no cookie AND a
// stale `completed === false`, redirects to /welcome, the forward leg reads
// fresh-true (service role) and bounces back — the welcome↔dashboard oscillation
// the FW3 fix was meant to kill. It matches the founder's report exactly: installed
// PWA loops on a spinner and never reaches the dashboard, yet the SAME account in a
// Safari tab (where the JS cookie IS sent) lands on the dashboard, and onboarding
// completion persisted (the DB write is independent of the failed transition).
//
// THE FIX (extend F-05, don't fork). Add a SECOND, storage-independent channel
// that rides the navigation itself and cannot be lost to cookie partitioning: a
// `?onboarded=1` query signal on the post-onboarding navigation. `middleware.ts`
// promotes it into the SAME `goblin_onboarded` cookie — set on both the forwarded
// request (so the dashboard layout sees it THIS pass) and the response (so it
// persists, server-committed, which standalone WebKit does honor). Same cookie,
// same gate — just a channel a PWA can't silently drop. It also hardens the two
// other candidate causes: the middleware↔flag bounce (broken positively here) and
// a stale user-scoped read (the URL signal is authoritative, DB-independent).

/** Query param + value carrying the storage-independent "just finished" signal. */
export const ONBOARDED_SIGNAL_PARAM = 'onboarded';
export const ONBOARDED_SIGNAL_VALUE = '1';

/**
 * The exact URL the client navigates to on onboarding completion. Carries the
 * signal in the navigation itself so it survives standalone WebKit's cookie
 * quirks; the JS cookie is still written as the fast path.
 */
export const DASHBOARD_ONBOARDED_URL = `/dashboard?${ONBOARDED_SIGNAL_PARAM}=${ONBOARDED_SIGNAL_VALUE}`;

/** True when a navigation carries the storage-independent completion signal. */
export function hasOnboardedSignal(searchParams: URLSearchParams): boolean {
  return searchParams.get(ONBOARDED_SIGNAL_PARAM) === ONBOARDED_SIGNAL_VALUE;
}

/**
 * The middleware promotion decision (pure, testable). Promote the URL signal into
 * the durable server-set cookie exactly when the signal is present and the cookie
 * isn't already set — converting the fragile, storage-independent URL channel into
 * the reliable, server-committed cookie the back-leg guard already trusts. Idempotent:
 * once the cookie exists there is nothing to promote.
 */
export function shouldPromoteOnboardedCookie(input: {
  searchParams: URLSearchParams;
  cookieAlreadySet: boolean;
}): boolean {
  return hasOnboardedSignal(input.searchParams) && !input.cookieAlreadySet;
}
