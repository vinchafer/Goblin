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

One character, in one variable. Nothing to do with PR #61, #62 or #63 — that is
checked, not assumed (§4).

---

## 1. Status table

| Topic | Status | Evidence |
|---|---|---|
| **Production — diagnosis** | **GREEN** | root cause named to the line; reproduced locally; verified twice against live production |
| **Production — restored (boot)** | **GREEN** | PR #65 → `ba93dc7`. `/api/version` + `/status` 500 → 200 live |
| **Production — restored (features)** | **GREEN pending deploy** | PR #66 → `beb7d22`, merged. See §3 — the first restore was only half of one |
| **Hook URL** | **GREEN** | `401` live on the Railway origin, probed twice |
| **`www/api/health` 404** | **GREEN** | 404 → 200 live; same root cause, fixed by the same change |
| **i18n login verdict** | **ANSWERED** | `/login` is *not* leaking; `/auth/confirm` + `/auth/reset-password` *were*. §5 |
| **PR #64 / logout** | **NOT MERGED — needs one re-run** | rebased, conflict resolved, gates green except a 2-test E2E gap that #66 fixes. §6 |
| **Env hygiene** | **MERGED** | `docs/ENV_REFERENCE.md`, one-source API origin, config-status surface |
| **@auth E2E infra gap** | **PREPARED, not merged** | `E2E_AUTH_INFRA_GAP.md` — deliberately not pre-granted |

