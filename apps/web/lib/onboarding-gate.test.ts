// F-05 (FIX-WAVE 3) GATE — post-onboarding flicker-loop.
//
// These probes lock the back-leg decision (dashboard → /welcome) and prove that
// the synchronous completion handshake makes the oscillation impossible even when
// the DB read is stale/RLS-filtered false — the exact condition that produced the
// endless welcome ↔ dashboard bounce.

import { describe, it, expect } from 'vitest';
import {
  resolveOnboardingGate,
  onboardedCookieString,
  ONBOARDED_COOKIE,
  hasOnboardedSignal,
  shouldPromoteOnboardedCookie,
  DASHBOARD_ONBOARDED_URL,
  shouldForceOnboardingNavigation,
  ONBOARDING_MUTATION_BUDGET_MS,
  ONBOARDING_WATCHDOG_MS,
} from './onboarding-gate';

describe('resolveOnboardingGate — the back leg', () => {
  it('gates a genuine fresh user with no completion signal (the intended redirect)', () => {
    const r = resolveOnboardingGate({
      isNewUser: true, isReactivated: false, onboardingCompleted: false, justOnboarded: false,
    });
    expect(r.redirectToOnboarding).toBe(true);
  });

  it('does NOT redirect once onboarding is completed in the DB', () => {
    const r = resolveOnboardingGate({
      isNewUser: true, isReactivated: false, onboardingCompleted: true, justOnboarded: false,
    });
    expect(r.redirectToOnboarding).toBe(false);
  });

  it('never redirects a user past the new-user window', () => {
    expect(resolveOnboardingGate({
      isNewUser: false, isReactivated: false, onboardingCompleted: false, justOnboarded: false,
    }).redirectToOnboarding).toBe(false);
  });

  it('never replays onboarding for a reactivated (returning) account', () => {
    expect(resolveOnboardingGate({
      isNewUser: true, isReactivated: true, onboardingCompleted: false, justOnboarded: false,
    }).redirectToOnboarding).toBe(false);
  });

  // THE CORE PROBE: the stale read. Right after finishing onboarding the
  // user-scoped SSR read still returns completed=false (replication lag / RLS
  // asymmetry), but the completion cookie is present. The back leg MUST NOT fire.
  it('does NOT bounce during the stale-read window when the handshake cookie is set', () => {
    const r = resolveOnboardingGate({
      isNewUser: true, isReactivated: false,
      onboardingCompleted: false,   // <- STALE: write not yet visible to this client
      justOnboarded: true,          // <- goblin_onboarded cookie present
    });
    expect(r.redirectToOnboarding).toBe(false);
  });
});

describe('the two-guard system reaches a fixed point (no oscillation)', () => {
  // Model both guards as pure functions and iterate. Forward leg (chrome, sees
  // completion via the service-role read) sends /welcome -> /dashboard. Back leg
  // (dashboard) may send /dashboard -> /welcome. We simulate the worst case: the
  // DB read stays STALE-FALSE for the user-scoped client the whole time.
  const backLegRedirects = (route: string, justOnboarded: boolean) => {
    if (route !== '/dashboard') return null;
    const { redirectToOnboarding } = resolveOnboardingGate({
      isNewUser: true, isReactivated: false,
      onboardingCompleted: false, // stays stale-false — the pathological case
      justOnboarded,
    });
    return redirectToOnboarding ? '/welcome/language' : null;
  };
  const forwardLegRedirects = (route: string) => {
    // chrome sees completed=true (service role) on any /welcome* route.
    return route.startsWith('/welcome') ? '/dashboard' : null;
  };

  it('WITHOUT the handshake: the system oscillates (documents the bug)', () => {
    let route = '/dashboard';
    const visited: string[] = [route];
    for (let i = 0; i < 6; i++) {
      const next = route === '/dashboard'
        ? backLegRedirects(route, /* justOnboarded */ false)
        : forwardLegRedirects(route);
      if (!next) break;
      route = next;
      visited.push(route);
    }
    // It never settles: it keeps flipping and hits the iteration cap.
    expect(visited.length).toBeGreaterThan(4);
    expect(visited).toContain('/welcome/language');
    expect(visited).toContain('/dashboard');
  });

  it('WITH the handshake: the system settles on /dashboard immediately', () => {
    let route = '/dashboard';
    const visited: string[] = [route];
    for (let i = 0; i < 6; i++) {
      const next = route === '/dashboard'
        ? backLegRedirects(route, /* justOnboarded */ true)
        : forwardLegRedirects(route);
      if (!next) break;
      route = next;
      visited.push(route);
    }
    // Fixed point reached on the first check — no bounce back to /welcome ever.
    expect(visited).toEqual(['/dashboard']);
  });
});

describe('onboardedCookieString', () => {
  it('writes the path=/ cookie both origins can read, with a self-expiring max-age', () => {
    const s = onboardedCookieString();
    expect(s).toContain(`${ONBOARDED_COOKIE.name}=${ONBOARDED_COOKIE.value}`);
    expect(s).toContain('path=/');
    expect(s).toContain(`max-age=${ONBOARDED_COOKIE.maxAgeSeconds}`);
    expect(s).toContain('SameSite=Lax');
  });
});

