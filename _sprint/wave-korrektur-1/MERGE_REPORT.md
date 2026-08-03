# WAVE-KORREKTUR-1 — Landing-Safe-Area (PWA) · Sprach-Propagierung + DE/EN-Umschalter

**Branch** `claude/landing-safe-area-i18n-7o7rcx`, forked fresh from `origin/master` `d45c8d7`.
**Status: MERGED.** PR #68, merged into `master` with `--no-ff` after an explicit
grant from the founder + Steven. The branch head at merge time was `371908e`,
with CI, E2E Tests and the Vercel deployment all green on that SHA.

| Unit | Commit | Subject |
|---|---|---|
| U1 | `420b578` (2026-08-01 01:12 UTC) | safe-area for the PUBLIC landing page and every public surface |
| U2 | `39207ed` (2026-08-01 01:56 UTC) | one locale precedence for every public surface + a DE·EN switcher |

Two units, two revert-ready commits. U1 touches no locale code; U2 touches no
inset code except the 320px nav-crowding fix, which is documented below as a
finding it produced rather than as scope it assumed.

---

## Phase 0 — state-first

`docs/GOBLIN_ARBEITSMETHODIK.md` read first. Every artefact the prompt named was
opened before any change:

| Prompt claim | Repo truth |
|---|---|
| shipped `env(safe-area-inset-*)` idiom (PRs #41/#44/#54/#55) | confirmed — `components/layout/Header.tsx`, `app/(legal)/layout.tsx`, `app/pricing/page.tsx`, `app/globals.css` `.safe-top`/`.safe-bottom` |
| Founder-Walk-3 U2 route-inventory assert scripts | confirmed — `evidence/pwa-safearea/{ROUTE_INVENTORY.md,assert-safe-area.mjs,assert-safe-area-bottom.mjs,assert-sidebar-landscape.mjs}`; baseline **32 / 23 / 11**, all green before any edit |
| `_sprint/.../PR64_ANSWERS.md` §U3 | confirmed at `_sprint/overnight/PR64_ANSWERS.md:102-129`, **read before re-deriving**. Its verdict ("`/login` is not leaking; the founder's own stored preference is") is upheld by this wave's evidence — see U2 §1 |
| "the landing page was never covered" | confirmed — the word "landing" does not appear in `ROUTE_INVENTORY.md`, and `nav.lp-nav` had no `env()` at all |
| `/signup` as a route | **contradicted** — `middleware.ts:57` whitelists `/signup` but no such route exists and nothing links to it. `/register` is the real signup URL. Reported, not fixed |

---

# UNIT 1 — Safe-area on the public landing page

## The defect

`styles/landing.css` shipped the landing nav as `position: fixed; top: 0;
height: 64px` with no inset. With `viewport-fit=cover` (which the root layout
sets) that bar starts at y = 0 in a standalone PWA, so the GOBLIN lockup sat on
the iOS clock and "Start building" under the wifi/battery icons — the founder's
screenshot. Every previous safe-area wave had swept the *signed-in* app.

## What was applied — the shipped idiom, no new mechanism

```css
nav.lp-nav {
  height: calc(64px + env(safe-area-inset-top, 0px));
  padding-top: env(safe-area-inset-top, 0px);
}
```
Identical in shape to `Header.tsx` and `app/(legal)/layout.tsx`: reserve the
inset as padding **and** grow the height by the same amount, so the one nav
background continues into the inset.

## Route inventory — the public half (full table: `evidence/pwa-safearea/ROUTE_INVENTORY.md` Part 2)

| Surface | Verdict |
|---|---|
| `/` nav, hero, footer | **treated (this wave)** |
| `/login`, `/register`→`/login?mode=signup`, `/login/2fa` | **treated** |
| `/auth/confirm`, `/auth/reset-password` (via `.auth-page`) | **treated** |
| `/status`, `/badge` | **treated** — both carry an edge-anchored green bar the old inventory filed as "content page, no edge chrome". Inventory correction |
| `/models`, `/models/[id]`, `/help`, `/help/[slug]` | **treated** — their 28–32px top padding is *below* a 47–59px iOS inset |
| `/about`, `/manifesto`, `/changelog` | **treated** via the new `.safe-prose-page` utility |
| `/shared/[token]`, `/cancel-deletion`, `/deletion-pending`, 404, 500 | **treated** |
| `/pricing`, `/terms`, `/privacy`, `/imprint`, `/acceptable-use` | already (FW3 U2) |
| `/demo-chat`, `/demo-chat-mobile`, `/demo-code`, `/demo-preview` | shell — render the real `Header`/`Sidebar` |
| `/auth/magic-callback`, `/print`, `/brand/*`, `/api/*` | n.a. |
| `/signup` | finding, not fixed — whitelisted, no route |

`.safe-prose-page` exists because those three pages used Tailwind's `py-16 px-4`,
and an inline inset style would have **replaced** the 64px design padding rather
than added to it. The utility sits next to the shipped `.safe-top`/`.safe-bottom`
helpers and uses the same `env()` idiom.

## Closing the inventory hole for good

The assert script now **enumerates `middleware.ts`'s own `isPublic` allowlist**
(23 path predicates) and fails if the count changes. A new public route cannot be
added there and silently skip the gate — the repo's own definition of "reachable
without a session" is the gate's input.

| Script | Before | After | Result |
|---|---|---|---|
| `assert-safe-area.mjs` | 32 | **73** | 0 failures |
| `assert-safe-area-bottom.mjs` | 23 | **33** | 0 failures |
| `assert-sidebar-landscape.mjs` | 11 | 11 (unchanged) | 0 failures |

## Double-inset check (the #44/#55 lesson)

Two assertions **count occurrences** rather than merely matching:
- the `nav.lp-nav` rule block must contain `env(safe-area-inset-top` **exactly
  twice** (once as padding, once inside the height `calc`);
- the `footer.lp-footer` block must contain `env(safe-area-inset-bottom`
  **exactly once**.

The hero's `padding-top` also grows by the inset, and that is deliberately *not*
a double inset: the hero sits **behind** a `position: fixed` nav, so its top
padding measures from the viewport top, not from the device edge. Before and
after, the visible gap between nav bottom and headline is identical — 136 − 64 =
**72px** at the shipped compact density; only the whole stack moves down.

## Gate evidence

`evidence/pwa-safearea/landing-header-before-after.png` — 375px phone columns,
**light and dark**, before and after, with a 47px simulated top inset drawn as a
status-bar band over a literal reproduction of `landing.css` §6 NAV
(`landing-harness.html`, rendered by `render-landing.mjs`). The BEFORE panels
show exactly the founder's collision; the AFTER panels show it cleared.

---

# UNIT 2 — Language: propagation + the DE/EN switcher

## 1 · The earlier U3 verdict, read first — and what the current truth is

`PR64_ANSWERS.md:102-129` concluded: `/login` is **not** leaking; the German
login is the founder's own `goblin:preferred-lang`, and `/auth/confirm` +
`/auth/reset-password` *were* leaking and were fixed by lifting `useAuthLang`.

The clean-visitor simulation run for this wave **upholds that verdict and finds
what it did not cover.** Full tables: `evidence/public-i18n/BEFORE.md` (pre-U2)
and `evidence/public-i18n/SWEEP.md` (post-U2) — same script, five visitor cases,
fresh browser context each, local `next build` + `next start`.

| Case | BEFORE | AFTER |
|---|---|---|
| **A** clean visitor, `Accept-Language: en-US`, nothing stored | `/login`, `/login?mode=signup`, `/register`, `/auth/confirm`, `/auth/reset-password` → **EN** ✅ (PR #64 holds). But `/about`, `/help`, `/help/[slug]` → **DE** ❌ | all **EN** ✅ |
| **B** clean visitor, `Accept-Language: de-DE` | identical to A — **detection does nothing**; a German visitor gets an English login ❌ | `/login`, `/auth/*`, `/about`, `/help` → **DE** ✅ |
| **C** the founder's device: `goblin:preferred-lang='de'`, EN browser | `/login` → **DE** — reproduces his report exactly, and shows the cause is the stored preference | unchanged (**DE**) — the preference is still honoured, and the switcher now *shows* it |
| **D** explicit choice DE, EN browser | no effect (no switcher existed) | **DE** across public + auth ✅ |
| **E** explicit choice EN, **DE** browser | no effect | **EN** — the choice outranks detection ✅ |
| switcher walk | "unavailable — no such control" | **4/4 ✅** |

### Root cause, with file:line

There was **no landing locale to propagate**. The landing declares its language
as a literal (`app/page.tsx:65`, `<InstallAppBlock lang="en" />`) and stores
nothing, so nothing downstream could inherit it. Each surface then answered
"what if nothing is stored?" on its own:

- `apps/web/lib/use-auth-lang.ts:43` — pre-auth fallback `'en'`
- `apps/web/lib/use-lang.ts:25,34` — app fallback `'de'`

and three **public** pages were bound to the app one:

- `apps/web/app/about/page.tsx:9` — `useLang()`
- `apps/web/app/help/page.tsx:12` — `useLang()`
- `apps/web/components/help/HelpArticleBody.tsx:14` — `useLang()` (renders `/help/[slug]`)

which is why a clean English visitor, **one click from the English landing
footer**, got a German page. Neither hook consulted the browser at all, which is
the whole of case B.

## 2 · The fix at the root — one precedence, one place

`apps/web/lib/locale.ts` is now the single definition:

> **1. explicit switcher choice** (`goblin:lang-choice`) —
> **2. stored onboarding preference** (`goblin:preferred-lang`) —
> **3. browser detection** (`navigator.languages` / Accept-Language) —
> **4. surface default** (`'en'` public/pre-auth, `'de'` app)

Both hooks became thin wrappers over `resolveLang()` and now subscribe to
language changes, so a switch re-renders every mounted surface with no reload.
The three public pages above were repointed to the public binding.

**Why two keys.** `goblin:preferred-lang` already means "this account answered
Step 0". FOUNDER-WALK U4 deliberately made the marketing landing *ignore* it, and
`tests/e2e/33-landing-i18n.spec.ts` pins that. If the switcher wrote the same
key, "I pressed DE just now" and "this account answered DE months ago" would be
indistinguishable and that rule could not survive. It does: **all 10 of those
tests still pass.**

## 3 · The switcher — placement, and why

`apps/web/components/i18n/LangToggle.tsx`: a `DE · EN` text pair, no flags, no
dropdown, colour by `currentColor`, active side at full opacity.

**Chosen: nav on desktop, footer at ≤860px** — the escape hatch the prompt
allowed, and it was needed. At 320px the landing nav already carries the lockup,
the theme toggle and the primary CTA; the screenshots below show that bar was
*already* overflowing before this wave. The 860px breakpoint is the existing one
where the nav drops its links and sign-in. The switcher also appears on `/login`,
`/auth/confirm` and `/auth/reset-password`, in the document flow (never absolute)
so it inherits U1's top inset and cannot collide.

It does two honest jobs: it **sets** the language, and it **reports** the one
currently resolved — which is what ends the mystery. The founder now sees `DE`
marked while standing on the English landing, which is the entire explanation for
his German `/login`.

Screenshots — **the running app, not a harness** (`evidence/public-i18n/shots/`):

| File | Shows |
|---|---|
| `landing-nav-desktop-{light,dark}.png` | nav placement, 1280px, both themes |
| `landing-footer-{320,375}-{light,dark}.png` | footer placement, both themes |
| `landing-nav-320-{light,dark}.png`, `landing-nav-375-light.png` | the nav at 320/375px — switcher correctly absent, **and no collision** |
| `login-{375,320}-{de,en}-{light,dark}.png` | the switcher on `/login`, both locales, both themes |

## 4 · Sweep — every public + auth surface, both directions

`evidence/public-i18n/SWEEP.md`, **18 probed surfaces × 5 visitor cases** (`/cancel-deletion` and `/models/[id]` were audited in source rather than probed). Surfaces that
ship one language only are labelled as such rather than reported as "correctly
EN":

| Fully bilingual, follows the precedence | `/login`, `/login?mode=signup`, `/register`, `/auth/confirm`, `/auth/reset-password`, `/about`, `/help`, `/help/[slug]` |
|---|---|
| **EN-only** (not localised) | `/` landing prose, `/pricing`, `/terms` + legal shell, `/status`, `/badge`, `/changelog`, `/manifesto`, 404, 500 |
| **DE-only** (not localised) | `/models`, `/models/[id]`, `/deletion-pending`. `/cancel-deletion` and `/models/[id]` were read in source, not probed — the sweep probes 18 surfaces, listed in `clean-visitor.mjs` |
| n.a. | `/auth/magic-callback` (redirect), `/auth/callback` (route handler) |

No surface renders **mixed** in any of the five cases.

---

## Gates — and: checkout or production?

| Gate | Result | Tested against |
|---|---|---|
| API vitest, money guard armed (`CI=true`) | 143 files / **1532 tests**, 0 failures | **checkout** |
| Web vitest | 25 files / **239 tests**, 0 failures (was 24 / 209) | **checkout** |
| `tsc --noEmit` — web, shared, api | all clean | **checkout** |
| `next build` (web) | succeeds | **checkout** |
| E2E `@public` (public-desktop + public-mobile) | **140/140** | **checkout** (`next start` on :3100) |
| …of which the two i18n specs | 48/48, incl. all 10 pre-existing `33-landing-i18n` | **checkout** |
| `assert-safe-area.mjs` | 32 → **73**, 0 failures | **checkout** (source assertions) |
| `assert-safe-area-bottom.mjs` | 23 → **33**, 0 failures | **checkout** |
| `assert-sidebar-landscape.mjs` | 11, 0 failures | **checkout** |
| Clean-visitor simulation, 5 cases × 18 surfaces | before/after tables | **checkout** |
| Switcher walk (founder's acceptance test, automated) | 4/4 | **checkout** |

**Every gate in this wave tested the checkout. None tested deployed production.**
That is deliberate and it is a limit, not a claim: the `@auth` E2E projects are
the ones that cross over to production (`PR64_ANSWERS.md:156-186`), and they were
not run here — this wave changes only public and pre-auth surfaces.

---

## Honest limitations

1. **Real device insets are unobservable here.** Headless Chromium reports every
   `env(safe-area-inset-*)` as `0`. What is verified deterministically is that
   the shipped source carries the correct rule; the before/after render proves
   the *mechanism* with a simulated 47px inset. **True standalone-PWA insets are
   device-only** — the founder opening the installed app cold is U1's final gate.
2. **The landing's marketing copy is English only.** The switcher therefore does
   not translate that page; it sets and reports the language of sign-in and the
   app, and its `title` says exactly that. Translating ~1300 lines of marketing
   prose into German is a **content decision that belongs to the founder**, not
   something to decide inside a correction wave. Listed below.
3. **`<html lang>` is still hard-coded `"en"`** (`app/layout.tsx:105`). When the
   resolved language is German a screen reader announces German text with an
   English voice. `setLangChoice` deliberately does **not** flip the root
   attribute — doing so would mislabel the English landing. Correct fix is
   per-surface; reported, not half-done.
4. **Some public surfaces are single-language** (table above). Nothing regressed;
   they were never localised. Listed as a finding.
5. **The E2E run needed a local browser workaround.** This container ships
   Chromium 1194 while `@playwright/test` 1.59 expects revision 1217, so the
   revision directories were symlinked to run the suite. CI installs its own
   browser (`.github/workflows/e2e.yml`), so this affects only the local run —
   but it means the 140/140 came from a locally patched browser path, not a
   pristine one.
6. **One-frame locale flip persists.** SSR renders the surface default and the
   client corrects on mount. Unchanged from the shipped contract; a cookie mirror
   + SSR read would remove it and is a follow-up, not done here.

## Findings — reported, not fixed

| # | Finding | Where |
|---|---|---|
| F1 | `/signup` is whitelisted as public but no route exists; nothing links to it | `apps/web/middleware.ts:57` |
| F2 | `<html lang="en">` hard-coded; does not track the resolved language | `apps/web/app/layout.tsx:105` |
| F3 | `/models`, `/models/[id]` ship German-only prose on an otherwise English public path | `apps/web/app/models/page.tsx` |
| F4 | The legal footer mixes languages in one row: `Terms · Nutzung · Privacy · Imprint` | `apps/web/app/(legal)/layout.tsx` |
| F5 | `/help`'s back-link points at `/dashboard`, which sends a signed-out visitor to `/login` | `apps/web/app/help/page.tsx` |

## Fixed beyond the two units — one, and it is named

The landing nav's lockup and the "Start building" CTA **overlapped at 320px**
before this wave (the CTA's `white-space: nowrap` text runs past its own shrunken
flex box). It was found while checking the switcher against the prompt's 320px
constraint, and fixed in U2 rather than shipped as evidence of a collision this
wave chose to photograph and ignore. Four scoped rules in a `≤400px` media query;
`evidence/public-i18n/shots/landing-nav-320-*.png` is the after.

## Ledger

No change. Nothing in this wave adds a token path, an API call or an external
cost — `docs/GOBLIN_CONSUMPTION_LEDGER.md` needs no new M-line.

---

## Founder actions

**On the device (the gates automation cannot reach):**
1. Open the **installed PWA cold** → the landing header must be clear of the
   status bar: the GOBLIN lockup not on the clock, "Start building" not under the
   wifi/battery icons. Scroll to the bottom → the footer's last row must clear the
   home indicator.
2. Tap **DE**, then go to **Sign in** → the login page must be German, and stay
   German after navigating away and back. Tap **EN** → it must flip instantly,
   without a reload.
3. Walk the **EN visitor path end-to-end**: landing → Sign in → back → About →
   Help. All English, no German anywhere.
4. Worth a look while you are there: `/status`, `/help`, `/about`, 404 — all newly
   inset-treated.

**Decisions that are yours, not mine:**
- **D1** Translate the marketing landing copy to German? (Honest limit #2.) If
  yes, the switcher gains a fourth job and the landing stops being EN-only.
- **D2** `/models` German-only on an English public path (F3) — translate, or
  accept?
- **D3** F1 `/signup` — add a redirect to `/register`, or drop the middleware
  entry?

**Merged (PR #68, `--no-ff`, founder-granted).**

---

# UNIT 3 — regression fix: master went red after the merge

**This wave shipped a regression and this is the honest record of it.**

## What happened

PR #68 merged as `e8c82bc`. On that merge commit the `e2e` job **failed**:
14 `@auth` tests, all asserting German UI strings (`Modelle`, `Funktionen`,
`Hilfe`, `Meine Keys`). `CI`, `Typecheck & Build`, `Bundle Size Check`, `API unit
tests` and `Sentry Release` were all green.

## Cause — mine, and precisely locatable

U2 added browser detection to **both** locale bindings. It belongs on the public
one; on the **app** binding it is wrong. A signed-in session with no stored
`goblin:preferred-lang` on an `en-US` browser now resolved to English, so
`SettingsRoot.tsx:86`'s `t(lang, 'Modelle', 'Models')` rendered **"Models"**.
Every one of the 14 failures is that same substitution.

This was **not only a test failure**: any live account without that key would have
had its German UI silently flipped by its browser locale — precisely what the
"live cohort, additive only" rule exists to prevent.

## Why the PR was green and master was not

`PR64_ANSWERS.md:156-186`: the `@auth` projects silently establish their session
on **production**, because `localhost:3000` is not in Supabase's redirect
allowlist. During the PR runs, production was still serving the pre-merge build,
so those tests exercised the OLD locale behaviour and passed. The merge triggered
a Vercel production deploy; the master run was the first to see the new build.

**The lesson, recorded rather than smoothed over:** a green `@auth` result on a
PR says nothing about that PR's own diff. It is checkout-blind by construction.
Every gate table in this report already said "checkout, not production" — this is
what that caveat costs when the diff changes signed-in behaviour.

## The fix

`resolveLang()` gains `useDetection`, and `lib/use-lang.ts` (the app binding)
passes `useDetection: false`. The app goes stored-preference → German default,
exactly as before this wave. Detection stays on the public/pre-auth binding,
where the founder's fix needs it.

The rule that makes this correct rather than merely green: **detection answers
"we have never met, what should I guess?"** That is the anonymous visitor's
situation and never an established account's. A signed-in user has either
answered Step 0 (the stored preference already wins) or is a key-less legacy
account whose UI has always been German — and a browser locale is not a reason to
change it out from under them. An explicit DE·EN press still reaches every
surface, so the escape hatch stays open.

## Gates for U3

| Gate | Result | Tested against |
|---|---|---|
| Web vitest | 25 files / **246 tests**, 0 failures (was 239 — **+7 regression guards**) | checkout |
| `tsc --noEmit` (web) | clean | checkout |
| E2E `@public` (desktop + mobile) | **140/140** | checkout |
| Clean-visitor sweep, case B (`de-DE`) | public + auth still resolve **DE** — U2's fix intact | checkout |
| safe-area asserts | 73 / 33 / 11, 0 failures | checkout |

Three of the new guards are static and aimed at exactly this defect: the app
binding must carry `useDetection: false`, the public binding must not, and
`readLang()` on an English browser with nothing stored must still return `'de'`.

**The `@auth` suite still cannot be run from this container** (it needs the
Supabase test account and crosses to production). U3's evidence that the app
binding renders German is the unit + static guards, not a live `@auth` run — the
first real `@auth` verification will be CI on master after this lands.

**HALT — this fix needs its own merge grant, and master is red until it lands.**
The device walk above remains yours.
