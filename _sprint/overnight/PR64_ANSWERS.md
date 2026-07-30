# PR #64 — the four questions, answered before anything was touched

Session: overnight 2026-07-30. Branch `claude/overnight-fix-ooswtl`.
Everything below was re-derived from the checkout and from live probes in this
session. Where I am repeating PR #64's finding rather than re-deriving it, it
says so.

---

## 1. LOGOUT — root cause, and which change introduced it

**Root cause: `apps/web/lib/hooks/useAuth.ts:9` (on master, `bf7d784`).**

```ts
 6  export function useAuth() {
 7    const signOut = useCallback(async () => {
 8      const supabase = createClient();
 9      await supabase.auth.signOut();          // ← return value discarded
10      if (typeof window !== 'undefined') {
11        window.location.href = '/login';      // ← navigates unconditionally
12      }
```

`signOut()` resolves to `{ error }`; it does not throw. In
`@supabase/auth-js` `GoTrueClient._signOut`, the local session is only cleared
*after* the revocation call comes back acceptable — a dropped fetch, a timeout
or a 5xx returns early and **leaves the session cookie in place**. Line 9 throws
that error away and line 11 navigates anyway, so `middleware.ts:94` sees a live
session on `/login` and bounces the "logged-out" user back to `/dashboard`.

**Which change introduced it: none of them. It is pre-existing.**
Re-run in this session against the current checkout:

```
$ git diff --name-only 6665945^1 HEAD -- apps/web/lib apps/web/middleware.ts \
    apps/web/components/header apps/web/components/settings apps/web/components/app-shell
(no output — 0 files)
```

`6665945` is the PR #61 merge, `HEAD` is `bf7d784` (PR #63 merge). #61, #62 and
#63 together touched **zero** files on the logout path. `useAuth.ts`'s last
change is the merge `9434875`, well before this lineage; `middleware.ts`'s two
most recent changes (`e978236`, `4ee6fe9`) add a public path and fix the PWA
onboarding loop, neither of which touches sign-out.

So the founder's suspicion of #61/#62/#63 is **disproven**, and PR #64's account
of the mechanism is **confirmed independently**. PR #64's fix
(`apps/web/lib/auth/sign-out.ts`, cookie-deletion as the source of truth, one
shared `performSignOut` across all three entry points) is the right shape: it
removes the dependency on a network call that is allowed to fail.

**Caveat I am keeping from PR #64 because it is still true:** the founder's exact
on-device failure was never reproduced. What is proven is that the mechanism is
defeatable and that the old code ignored the signal. That the live symptom has
this cause is strongly supported, not proven.

---

## 2. HOOK 404 — root cause and the one verified literal URL

**Root cause: (d) the URL configured in Supabase is not the Railway API origin.**
Not a doc/code mismatch, not an unmounted route, not a missing build.

Probed live in this session, 2026-07-30 (independent re-run of PR #64's probe):

| Method | URL | Result |
|---|---|---|
| POST | `https://goblinapi-production.up.railway.app/api/auth/email-hook` | **401** |
| POST | `…/api/auth/email-hook/` (trailing slash) | 404 |
| GET | `…/api/auth/email-hook` (wrong method) | 404 |
| POST | `https://www.justgoblin.com/api/auth/email-hook` | 404 |
| POST | `https://justgoblin.com/api/auth/email-hook` | 307 → www |

**401, not 404 and not 500, is the healthy answer** — the route exists and it
rejected an unsigned call. A 500 would have meant `SUPABASE_AUTH_HOOK_SECRET`
was missing on Railway; it is not.

**The one literal string to paste** (no trailing slash, no trailing whitespace):

```
https://goblinapi-production.up.railway.app/api/auth/email-hook
```

Every wrong variant the founder could plausibly have picked returns exactly the
404 he saw. The `www` variant is the most likely one — and see §2b, because that
same string is what took production down.

### 2b. The `www` 404 is not cosmetic — it is the outage

`POST https://www.justgoblin.com/api/auth/email-hook` → 404 is served by **Hono
on Railway**, not by Vercel: the response carries `x-railway-edge`,
`x-railway-request-id` and `x-request-id`. So the request does reach Railway,
at a path Railway does not have. Same for `https://www.justgoblin.com/api/health`
→ 404 while the Railway origin answers `/api/health` with 200.

That is the `/api/:path*` rewrite in `next.config.ts` appending its path to a
malformed `NEXT_PUBLIC_API_URL`. See `_sprint/overnight/PROD_500_ROOT_CAUSE.md`
— the same bad value is the direct cause of the web-wide 500.

---

## 3. U3 — real i18n leak, or the founder's stored preference?

**Both, on different pages. The verdict splits.**

- **`/login` is not leaking.** The German login screen the founder sees is his
  own `goblin:preferred-lang`, written at onboarding Step 0. Confirmed in code:
  `login/page.tsx:21-22` declares a *private* `useAuthLang()` that defaults to
  `'en'` and only overrides from that localStorage key.
- **`/auth/confirm` and `/auth/reset-password` were leaking.** They are the two
  surfaces the reset-chain work added, and they could not reach the private
  `useAuthLang` one file over, so they took `lib/use-lang.ts` instead — whose
  `useLang()` defaults to **`'de'`** (`use-lang.ts:34`, and the sync reader at
  `:25`). Two hooks, same storage key, opposite defaults when it is absent. That
  is the whole bug, and PR #64's fix (lift `useAuthLang` into
  `lib/use-auth-lang.ts` so both can share it) addresses it at the right level.

**Evidence status — an honest correction to how this should be read.** The
mechanism above I verified directly in the checkout. PR #64's before/after
*render* table came from its own `next dev` server-rendered first paint. I could
not re-derive it from production: the deployed `/login` is a statically
prerendered shell whose visible copy is client-rendered — a fetch of
`https://www.justgoblin.com/login` contains neither the English nor the German
strings. So the render table stands on PR #64's local evidence only, and the DE
direction is covered by unit test rather than rendered proof.

**Recommendation (unchanged from PR #64, and I agree):** let a stored preference
win over the landing locale. A user who chose German should not be handed English
because they opened the link on a different device.

---

## 4. Per gate — did it test the checkout, or the deployed production?

From PR #64's own table, re-stated so the distinction is unmissable:

| Gate | Result | Tested against |
|---|---|---|
| API vitest, money guard armed (`CI=true`) | 143 files / 1532 tests, 0 failures | **checkout** |
| Web vitest | 22 files / 189 tests, 0 failures | **checkout** |
| U2 logout regression | 15/15; counterfactual old impl 3/3 FAIL | **checkout** |
| U3 clean-visitor render | before/after table | **checkout** (`next dev`) |
| U4 chain + redemption | 42 API + 8 web | **checkout** |
| `tsc --noEmit` (web, shared) | clean | **checkout** |
| `next build` (web) | succeeds | **checkout** |
| Hook-URL probe | 401 = healthy | **deployed production** |
| `/api/*` rewrite finding | 404 vs 200 | **deployed production** |

**Two of eleven gates touched production; nine tested the checkout.** No `@auth`
E2E run is cited, and PR #64 is right not to cite one: that suite drives the
*deployed* app (PR #61's own finding, `13d1b29`), so while production was
returning 500 on every dynamic route it could only have reported the outage, not
the diff. That is an infrastructure gap, not a PR #64 defect — Phase 6 of
tonight's brief.

**The consequence for merging #64:** its evidence is real but almost entirely
checkout-level, so it says nothing about whether the deployed app works. That is
why production had to be restored *first* — which is what the rest of tonight
went to.
