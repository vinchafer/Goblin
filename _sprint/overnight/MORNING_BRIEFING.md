# Morning briefing — overnight session, 2026-07-30

> Read §0 and §1. Do §2. Everything after that is there when you want it.

---

## 0. What happened, in four sentences

`NEXT_PUBLIC_API_URL` on Vercel held the **Supabase mail-hook URL with a trailing
newline** — the hook URL pasted into the API-origin field. `next.config.ts`
interpolated it into the `Content-Security-Policy` header it attaches to every
route. Node refuses to write a header value containing a newline
(`ERR_INVALID_CHAR`), so every server-rendered response died as it sent its
headers — before any I/O, which is exactly the 5 ms `FUNCTION_INVOCATION_FAILED`
with "No outgoing requests" you saw. Prerendered marketing pages come straight
from the CDN and were unaffected, which is why the site looked half-alive.

It was one character, in one variable, and it had nothing to do with PR #61, #62
or #63.

---

## 1. Status table

| Topic | Status | Evidence |
|---|---|---|
| **Production 500 — diagnosis** | **GREEN** | root cause named to the line, reproduced locally, verified twice against live production |
| **Production 500 — fix** | **GREEN in code** | PR #65, `35e198c`. Same poisoned value: 4/4 routes 500 → 4/4 routes 200, zero `ERR_INVALID_CHAR` |
| **Production 500 — merged & live** | see §1a | |
| **Hook URL** | **GREEN** | `401` live on the Railway origin, probed twice tonight. §2 item 1 |
| **i18n login verdict** | **ANSWERED** | `/login` is *not* leaking (your stored preference); `/auth/confirm` + `/auth/reset-password` *were*. `PR64_ANSWERS.md` §3 |
| **PR #64 / logout** | **NOT MERGED** | root cause confirmed independently; see §4 |
| **Env hygiene** | **PREPARED** | `docs/ENV_REFERENCE.md` + one-source API origin; see §5 |
| **@auth E2E infra gap** | **PREPARED, not merged** | `E2E_AUTH_INFRA_GAP.md` — deliberately not pre-granted |

### 1a. The merge and the live check

**As of this writing: PR #65 is open, not merged, and production is still down.**
The E2E gate is still running. Whatever the outcome, this line is the one to
re-read — everything else in this file is already settled.

### 1b. A scope note you should see, not discover

Pre-grants A and C were written as two PRs. They arrived as **one**, PR #65,
because this session has exactly one branch to push to. The combined diff still
respects both boundaries — `apps/web` and `docs`/`_sprint` only, zero Act-2
files, zero money paths, no behaviour change to any user feature — and the
content is a single concern: the env-handling incident and its permanent fix.
But it is not the shape you asked for, so: if you would rather review the
restore alone, `35e198c` is the production-restore commit on its own and the
rest sits in later commits.

---

## 2. Your morning list — shortest possible

1. **Paste the hook URL** into Supabase → Authentication → Hooks → Send Email →
   URL. No trailing slash, no trailing whitespace:

   ```
   https://goblinapi-production.up.railway.app/api/auth/email-hook
   ```

2. **Fix the Vercel variable** — Vercel → Settings → Environment Variables →
   `NEXT_PUBLIC_API_URL`. Select the whole field, delete, and type:

   ```
   https://goblinapi-production.up.railway.app
   ```

   No trailing slash, no `/api`, no newline. **This is hygiene, not an
   emergency** — the fix refuses the bad value and uses the correct origin
   anyway. Until you do it, `/api/version` will keep reporting
   `"healthy": false`, which is the honest state.

3. **Check it worked**, in one line:

   ```
   curl -s https://www.justgoblin.com/api/version | jq .config
   ```

   `"healthy": true` and an empty `problems` array means everything is right.
   The output is safe to paste anywhere — it never contains a value, only names.

4. **Device tests** (test account `vinc.hafner3@` only — never your own):
   - logout from **both** places (avatar menu, settings) **and** the command
     palette, which was a third, silently divergent implementation
   - reset chain: PWA → Gmail → Safari → button → new password → sign in
   - signup confirmation mail
   - EN login check: `/login` in a browser that has never seen Goblin must be
     English

   Items 4a–4d exercise PR #64's changes, which are **not merged** — do them
   after you have looked at §4.

---

## 3. The outage — evidence

**Two independent artefacts, pulled from production before anything was changed,
then re-pulled fresh a second time to confirm:**

- the value inlined in the deployed client bundle
  (`/_next/static/chunks/0e6cc6jh3p5g2.js`):
  `let r="https://goblinapi-production.up.railway.app/api/auth/email-hook\n"`
- the same value in the deployed CSP header, newline percent-encoded by Vercel's
  edge: `connect-src … https://goblinapi-production.up.railway.app/api/auth/email-hook%0A …`

**The split, measured live:**

| | Result |
|---|---|
| `/api/version`, `/status` (dynamic) | **500**, `x-matched-path: /500` |
| `/`, `/pricing`, `/login` (prerendered) | 200, `x-nextjs-prerender: 1` |
| `/dashboard` signed out (middleware, edge runtime) | 307 → `/login` |
| `www…/api/health` | 404 **carrying Railway headers** — the rewrite reached Railway at `…/email-hook\n/api/health` |
| Railway `/api/health` directly | 200 — the API was never down |

