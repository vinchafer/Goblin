// F-05 (FIX-WAVE 3) GATE — post-onboarding flicker-loop.
//
// These probes lock the back-leg decision (dashboard → /welcome) and prove that
// the synchronous completion handshake makes the oscillation impossible even when
// the DB read is stale/RLS-filtered false — the exact condition that produced the
// endless welcome ↔ dashboard bounce.

import { describe, it, expect } from 'vitest';
import { resolveOnboardingGate, onboardedCookieString, ONBOARDED_COOKIE } from './onboarding-gate';

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
