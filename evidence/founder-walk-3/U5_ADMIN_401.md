# U5 — Admin 401 chain: shared honest 401 state, Health copy calmed

> ## ⚠️ CORRECTED 2026-08-06 — this report's root-cause verdict was WRONG
>
> The original §1 concluded: *"the wiring is code-correct, therefore a 401 means the
> `ADMIN_API_KEY` **value** on Vercel ≠ the value on Railway."* **That was an inference,
> not an observation, and it was false.** The values were byte-identical the whole time.
>
> The real cause: the `/api/:path*` rewrite in `apps/web/next.config.ts` was returned as a
> **bare array**, which Next treats as the `afterFiles` phase — checked **before dynamic
> routes**. The admin proxy `app/api/admin/[...path]/route.ts` is a dynamic route, so the
> rewrite shadowed it. Every `/api/admin/*` call went straight to Railway **with no
> `x-admin-key` header at all**, and the API answered 401. No env value on either platform
> could have fixed it.
>
> This report verified both **ends** of the chain and never checked whether the **middle**
> was reachable. Fixed in **PR #72** (`598489f`, `d813fc9`, merged `6aa31b7`).
>
> **The cost:** the founder spent days re-entering and re-verifying two identical env values
> across Vercel and Railway, and redeploying both, because §1 and the checklist below told
> them to. Same failure mode as the migration-0092 propagation: **a wrong conclusion in a
> report keeps working after it has been refuted.** The verdict outlived the evidence,
> because it was written as a fact rather than as the inference it was.

## 1. Wiring verification — accurate as far as it went, wrong in its conclusion

The table below was **correct** and still is. Both sides use the same env var and the same
header, and there is no name/casing/prefix drift:

| Side | File:line (current) | Env var | Header |
|---|---|---|---|
| Web admin proxy (injects key) | `apps/web/app/api/admin/[...path]/route.ts:10,52` | `ADMIN_API_KEY` | sends `x-admin-key` |
| API validation | `apps/api/src/routes/admin.ts:14,15,17` | `ADMIN_API_KEY` | reads `x-admin-key` → 401 on mismatch |

The API compares the two strings **raw** (`adminKey !== expectedKey`) — no `.trim()`, no
normalisation on either side.

**What was invalid was the leap from there:** "the two ends match, so the only remaining
variable is the value." That silently assumed the request reaches the proxy. It did not.
Verifying the endpoints of a chain says nothing about its middle.

The discriminator that would have caught this in one command, logged out:

```
curl -i https://www.justgoblin.com/api/admin/telemetry
```

* `403 {"error":"Forbidden"}` — the **proxy's own** gate (`route.ts:33-35`) rejecting a
  non-admin session. The proxy is running; a 401 for a real admin would then genuinely mean
  the values differ.
* `401 {"error":"Unauthorized"}` — **Hono's** wording (`admin.ts:18`). The proxy was
  bypassed entirely. This is what the broken state returned.

A second, zero-command discriminator: `/admin/costs` is a server component that fetches
Railway **directly** (`costs/page.tsx:28-31`), bypassing the rewrite. Costs rendering real
data while `/admin/insight` 401s proves the values match and the proxy is being shadowed.
That is exactly what the founder observed on device.

## 2. Shared, honest 401 state on EVERY admin page

Still valid. An empty table / silent-empty list on an auth failure is a false state (Feeling
invariant). One component (`components/admin/AdminErrorState.tsx`) renders one shared copy
(`lib/admin/admin-error.ts` → `adminErrorMessage`):

| Page | Before | After |
|---|---|---|
| Insight | rich 401 string (inline) | same string, now from the shared helper |
| Costs (server, direct API) | bare `Error: API 401` | `AdminErrorState` |
| Users | silent empty list on load 401 | `loadError` state → `AdminErrorState` |
| Telemetry | generic `Could not load telemetry data.` | 401 → shared copy; non-auth → honest German fallback |
| Models | silent empty table on load 401 | `loadError` state → `AdminErrorState` |

**Corrected since:** the 401 *string* this report shipped inherited §1's false verdict —
it asserted "ADMIN_API_KEY auf Web und API müssen übereinstimmen" as the cause, which is
what sent the founder chasing env values. PR #72 replaced it: the copy now states what a
401 actually proves (the API rejected the key), names **both** ways that happens, and gives
the `curl` discriminator above. `lib/admin/admin-error.test.ts` now locks that honesty
property, including an explicit assertion that the message does not re-narrow to a single
unobservable cause.

## 3. Health "commits differ" — honest and calm

Still valid, unchanged. `app/admin/health/page.tsx` rendered differing short SHAs in **red
(`--danger`)**, which read as an alarm for an EXPECTED state (a web-only wave ships a new web
commit; the API binary is unchanged). Now: in-sync → calm `--success`; differing → neutral
`--meta` info with a one-line reason — never red unless a real health signal is.

Note: the `ADMIN_API_KEY: Set` row in that page's env panel reads the **web's** `process.env`
only. It can never say anything about Railway's value, and must not be read as "both sides
confirmed."

## ~~Founder env checklist (align `ADMIN_API_KEY` on BOTH platforms)~~ — RETRACTED

**This checklist was wrong and must not be followed.** It instructed the founder to align two
env values, redeploy both services, and — if it still 401'd — to assume the values still
differed and check for trailing whitespace or a rotated key. There was nothing to align. The
loop it created had no exit: every failed verification pointed back to step 1.

Nothing here required a founder env action. It required a one-line change to the rewrite
phase in `next.config.ts`.

## Regression protection (PR #72)

`apps/web/lib/env/api-rewrites.ts` holds the rule; `apps/web/lib/env/api-rewrites.test.ts`
models the documented Next routing order and resolves real paths against the real config plus
the route handlers discovered on disk. It fails if:

* the rule returns to `afterFiles` / the bare-array form (mutation-verified: 8 assertions red);
* any **future** dynamic handler under `app/api/` is shadowed the same silent way;
* a root-level catch-all is added — the precondition that makes the `fallback` phase safe, so
  it is asserted rather than assumed.

Verified against two real `next build` manifests: same source, same destination,
byte-identical compiled regex; only the phase moved. `headers`, `redirects`, and the
static/dynamic classification of every `/api` handler are unchanged.

## Honest limitation

The shared 401 state, the corrected copy, and the rewrite phase are verified in code, unit
test, and two build manifests. What this report cannot assert is the live 403 on
`www.justgoblin.com` after the Vercel deploy of `6aa31b7` — that is the founder's one-command
check above, not something the repo can prove.

**Standing lesson:** state inferences as inferences. §1's verdict was written as a settled
fact, so every later reader — including the copy shipped to the founder's screen — treated it
as one and stopped looking. When a report concludes "therefore it must be X," record what was
actually observed and what was assumed, and name the check that would falsify X.