**Reproduced** at `bf7d784` with that exact value: 4/4 routes 500,
`TypeError: Invalid character in header content ["Content-Security-Policy"]`,
`code: 'ERR_INVALID_CHAR'`. **Fixed** with the same value: 4/4 routes 200, zero
`ERR_INVALID_CHAR`. **No behaviour change** when the value is correct: the
emitted CSP header is byte-identical to the pre-fix build's.

**Three hypotheses eliminated** (they are in `PROD_500_ROOT_CAUSE.md` §3 with the
experiments): a module-scope env read that throws; a missing Supabase variable at
build time; a runtime env change breaking an existing build.

---

## 4. PR #64 — where it stands

**Not merged.** Its own gates are real but almost entirely checkout-level, and
its E2E run failed **26 tests, all of them `@auth`, zero `@public`** — the exact
signature of the outage, because the `@auth` suite establishes its session on
production (§6). Pre-grant B required production restored and verified live
first, then a rebase and a re-run. Merging it on top of an unverified restore
would have been a guess dressed as a gate.

What I did verify independently tonight:

- **Logout root cause confirmed** at `apps/web/lib/hooks/useAuth.ts:9` — the
  return value of `supabase.auth.signOut()` is discarded and the page navigates
  regardless, so a failed revocation leaves a live session and `middleware.ts:94`
  bounces you back to `/dashboard`.
- **Your suspicion of #61/#62/#63 is disproven.** Re-ran the diff: those three
  merges touched **zero** files on the logout path.
- **The i18n verdict splits**, and both of your hypotheses were right about
  different pages. Details in `PR64_ANSWERS.md` §3.

Also worth knowing: PR #64 changes `next.config.ts` in the same region PR #65
does, so it will need a rebase before it can merge cleanly.

---

## 5. Env hygiene — what is prepared

- **`docs/ENV_REFERENCE.md`** — every required variable across web and API, which
  platform it belongs on, what a correct value looks like, what breaks without
  it, and which are secrets. Measured facts are marked; inferred ones say so.
- **One source for the API origin.** It was written out four times with three
  different answers — including a Vercel lambda that would have dialled
  `http://localhost:3001` and a laptop that would have dialled production
  straight past the dev-safety shield. All four now go through
  `lib/env/origin.ts`.
- **A config-status surface** on `/api/version` — names and reasons, never
  values.
- **Regression tests** — `/api/version` answers 200 with each critical variable
  missing in turn, with all of them missing at once, and under the exact
  2026-07-30 poisoned value.

---

## 6. Honest limitations — read this part

1. **The `@auth` E2E suite does not test the checkout.** Traced tonight:
   `helpers/auth.ts:28` requests a magic link for
   `http://localhost:3000/auth/magic-callback`, which is not in Supabase's
   redirect allowlist, so Supabase falls back to the Site URL and the session is
   established on `https://www.justgoblin.com`. `@public` genuinely tests the
   checkout; `@auth` crosses over at the login step. Two candidate fixes in
   `E2E_AUTH_INFRA_GAP.md`; neither is implemented.
2. **PR #64's rendered i18n evidence could not be re-derived from production.**
   The deployed `/login` is a prerendered shell whose copy is client-rendered, so
   a fetch contains neither the English nor the German strings. That table stands
   on PR #64's local `next dev` evidence only.
3. **The logout failure was never reproduced on your device**, by PR #64 or by
   me. The mechanism is proven defeatable; that your live symptom has this cause
   is strongly supported, not proven.
4. **I never saw your Vercel dashboard.** The value is inferred — with certainty
   — from the deployed bundle and the deployed header, not read from the
   settings page. If `NEXT_PUBLIC_API_URL` turns out to hold something else,
   the artefacts in §3 are still what production was serving.
5. **No real auth mail was sent and no real token redeemed** tonight.
6. **Everything in §2 item 4 is device-only.** I cannot drive your phone, and
   nothing tonight substitutes for those checks.
7. **The API test suite was not run locally** — it needs the test-mode Stripe
   secrets, which this session does not have. CI is the gate for it, and CI ran
   it with the money guard armed (see below).

---

## 7. Gates, per gate — checkout or production?

| Gate | Result | Against |
|---|---|---|
| Web vitest (PR #65) | 20 files / 167 tests, 0 failures | checkout |
| Web vitest (with Phase-5 work) | 21 files / 173 tests, 0 failures | checkout |
| `tsc --noEmit` (web) | clean | checkout |
| `next build` (web) | succeeds | checkout |
| CI · Typecheck & Build | **success** | checkout |
| CI · API unit tests | **success — 142 files / 1512 tests** | checkout |
| CI · money-suite guard | **armed and green** | checkout |
| CI · Bundle Size | success | checkout |
| Crash reproduction | 4/4 routes 500 + `ERR_INVALID_CHAR` | checkout, poisoned env |
| Fix verification | 4/4 routes 200, 0 `ERR_INVALID_CHAR` | checkout, poisoned env |
| No-behaviour-change | CSP byte-identical | checkout, correct env |
| Root-cause artefacts | client bundle + CSP header | **deployed production** |
| Hook URL probe | 401 = healthy | **deployed production** |
| Outage split (dynamic vs static) | measured across 9 routes | **deployed production** |

**On the money guard specifically**, because "green" is not enough on its own:
`ALLOW_MONEY_TEST_SKIP` appears **0 times** in all four workflow files; GitHub
sets `CI=true`; `money-suite-guard.test.ts` calls `expect.fail()` in CI when the
test-mode Stripe key or any tier-1 price id is missing. The job passed, so the
guard did not fire, so the secrets were present, so the real-Stripe suites
actually ran. That chain — not the green tick — is the evidence.
