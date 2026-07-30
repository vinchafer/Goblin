# The `@auth` E2E suite tests production, not the checkout — spec (Phase 6)

**Status: PREPARED, NOT IMPLEMENTED, NOT MERGED.** Deliberately not covered by
any of tonight's pre-grants. This file is the diagnosis and the two candidate
fixes, so the founder can pick one.

## Why it matters

Every `@auth` gate in CI reports on the **deployed** app. A PR can be green
because production is healthy and red because production is sick — in neither
case does it say anything about the diff. Tonight made that concrete: with
production returning 500 on every dynamic route, the `@auth` projects could only
have reported the outage.

## The chain, traced

1. `.github/workflows/e2e.yml` sets no `PLAYWRIGHT_BASE_URL`.
2. `playwright.config.ts:3` therefore resolves `baseURL` to
   `http://localhost:3000`, and `:59-80` starts a local API plus a local
   `next start` over the pre-built `.next`. **`@public` genuinely tests the
   checkout.**
3. `tests/e2e/helpers/auth.ts:28` requests a Supabase magic link with
   `redirect_to = http://localhost:3000/auth/magic-callback`.
4. `localhost:3000` is not in the Supabase project's redirect allowlist. Supabase
   discards the requested value and falls back to the project **Site URL**, which
   is the production host. The trace in `13d1b29` shows both URLs side by side.
5. The session cookie is now on `https://www.justgoblin.com`. Every signed-in
   assertion that follows is made against production.

So it is not that the suite targets production — it is that `@auth` **crosses
over at the login step**, invisibly, while `@public` stays local.

## Option A — allowlist the local callback (founder, no code)

Supabase → Authentication → URL Configuration → Redirect URLs, add:

```
http://localhost:3000/auth/magic-callback
```

- One paste, no code change, fixes local runs and CI at once.
- Cost: a development URL sits in the production project's allowlist. It is a
  redirect target, not a credential, and `localhost` is only reachable from the
  visitor's own machine — but it is a real widening of that list, so it is the
  founder's call, not mine.

## Option B — use the test-mode path that already exists (code, no dashboard)

`auth.ts:80` already provides `loginAsTestCallback`, written for exactly this:
it mints a session admin-side and hands the tokens to `/auth/test-callback`,
which writes the `@supabase/ssr` cookies **on whatever origin the test is
actually on**. No redirect allowlist is involved.

It is not usable as things stand because of a build/runtime mismatch:

- The route is gated on `NEXT_PUBLIC_ENABLE_TEST_AUTH === 'true'`.
- `e2e.yml` sets `ENABLE_TEST_AUTH: 'true'` on the *test* step only — a different
  variable, and one step too late.
- `NEXT_PUBLIC_*` values are compiled into the bundle, so the gate is decided by
  the `pnpm --filter @goblin/web build` step above, which does not set it.

The change is therefore:

1. Add `NEXT_PUBLIC_ENABLE_TEST_AUTH: 'true'` to the **build** step's `env` in
   `e2e.yml` (and keep `ENABLE_TEST_AUTH` on the test step for the server side).
2. Switch the `@auth` specs from `loginAsRealTestUser` to `loginAsTestCallback`.
3. Add an assertion in the auth helper that fails loudly if the post-login origin
   is not `baseURL` — so this can never silently regress. That assertion is the
   part worth having regardless of which option is chosen.

**Safety note that must not be skipped:** `NEXT_PUBLIC_ENABLE_TEST_AUTH=true`
compiled into a *production* build would expose a session-minting route. It must
be set only in the CI E2E build, never in the Vercel project. Step 3's assertion
does not carry that risk and should land either way.

## Recommendation

**Option B**, plus step 3 unconditionally. It keeps the production Supabase
project untouched, it makes the CI gate mean what everyone already assumes it
means, and the origin assertion turns a silent crossover into a red test.

## What is not yet done

No branch, no PR, no test run. This is a specification only, and the origin
assertion in particular has not been written or exercised.