// ── F-05 standalone hardening (FOUNDER-WALK-1 U1) ────────────────────────────
//
// The installed-PWA loop. The FW3 handshake had ONE channel — a client-written
// document.cookie the SSR dashboard guard reads back on the next navigation. In a
// standalone PWA (iOS WebKit) that JS cookie is not reliably visible to that
// same-navigation server read, so the sole loop-breaker goes missing and the
// welcome↔dashboard oscillation returns — the founder's spinner loop. The second,
// storage-independent channel (?onboarded=1, promoted to the cookie by middleware)
// rides the navigation itself and cannot be dropped the same way.
describe('the storage-independent completion signal (the PWA channel)', () => {
  it('detects ?onboarded=1 and nothing else', () => {
    expect(hasOnboardedSignal(new URLSearchParams('onboarded=1'))).toBe(true);
    expect(hasOnboardedSignal(new URLSearchParams('onboarded=0'))).toBe(false);
    expect(hasOnboardedSignal(new URLSearchParams('foo=bar'))).toBe(false);
    expect(hasOnboardedSignal(new URLSearchParams(''))).toBe(false);
  });

  it('the completion navigation URL carries the signal', () => {
    expect(hasOnboardedSignal(new URLSearchParams(DASHBOARD_ONBOARDED_URL.split('?')[1]))).toBe(true);
  });

  it('promotes URL signal → cookie only when present and not already set (idempotent)', () => {
    const withSignal = new URLSearchParams('onboarded=1');
    expect(shouldPromoteOnboardedCookie({ searchParams: withSignal, cookieAlreadySet: false })).toBe(true);
    // once the cookie exists, nothing to promote — no repeat write on every request
    expect(shouldPromoteOnboardedCookie({ searchParams: withSignal, cookieAlreadySet: true })).toBe(false);
    // no signal → never promote
    expect(shouldPromoteOnboardedCookie({ searchParams: new URLSearchParams(''), cookieAlreadySet: false })).toBe(false);
  });
});

describe('the installed-PWA exit settles (no oscillation) — the U1 repro', () => {
  // Model the standalone context: the client wrote document.cookie on finish, but
  // standalone WebKit DROPPED it, so the SSR read never sees the client cookie.
  // The ONLY surviving completion signal is the ?onboarded=1 URL. `promoteFromUrl`
  // models middleware promoting that URL signal into the cookie the back leg reads.
  // The DB read stays stale-false the whole time (the pathological case).
  const runStandaloneExit = (promoteFromUrl: boolean): string[] => {
    let route = DASHBOARD_ONBOARDED_URL;
    const visited: string[] = [route];
    for (let i = 0; i < 6; i++) {
      if (route.startsWith('/dashboard')) {
        const sp = new URLSearchParams(route.split('?')[1] ?? '');
        // The client cookie is gone (standalone); the cookie is present ONLY if
        // middleware promoted it from the URL signal on this dashboard hit.
        const cookiePresent = promoteFromUrl && hasOnboardedSignal(sp);
        const { redirectToOnboarding } = resolveOnboardingGate({
          isNewUser: true, isReactivated: false,
          onboardingCompleted: false, // stale-false — write not yet visible to this client
          justOnboarded: cookiePresent,
        });
        if (!redirectToOnboarding) break;
        route = '/welcome/language';
      } else {
        // forward leg (chrome, service-role read = true) re-navigates WITH the signal
        route = DASHBOARD_ONBOARDED_URL;
      }
      visited.push(route);
    }
    return visited;
  };

  it('WITHOUT the URL→cookie promotion: the installed PWA oscillates (documents the bug)', () => {
    const visited = runStandaloneExit(false);
    // never settles: keeps flipping welcome ↔ dashboard and hits the iteration cap
    expect(visited.length).toBeGreaterThan(4);
    expect(visited).toContain('/welcome/language');
  });

  it('WITH the URL→cookie promotion: the installed PWA settles on /dashboard immediately', () => {
    const visited = runStandaloneExit(true);
    // fixed point on the first check — no bounce to /welcome ever
    expect(visited).toEqual([DASHBOARD_ONBOARDED_URL]);
  });
});

// ── F-05 · transition watchdog (FOUNDER-WALK-3 U1) ───────────────────────────
//
// The redirect-loop probes above assume the navigation FIRES. The founder-walk-3
// hang is a different failure: every completion path awaited the best-effort write
// before navigating, so a suspended PWA fetch wedged the spinner and the signal-
// bearing navigation never happened. The watchdog force-navigates when the app is
// still on /welcome after a generous budget.
describe('shouldForceOnboardingNavigation — the stuck-transition watchdog', () => {
  it('fires while still stuck on any /welcome path', () => {
    expect(shouldForceOnboardingNavigation('/welcome')).toBe(true);
    expect(shouldForceOnboardingNavigation('/welcome/build')).toBe(true);
    expect(shouldForceOnboardingNavigation('/welcome/integrations')).toBe(true);
    expect(shouldForceOnboardingNavigation('/welcome/language')).toBe(true);
  });

  it('no-ops once the dashboard has been reached (nothing to force)', () => {
    expect(shouldForceOnboardingNavigation('/dashboard')).toBe(false);
    // the signal-bearing dashboard URL is a dashboard path, not a /welcome one
    expect(shouldForceOnboardingNavigation('/dashboard?onboarded=1')).toBe(false);
  });

  it('does not false-positive on unrelated routes that merely contain "welcome"', () => {
    // guards against a naive includes() — only real /welcome routes count
    expect(shouldForceOnboardingNavigation('/dashboard/welcome-back')).toBe(false);
    expect(shouldForceOnboardingNavigation('/help/welcome')).toBe(false);
  });

  it('the mutation budget is shorter than the watchdog (navigate before we force)', () => {
    // the write is raced first; the watchdog is the last-resort backstop
    expect(ONBOARDING_MUTATION_BUDGET_MS).toBeLessThan(ONBOARDING_WATCHDOG_MS);
    expect(ONBOARDING_MUTATION_BUDGET_MS).toBeGreaterThan(0);
  });
});
