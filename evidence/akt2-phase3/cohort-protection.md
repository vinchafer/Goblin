# AKT 2 · Phase 3 · U3.7 — cohort-protection evidence, both dimensions

Real Act-1 users are live on production. Everything this phase adds is gated, and this file
is where that is proved rather than asserted. Re-run:

```
cd apps/api && pnpm exec vitest run \
  src/routes/ops-cohort-protection.test.ts \
  src/routes/ops-console.test.ts \
  src/routes/ops-authorization-coherence.test.ts
```

**Result 2026-08-13: 148/148 passed** (cohort-protection 50, console 58, authorization-coherence 40).

---

## Dimension 1 — an account that is not allowlisted

Two identities are driven through **every** route this phase adds or touches:
`vinc.hafner4@gmail.com` (a valid login, deliberately not allowlisted — the founder's own
second account) and `real.user@example.com` (a live Act-1 cohort user).

### The publish sheet stays exactly as it was

| Claim | Where it is proved |
|---|---|
| `GET /api/ops/eligibility` → **404**, byte-identical to Hono's built-in not-found | `ops-cohort-protection.test.ts` — the route is in the `ROUTES` table, so it is covered by the same loop as every Phase-2 route |
| The 404 is indistinguishable from an unmounted path | same file: the denied, anonymous and never-mounted responses are compared and must collapse to one status and one body |
| A 404 makes the web app render the **old** sheet | `SessionPane.routeToHostedSheet` returns `false` on anything but a clean 200 — and on a thrown request too, so a network failure falls the same way |
| The old sheet is unchanged | `git diff origin/master...HEAD -- apps/web/components/code/VercelConnectSheet.tsx` is **empty**; plus the DOM golden in `publish-sheet-non-allowlisted.html` |
| The old sheet leaks no trace of the hosted path | `publish-sheet-regression.test.tsx` asserts the rendered DOM contains none of `justgoblin.app`, `hosted-publish-sheet`, `hosted-name`, `Live auf`, `nichts zu verbinden` |

### The review queue and the console are unreachable

| Claim | Where |
|---|---|
| `GET /reviews`, `GET /reviews/:id/preview` → **404** for anonymous, for a cohort user, and for everyone when `OPS_FOUNDER_ACCOUNTS` is unset | `ops-console.test.ts` §1 — both paths are in the shared `paths` list, so a future route added to the mount cannot skip this proof |
| `POST /reviews/:id/approve` and `/block` → **404** for a cohort user, **and nothing is decided or published** | `ops-console.test.ts` §4 — asserts `decideReview` and `publishHostedApp` were never called |
| `/dashboard/konsole` renders nothing for a non-founder | unchanged from Phase 2.5: the page's server half calls `notFound()` before a byte of the console is rendered |

---

## Dimension 2 — `OPS_HOSTING_ENABLED=false`, for the ALLOWLISTED account

| Claim | Where |
|---|---|
| Every `/api/ops` route, `/eligibility` included, → **404 even for `vinc.hafner3@`** | `ops-cohort-protection.test.ts` dimension 2, same loop |
| Supabase is never even asked who the caller is — the switch is checked first, so the allowlist cannot leak through a mis-parsed value | same file: `expect(getUser).not.toHaveBeenCalled()` |
| Every not-`true` value is OFF, including `1`, `yes`, `on`, `enabled`, `ture` | same file |
| An allowlisted account with hosting off therefore sees the **old publish sheet** too | follows from the 404 above and `routeToHostedSheet`'s fall-through |

### The kill switch must never disarm the kill switch — re-proved, and widened

Phase 2 proved this with one GET (`/orphans`). The sentence the runbook actually leans on is
about the **writes**, so this phase asserts it for **every** admin route:

```
POST   /apps/:name/suspend     POST /apps/:name/unsuspend
DELETE /apps/:name             GET  /apps/:name
GET    /orphans                POST /orphans/purge
```

With `OPS_HOSTING_ENABLED=false` and a valid admin key, **none** answers 401 (the gate's
refusal). A 404 from `GET /apps/meinladen` is the *handler* saying "no such app" against a
database the test does not have — it is JSON where a gate refusal is `text/plain`, so the two
cannot be confused. Turning Act 2 dark still leaves the founder able to take an app down.

*(`ops-cohort-protection.test.ts` — "PHASE 3 · U3.7 — EVERY admin route survives the kill switch, not just the read".)*

---

## What this evidence does not cover

- **It is unit-level.** These are the real route handlers behind the real gate middleware, but
  the identities are mocked. The production proof is the founder window: sign in as a normal
  account and confirm the old sheet, then as the beta account and confirm the new one.
- **The web bundle: fixed, not merely disclosed.** A static import would have shipped the
  hosted sheet's strings — "Live auf {name}.justgoblin.app" and the rest of the beta
  vocabulary — inside the main editor bundle every live Act-1 user downloads. The gate would
  still have held (the component never renders, the API still 404s), but a curious cohort user
  reading their own JS would have learned that Goblin hosts apps for someone. `SessionPane`
  therefore loads it via `next/dynamic`, so the chunk is fetched only *after* the API has said
  this account is allowlisted. **Honest residue:** the chunk still exists on the CDN at a
  guessable build path, and Next's build manifest names it. This raises the cost of finding it
  from "read your own bundle" to "enumerate chunks deliberately"; it does not make it secret.
  Nothing behind it works without the API, which is the boundary that actually holds.
