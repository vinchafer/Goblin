// The `/api/*` → Railway proxy rule, in its own module so the routing phase is
// unit-testable without importing next.config.ts (which pulls in @sentry/nextjs).
//
// ── Why this file exists (the /admin 401 incident) ────────────────────────────
// The rule used to be returned as a BARE ARRAY from next.config.ts:
//
//   async rewrites() { return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }]; }
//
// A bare array is `afterFiles` (Next docs, `rewrites`: "When the rewrites
// function returns an array, rewrites are applied after checking the filesystem
// (pages and /public files) and BEFORE DYNAMIC ROUTES"). The documented order is:
//
//   4. beforeFiles rewrites
//   5. public/ + _next/static + NON-DYNAMIC routes are served
//   6. afterFiles rewrites
//   7. dynamic routes (e.g. app/api/admin/[...path]/route.ts)
//   8. fallback rewrites
//
// `app/api/admin/[...path]/route.ts` — the admin proxy that injects the
// `x-admin-key` header — is a DYNAMIC route, so it lives at step 7 and the
// catch-all at step 6 always won. Every browser call to /api/admin/* was proxied
// straight to Railway with NO admin key, and the API answered 401. No value of
// ADMIN_API_KEY on either platform could fix that; the founder chased matching
// env values across Vercel and Railway for days because the error copy blamed
// them. The two STATIC handlers (/api/version, /api/test-auth) were unaffected —
// they are served at step 5, ahead of the rewrite — which is why nothing else
// ever surfaced the shadowing.
//
// ── Why `fallback` and not an exclusion pattern ───────────────────────────────
// `fallback` runs at step 8, AFTER dynamic routes, so it means exactly what this
// rule always intended: "proxy to Railway anything this app does not serve
// itself." The alternative — keeping the rule at step 6 with a negative-lookahead
// source like `/api/:path((?!admin/).*)` — was rejected because:
//
//   1. It puts a hand-written regex into the file whose API_URL substitution took
//      production down on 2026-07-30. A slip there silently unroutes real user
//      traffic, not just admin traffic.
//   2. It only fixes the one path we know about today. The NEXT dynamic route
//      handler added under app/api/ gets silently shadowed all over again — the
//      exact bug class this is meant to close.
//   3. Its blast radius has to be reasoned about through a regex. This rule's can
//      be proven by enumeration (see api-rewrites.test.ts): moving step 6 → step 8
//      can only change paths that match a web-side DYNAMIC route, and the app has
//      exactly one under /api/ and none at the root.
//
// PRECONDITION, enforced by api-rewrites.test.ts: the app must have no root-level
// catch-all (no `app/[...slug]`). Such a route would match /api/* at step 7 and
// swallow traffic this rule must forward. Adding one reddens that test.
//
// Everything else is untouched: static web routes still win at step 5 (they beat
// both step 6 and step 8), and every path the web does not serve still reaches
// the same `${apiOrigin}/api/:path*` destination with the same parameters.

export interface RewriteRule {
  source: string;
  destination: string;
}

/** The object form of Next's `rewrites()` — one array per routing phase. */
export interface PhasedRewrites {
  beforeFiles: RewriteRule[];
  afterFiles: RewriteRule[];
  fallback: RewriteRule[];
}

/**
 * @param apiOrigin Absolute Railway origin, already validated by
 *   `resolveApiOrigin()` (no trailing slash, no control characters).
 */
export function apiRewrites(apiOrigin: string): PhasedRewrites {
  return {
    beforeFiles: [],
    afterFiles: [],
    fallback: [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ],
  };
}