**Merged tonight under pre-grant A:** `ba93dc7` (PR #65), `beb7d22` (PR #66).
**Nothing merged under pre-grant B or C as such** — C's content rode along in
PR #65 (§8), B's PR #64 is held (§6).

---

## 2. Your morning list — shortest possible

1. **Paste the hook URL** into Supabase → Authentication → Hooks → Send Email →
   URL. No trailing slash, no trailing whitespace:

   ```
   https://goblinapi-production.up.railway.app/api/auth/email-hook
   ```

2. **Fix the Vercel variable** — Vercel → Settings → Environment Variables →
   `NEXT_PUBLIC_API_URL`. Select the whole field, delete, type:

   ```
   https://goblinapi-production.up.railway.app
   ```

   No trailing slash, no `/api`, no newline. **Nothing depends on this any
   more** — the build refuses the bad value and uses the correct origin
   everywhere. Until you do it, `/api/version` keeps reporting
   `"healthy": false`, which is the honest state, not a broken one.

3. **Check it, in one line:**

   ```
   curl -s https://www.justgoblin.com/api/version | jq .config
   ```

   `"healthy": true` with an empty `problems` array means everything is right.
   Safe to paste anywhere — it returns names and reasons, never values.

4. **Re-run PR #64's E2E** (§6). If green, it merges as-is.

5. **Device tests** (test account `vinc.hafner3@` only — never your own).
   These exercise PR #64, which is **not merged**, so do them after §6:
   - logout from **both** places (avatar menu, settings) **and** the command
     palette — that was a third, silently divergent implementation
   - reset chain: PWA → Gmail → Safari → button → new password → sign in
   - signup confirmation mail
   - EN login check: `/login` in a browser that has never seen Goblin

---

## 3. The restore took two goes, and the second one matters

**PR #65 stopped production dying. It did not stop production being wrong.**

After #65 deployed, every route answered 200 and the site looked healthy. The
post-restore E2E — the check your Phase 2.4 asks for — is what caught the rest:
it went from 106 passed / 26 failed to **130 passed / 2 failed**, and the two
survivors were `19-mobile-create-project` on both `@auth` projects. **The only
`@auth` spec that writes.** Twelve read-only specs recovered; the one that calls
the API did not.

The reason: `NEXT_PUBLIC_API_URL` is read **raw in 70+ call sites** — `?? ''`,
`|| ''`, and bare — none of which went through the normaliser. They were all
still building `…/api/auth/email-hook\n/api/projects` and getting a Railway 404.
The `|| ''` idiom does not help: it defends against *absent*, and the variable
was *present-but-malformed*.

**PR #66** fixes it at the only level that covers all of them and any written in
future: `next.config.ts` declares `NEXT_PUBLIC_API_URL` in its `env` block, so
Next substitutes the **validated** origin wherever the variable appears.
Measured on a build with the exact poisoned value: occurrences of the bad value
in the client bundle **26 → 0**.

That substitution had one cost, and I want you to see it rather than find it:
it would have made `/api/version` answer `"healthy": true` over a live
misconfiguration — the fix hiding the very problem it exists to surface. The
build carries its verdict separately in `GOBLIN_API_URL_PROBLEM` (a problem
**code**, never a value), that verdict wins on the status surface, and three
tests pin it including one asserting no value can leak through the new path.

**Honest note on my own work:** I found those 70 raw reads in my first sweep and
decided to leave the `|| ''` ones alone, reasoning that changing them would alter
behaviour. That reasoning was wrong for the malformed case, and it left
production booting-but-broken for about twenty minutes. The E2E caught what I
missed.

---

## 4. The outage — evidence

**Two independent artefacts from production, pulled before any change and
re-pulled fresh a second time:**

- the value inlined in the deployed client bundle
  (`/_next/static/chunks/0e6cc6jh3p5g2.js`):
  `let r="https://goblinapi-production.up.railway.app/api/auth/email-hook\n"`
- the same value in the deployed CSP header, newline percent-encoded by Vercel's
  edge: `connect-src … /api/auth/email-hook%0A …`

**The split, measured live:**

| | Before | After |
|---|---|---|
| `/api/version`, `/status` (dynamic) | **500**, `x-matched-path: /500` | **200** |
| `/`, `/pricing`, `/login` (prerendered) | 200 | 200 |
| `/dashboard` signed out (middleware, edge) | 307 | 307 |
| `www…/api/health` | **404**, carrying Railway headers | **200** |
| Railway `/api/health` direct | 200 — the API was never down | 200 |

**Reproduced** at `bf7d784` with that exact value: 4/4 routes 500,
`TypeError: Invalid character in header content ["Content-Security-Policy"]`,
`ERR_INVALID_CHAR`. **Fixed**, same value: 4/4 routes 200, zero occurrences.
**No behaviour change** with a correct value: the emitted CSP is byte-identical
to the pre-fix build's.

**Three hypotheses eliminated** with experiments, written up in
`PROD_500_ROOT_CAUSE.md` §3: a module-scope env read that throws; a missing
Supabase variable at build time; a runtime env change breaking an existing build.

---

## 5. The other three questions (full answers in `PR64_ANSWERS.md`)

- **Logout root cause:** `apps/web/lib/hooks/useAuth.ts:9`. `signOut()` returns
  `{ error }` rather than throwing; the old code discarded it and navigated
  anyway, so a failed revocation left a live session and `middleware.ts:94`
  bounced the "logged-out" user back to `/dashboard`.
- **Which change introduced it: none.** Re-ran the diff — #61, #62 and #63
  touched **zero** files on the logout path. It predates all three.
- **i18n:** both your hypotheses were right, about different pages. `/login` is
  your own stored `goblin:preferred-lang`, not a leak. `/auth/confirm` and
  `/auth/reset-password` really were leaking, because `useAuthLang` (private to
  the login page) defaults to `'en'` while `useLang` defaults to `'de'` — same
  storage key, opposite defaults.

---

## 6. PR #64 — held, and exactly what unblocks it

**Not merged, deliberately.** Pre-grant B requires E2E green and says: *if they
still fail, do NOT merge, diagnose.* So, diagnosed.

I did bring it forward: merged master into it (`445b0ad`) and resolved the one
conflict, in `next.config.ts`, in favour of master — U1's normalisation is a
strict subset of `resolveApiOrigin()`, so nothing of U1's is lost.

| Gate on the rebased branch | Result |
|---|---|
| `tsc --noEmit` | clean |
| Web vitest | 24 files / 206 tests, 0 failures |
| E2E | **130 passed / 2 failed** |

Those 2 are `19-mobile-create-project` — **identical to master's own baseline**,
which also runs 130/2. They are not PR #64's diff; they are §3's problem, fixed
by #66.

**What unblocks it: re-run PR #64's E2E once #66's deploy is live.** If it comes
back green every pre-grant B condition is met and it merges as-is, unchanged and
already rebased. I have left a comment on the PR saying the same.

---

## 7. Honest limitations — read this part

1. **The `@auth` E2E suite does not test the checkout.** `helpers/auth.ts:28`
   requests a magic link for `http://localhost:3000/auth/magic-callback`, which
   is not in Supabase's redirect allowlist, so Supabase falls back to the Site
   URL and the session is established on `https://www.justgoblin.com`.
   `@public` genuinely tests the checkout; `@auth` crosses over at the login
   step. Two candidate fixes in `E2E_AUTH_INFRA_GAP.md`; neither implemented.
2. **The two create-project failures are diagnosed, not yet proven fixed.** My
   diagnosis says #66 fixes them; the proof is the post-deploy E2E re-run. If
   they are still red after that, my diagnosis is wrong and the next step is the
   trace in the Playwright artefact.
3. **PR #64's rendered i18n evidence could not be re-derived from production** —
   the deployed `/login` is a prerendered shell whose copy is client-rendered, so
   a fetch contains neither the English nor the German strings. That table rests
   on local `next dev` evidence only.
4. **The logout failure was never reproduced on your device**, by PR #64 or by
   me. The mechanism is proven defeatable; that your live symptom has this cause
   is strongly supported, not proven.
5. **I never saw your Vercel dashboard.** The value is inferred — with certainty
   — from the deployed bundle and the deployed header, not read from the settings
   page.
6. **No real auth mail was sent and no real token redeemed.**
7. **Everything in §2 item 5 is device-only.** Nothing tonight substitutes for it.
8. **The API suite was never run locally** — it needs the test-mode Stripe
   secrets this session does not have. CI is the gate, and CI ran it armed.

---

## 8. Gates, per gate — checkout or production?

| Gate | Result | Against |
|---|---|---|
| Web vitest (PR #65) | 20 files / 167 tests, 0 failures | checkout |
| Web vitest (PR #66) | 21 files / 176 tests, 0 failures | checkout |
| Web vitest (PR #64 rebased) | 24 files / 206 tests, 0 failures | checkout |
| `tsc --noEmit` | clean on all three | checkout |
| CI · Typecheck & Build | success on both merges | checkout |
| CI · API unit tests | success — 142 files / 1512 tests | checkout |
| CI · money-suite guard | **armed and green** | checkout |
| CI · Bundle Size | success | checkout |
| Crash reproduction | 4/4 routes 500 + `ERR_INVALID_CHAR` | checkout, poisoned env |
| Fix verification | 4/4 routes 200, 0 `ERR_INVALID_CHAR` | checkout, poisoned env |
| Bad value in client bundle | 26 → 0 | checkout, poisoned env |
| No-behaviour-change | CSP byte-identical | checkout, correct env |
| Root-cause artefacts | client bundle + CSP header | **deployed production** |
| Hook URL probe | 401 = healthy | **deployed production** |
| Live restore | 9 routes re-probed | **deployed production** |
| E2E after restore | 106/26 → **130/2** | **deployed production** |

**On the money guard**, because a green tick is not evidence:
`ALLOW_MONEY_TEST_SKIP` appears **0 times** across all four workflow files;
GitHub sets `CI=true`; `money-suite-guard.test.ts` calls `expect.fail()` in CI
when the test-mode Stripe key or any tier-1 price id is missing. The job passed,
so the guard did not fire, so the secrets were present, so the real-Stripe suites
actually ran. That chain is the evidence.

**The one gate that stayed red, named as an exception rather than filed as
green:** `e2e`, on both merges. Before the restore it was 106/26 with every
failure an `@auth` spec and the list identical to PR #64's — it was measuring the
outage. After the restore it is 130/2, and those two are what PR #66 fixes, which
cannot go green until #66 is deployed. Master's own last E2E before the variable
changed (`bf7d784`, 29 July) was green. Your Phase 2.4 puts the E2E re-run
*after* the merge as the proof of restoration, and I treated it that way. If you
disagree with that reading, `35e198c` is the restore commit and reverts cleanly.
