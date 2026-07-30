/**
 * The ONE sign-out mechanism (AKT1-STRANG-2 · U2).
 *
 * Why this file exists — the defect it fixes:
 *
 * Every logout entry point used to call `supabase.auth.signOut()` and then
 * navigate, without ever looking at the returned `{ error }`. That is unsafe,
 * because of how `@supabase/auth-js` implements sign-out (verified against the
 * installed 2.104.1, GoTrueClient.js `_signOut`):
 *
 *     const { error } = await this.admin.signOut(accessToken, scope)
 *     if (error) {
 *       // only 401 / 403 / 404 are tolerated
 *       if (!(isAuthApiError(error) && (…401/403/404…))) {
 *         return this._returnResult({ error })      // ← RETURNS EARLY
 *       }
 *     }
 *     if (scope !== 'others') {
 *       await this._removeSession()                 // ← NEVER REACHED
 *     }
 *
 * So on a network failure, a timeout, or a 5xx from the auth server — i.e. the
 * normal condition of a phone on mobile data, which is how our live cohort uses
 * Goblin — the session is *not* removed. The old code ignored that error and
 * navigated to `/login` anyway, where `middleware.ts` sees a still-valid session
 * cookie and redirects an authenticated visitor to `/dashboard`. Net effect for
 * the user: tapping "Abmelden" does nothing at all, silently, with no error.
 *
 * The fix rests on one fact: with `@supabase/ssr` the session IS the
 * `sb-…-auth-token` cookie. Both the browser client and `middleware.ts` read it
 * from there, and it is not http-only. So deleting the cookie is the logout, and
 * unlike the network call it cannot fail because the connection dropped. The
 * call to the auth server stays — it revokes the refresh token on OTHER devices
 * — but it is best-effort, not the thing we depend on.
 *
 * Honesty invariant: if the cookies are still there after the sweep, we return
 * `ok: false` and do NOT navigate. A logged-out-looking screen that still
 * carries a live session is exactly the false state Law 6 forbids.
 */

/**
 * `@supabase/ssr` stores the session as `sb-<project-ref>-auth-token`, split
 * into `.0`, `.1`, … chunks when it exceeds the per-cookie size limit, plus
 * `sb-<project-ref>-auth-token-code-verifier` for the PKCE leg. Prefix-matching
 * on `sb-…-auth-token` catches every one of them and nothing else.
 */
const AUTH_COOKIE_RE = /^sb-.+-auth-token/;

/** Where a signed-out user lands. Public, and unmistakably logged out. */
export const SIGNED_OUT_PATH = '/login';

export interface SignOutEnvironment {
  /**
   * Best-effort revocation at the identity provider
   * (`supabase.auth.signOut()`). May reject or resolve with an error; both are
   * tolerated. Called a second time after the cookie sweep, which — because
   * `__loadSession()` reads storage rather than memory — then finds no access
   * token, skips the network entirely, and drops the in-memory session and
   * refresh timer.
   */
  revoke: () => Promise<{ error?: unknown } | void>;
  /** `document.cookie` (read). */
  readCookies: () => string;
  /** `document.cookie = value` (write one). */
  writeCookie: (value: string) => void;
  /** `location.hostname` — used to also expire a parent-domain variant. */
  hostname: string;
  /** FULL-page navigation. A soft client-side push would keep the torn-down auth state alive. */
  navigate: (path: string) => void;
}

export type SignOutResult =
  | { ok: true; revoked: boolean }
  | { ok: false; reason: 'session_not_cleared'; remaining: string[] };

/** Names of the Supabase auth cookies currently present. */
export function authCookieNames(cookieString: string): string[] {
  return cookieString
    .split(';')
    .map((part) => part.split('=')[0]?.trim() ?? '')
    .filter((name) => AUTH_COOKIE_RE.test(name));
}

/**
 * The parent domain to also target when expiring, or null when there is none
 * worth trying (localhost, bare hosts, IP literals).
 *
 * Goblin is served on `www.justgoblin.com` while `justgoblin.com` 307s to it
 * (verified 2026-07-30). A session cookie written during an earlier apex visit
 * is a domain cookie the host-only delete cannot reach, so we issue the
 * parent-domain delete as well. A wrong guess is inert: the browser rejects a
 * Domain the current host does not belong to.
 */
export function parentCookieDomain(hostname: string): string | null {
  const labels = hostname.split('.');
  if (labels.length < 2) return null;
  if (/^\d+$/.test(labels[labels.length - 1]!)) return null; // IPv4 literal
  return `.${labels.slice(-2).join('.')}`;
}

/** Every `document.cookie` write needed to expire one cookie name. */
export function expiryWrites(name: string, hostname: string): string[] {
  const base = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
  const writes = [base];
  const parent = parentCookieDomain(hostname);
  if (parent) writes.push(`${base}; Domain=${parent}`);
  return writes;
}

/**
 * Sign out. Used by every entry point (avatar menu, settings page, command
 * palette) so there is exactly one behaviour to reason about and to fix.
 */
export async function performSignOut(env: SignOutEnvironment): Promise<SignOutResult> {
  let revoked = true;
  try {
    const result = await env.revoke();
    if (result && typeof result === 'object' && 'error' in result && result.error) revoked = false;
  } catch {
    revoked = false;
  }

  // The cookie is the session. This is the step that actually logs the user out,
  // and it does not depend on the network having worked.
  for (const name of authCookieNames(env.readCookies())) {
    for (const write of expiryWrites(name, env.hostname)) env.writeCookie(write);
  }

  // With the cookies gone this second call finds no access token, so it takes
  // the offline branch: it clears the in-memory session and stops the refresh
  // timer instead of calling the auth server. Without it a pending auto-refresh
  // could write a fresh cookie back before the page navigates away.
  if (!revoked) {
    try {
      await env.revoke();
    } catch {
      /* best effort — the cookie sweep below is what we verify against */
    }
  }

  const remaining = authCookieNames(env.readCookies());
  if (remaining.length > 0) {
    // Never navigate to a logged-out-looking surface while the session lives.
    return { ok: false, reason: 'session_not_cleared', remaining };
  }

  env.navigate(SIGNED_OUT_PATH);
  return { ok: true, revoked };
}

/** The browser environment. Kept separate so `performSignOut` stays testable. */
export function browserSignOutEnvironment(
  revoke: () => Promise<{ error?: unknown } | void>,
): SignOutEnvironment {
  return {
    revoke,
    readCookies: () => document.cookie,
    writeCookie: (value) => { document.cookie = value; },
    hostname: window.location.hostname,
    // `replace`, not `assign`: Back must not return to the dashboard shell of a
    // session that no longer exists.
    navigate: (path) => { window.location.replace(path); },
  };
}
