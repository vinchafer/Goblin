# WAVE — ABOUT & MANIFESTO

**Branch:** `claude/about-manifesto-pages-0ork1e` · fresh from `master` @ `70ff061`
**Scope:** the two public prose routes, `/about` and `/manifesto`. No app surface touched.
**Live-user constraint:** the first cohort received invitations 2026-08-09 and is on the product. Every file in this wave is a public, signed-out route or its test. `app/page.tsx` (the landing) is deliberately **unmodified**.

---

## Phase 0 — state-first, before building

The prompt asked two questions and made three assumptions. The repo answered differently on four of the five points, so they are recorded here rather than silently absorbed.

| Prompt said | Repo truth |
|---|---|
| "does `/about` exist (PR #68 bound it to the app locale hook)" | **Existed.** And the PR-#68 fix had already landed (`39207ed`): it was already on `useAuthLang()`. |
| "does a manifesto route exist at all" | **Existed** — and was the live instance of the leak class. A server component, every string hardcoded English, **no locale binding of any kind**. Not the wrong hook; no hook. |
| both pages carry the new copy | **No.** Both carried unrelated placeholder prose ("Simplicity is the moat", "calm, not cluttered"). |
| "the assert scripts … must cover the new routes; extend them" | The routes are **not new**. Both were already in `middleware.ts`'s `isPublic` allowlist (lines 75–76) and already asserted in `evidence/pwa-safearea/`. |
| the assert scripts enumerate the `isPublic` allowlist | **Correct** — `assert-safe-area.mjs:127` enumerates it and pins the count at 23. (An earlier note in this session said otherwise; that was a bad grep, corrected here.) |

**Consequence for the task:** this was a copy-and-typography replacement on two existing public routes, plus one genuine live defect (`/manifesto`'s missing locale binding) that fell inside the mandate rather than beside it.

---

## What shipped — four revert-ready units

| Unit | Commit | What |
|---|---|---|
| U1 | `a22a8f4` | `lib/copy/{about,manifesto}.ts` + `rich-text.tsx` — all prose as locale keys, 25 `@needs-german` markers, 13 unit tests |
| U2 | `6caf4ca` | `PublicPageShell`, `Nav` gains `anchorBase`, `landing.css` §18 prose type scale |
| U3 | `55ddc58` | Both routes rebuilt; `/manifesto` gets a locale binding; sitemap entries |
| U4 | `cfc1bdb` | Assert scripts extended, new E2E suite, locale guard updated, 24 renders + grep proof |

### The German decision
Every `de` value is the **English text**, marked `@needs-german`. This is a choice, not an omission. The copy's mechanism is its rhythm — long, long, short, and the short sentence is the one that lands. A machine translation preserves the meaning and destroys the mechanism, and does so *invisibly*: nobody reviewing an English diff can see that the German has gone flat. English under a `de` key is a gap that announces itself to the reader. Bad German would be a hidden one.

Page **chrome** (back link, eyebrow) *is* translated — a UI label has no rhythm to lose. So a German visitor gets a German frame around English prose, and can see exactly what is outstanding.

---

## Gate results

All numbers below were produced by running the thing named, in this session.

| Gate | Result |
|---|---|
| `tsc --noEmit` (web) | clean |
| `next build` (web) | success; `/about` and `/manifesto` prerendered static |
| web vitest | **411 / 411** (34 files) |
| api vitest | **1721 / 1721** (151 files) — real test-mode Stripe money suites executed |
| money-suite guard, `CI=true` (armed) | **1 / 1 pass** |
| `assert-safe-area.mjs` | **80 / 80** (was 73 / 73) |
| `assert-safe-area-bottom.mjs` | **34 / 34** (was 33 / 33) |
| E2E `48-about-manifesto` | **22 / 22** (11 tests × Desktop Chrome + Pixel 7) |
| E2E full `@public` suite | **168 / 168** |
| grep proof, no hardcoded user-facing string | **10 / 10** |
| Copy verbatim vs. source document | **32 / 33** source paragraphs byte-identical (see Honest Limitations) |
| eslint | 135 errors — **identical on clean `master`**; this wave's files: **0** |

### CI, read at job-log level (PR #81, head `66b00a6`)

| Workflow | Run | Result |
|---|---|---|
| CI | [31344170176](https://github.com/vinchafer/Goblin/actions/runs/31344170176) | **success** — typecheck shared + web, build, web vitest, api vitest **1721/1721** |
| E2E Tests | [31344170158](https://github.com/vinchafer/Goblin/actions/runs/31344170158) | **success** — **197 passed, 1 flaky** |
| Performance Budget | [31344170171](https://github.com/vinchafer/Goblin/actions/runs/31344170171) | **success** |

**Money guard, armed.** GitHub sets `CI=true`, which arms `money-suite-guard.test.ts` — the job fails if the Stripe test-mode secrets are absent, so a green run cannot hide a silent money-test skip. The guard passed *and* the suites it guards actually executed: plan-change PROOFs 1–4 and 7, account-deletion PROOFs 1–6, immediate-proration PROOFs A–C, all against real test-mode Stripe. Zero skip lines in the log.

**All 22 of this wave's new E2E tests passed in CI** (11 × `public-desktop` + `public-mobile`), verified by name in the job log.

**The one flake is pre-existing and not this wave's.** `19-mobile-create-project.spec.ts` (@auth-mobile) timed out on `waitForURL` and passed on retry. The same test flaked on **master at this branch's exact base commit** — run [31249171854](https://github.com/vinchafer/Goblin/actions/runs/31249171854) (`70ff0619`) reported **2 flaky**, including this one. This branch has fewer flakes than its base, and the test is on an `@auth` dashboard path no file in this diff touches.

**Renders:** 24 in `evidence/about-manifesto/` — both pages × {375, 320, desktop} × {dark, light} × {EN, DE}. Re-runnable: `node evidence/about-manifesto/shots.mjs [baseURL]`.

---

---

## FOLLOW-UP (2026-08-10) — a seventh belief, and English-only prose

### 1. Belief 7 — the pricing claim, verified before it shipped

`/manifesto` gains a seventh belief, placed last: *"One price for the world isn't fair — it's lazy."* The H1 becomes **"Seven things we believe"**.

This is the only belief on the page that makes a **checkable claim about what Goblin currently does**, on the page whose first belief is that we never claim an unverified state. So it was checked before it was written, not after.

**What was verified — regional pricing is live, unflagged, in production today.**
`GET /api/billing/geo-pricing` is a public, unauthenticated, unconditional endpoint. Queried against the live API (`goblinapi-production.up.railway.app`) on 2026-08-10:

| Country | Tier | Build / Pro / Power |
|---|---|---|
| CH, US | 1 | $11 / **$19** / $39 |
| AR, BR | 2 | $7 / **$12** / $25 |
| NG, PH, IN | 3 | $4 / **$7** / $14 |

There is **no feature flag** — no `ENABLE_GEO_*`, no gate of any kind; `getGeoTier()` is called directly on the `CF-IPCountry` header. The four cities the copy names resolve exactly as the copy says: Zurich Tier 1, Lagos and Manila Tier 3, Buenos Aires Tier 2. A standing guard test now pins those four (`apps/api/src/config/geo-pricing.test.ts`), so flattening them fails CI with a note that a shipped page says otherwise.

**⚠ What this does NOT prove — and what the founder should check.**
The verification above covers the price a visitor is **shown**. The price actually **charged** comes from `getPriceForTier()`, which reads `STRIPE_PRICE_<PLAN>_TIER<n>` and — by design, pinned by its own test — **silently falls back to the Tier 1 price id when a tier is unconfigured**. Three facts make that worth a look:

- The startup guard (`apps/api/src/index.ts:7`) requires **only** `..._TIER1`. TIER2/TIER3 are optional; the API boots happily without them.
- `docs/ENV_REFERENCE.md` documents **only** the three TIER1 vars. TIER2/TIER3 appear nowhere in it.
- CI injects only the three TIER1 secrets, so even the real-Stripe money suites never exercise a tier-2/3 price id.

If TIER2/TIER3 are not set in Railway, a Lagos visitor is **shown $7 and charged $11** — `amount` comes from the `PLAN_PRICES` table while `priceId` falls back to Tier 1, and the confirm-price check cannot catch it because both sides echo the same fallback id. I could not read production env from this session (no secrets in session, correctly), so this is **unverified, not disproven**. It is a money-path question and out of this copy wave's scope to change — reported, not touched. See founder actions.

### 2. Both pages are now fully English, by decision

Founder decision: German chrome ("Über uns", "Manifest", "← Zurück") above English prose read as a broken translation rather than a declared gap. Every user-facing string on `/about` and `/manifesto` — headings, chrome, meta — is now English for every visitor.

**The i18n structure is untouched.** Both locales still exist, every string still lives in `lib/copy/`, nothing is hardcoded in a component, and the DE keys still carry `@needs-german` (16 on `/about`, 13 on `/manifesto`). Only the *selection* is pinned, in one place: `lib/copy/prose-locale.ts`, `PROSE_GERMAN_READY = false`.

`<html lang>` reads from **that same value**, which is the part that matters: an English page must never announce itself as `lang="de"`, or a screen reader applies German pronunciation to English prose — the PR-#68 defect class, inverted. Content and `lang` cannot drift because they are one value. Flipping the constant turns both back on together.

Nothing else on the site changes — `/help`, `/login`, the legal pages and the app all still resolve normally, and the footer DE·EN switcher still sets the language of sign-in and the app. A test pins that too.

### Follow-up gates

| Gate | Result |
|---|---|
| tsc (web) | clean |
| next build | success; both routes still prerendered static |
| web vitest | **414 / 414** (was 411) |
| api vitest | **1723 / 1723** (was 1721) — the two new belief-7 guards |
| money-suite guard, `CI=true` armed | **1 / 1** |
| `assert-safe-area.mjs` | **80 / 80** |
| `assert-safe-area-bottom.mjs` | **34 / 34** |
| grep proof | **14 / 14** (was 10) — adds "no DE value is a literal" per page + the switch itself |
| E2E full `@public` | **168 / 168** |
| Renders | 24 re-shot; the DE runs now photograph a fully English page |

Two of the new gates are worth naming, because they exist to catch this wave's specific failure mode: **"no DE value is a literal — all reference the EN copy"** (a German back-link cannot creep back in) and **"the prose pages drive `<html lang>` from the same value as the copy"** (the two halves cannot disagree).

## Honest Limitations

1. **The German is not German.** 29 keys hold English text behind a `de` marker, and as of the follow-up the page is English end-to-end for every visitor by decision. Until real German prose lands, these pages are not bilingual — they are bilingual-*shaped*, with the shape kept only so the German is a one-file edit when it comes.

1b. **The charged price for tiers 2 and 3 is unverified.** Regional pricing is confirmed live on the display side (see the follow-up section), but whether `STRIPE_PRICE_*_TIER2/TIER3` are set in Railway could not be checked from this session, and the code silently falls back to Tier 1 if they are not. Belief 7's claim is verified for what a visitor is *shown*; it is unproven for what a card is *charged*.

2. **One line is not stored verbatim.** `**Tell it what you want. It ships.**` is stored as `soKicker` without the `**` markers, because it renders as a display line (`.lp-prose-kicker`, weight 700) rather than as inline emphasis. It appears bold on the page — confirmed in the desktop render — but a byte-comparison against the source document reports 32/33 rather than 33/33, and that is the reason.

3. **Metadata is English-only.** `<title>` and `<meta description>` come from the EN keys on both routes. The resolved locale is a client-side answer that server-rendered `<head>` cannot know. `<html lang>` *is* corrected client-side. A German-locale crawler therefore sees English metadata. Fixing this properly needs a server-readable locale signal (a cookie), which is a locale-architecture change and out of this wave's scope.

4. **Renders are Chromium-only, and not on a real device.** All 24 shots come from headless Chromium at DPR 2 with emulated viewports. `env(safe-area-inset-*)` is **zero** in that environment, so the screenshots prove layout, type and theme — they do **not** prove the notch/home-indicator behaviour. That is covered deterministically by the assert scripts reading the shipped CSS, which is source verification, not a rendered observation. **Nobody has yet opened these pages on a physical iPhone.**

5. **The sandbox's Chromium is not the repo's pinned build.** `@playwright/test` 1.59.1 wants browser revision 1217; this environment has 1194 (Chromium 141). I symlinked 1194 into the expected path to run the suites. The E2E results above are therefore from Chromium 141, not the pinned revision. CI uses the pinned one.

6. **eslint is red and was already red.** 135 errors on a clean `master` checkout, unchanged by this wave, and CI does not run lint. Not fixed here — out of scope, and it would be a large unrelated diff.

7. **`next-env.d.ts` churn.** Running `next build` rewrites this generated file. Reverted before committing; it is not in the diff.

8. **Consumption ledger: no line needed.** Two static prerendered pages, no model calls, no new external service, no token path. `docs/GOBLIN_CONSUMPTION_LEDGER.md` is unchanged, deliberately (Law 5 checked, not skipped).

9. **The old `/manifesto` → `/changelog` link is gone.** The placeholder page ended with "See what we've shipped →". The new copy ends on the signup CTA, per spec. `/changelog` remains linked from the footer of both pages.

10. **Nothing was verified in production.** This is branch work; no deploy, no live check.

---

## Founder actions

0. **Check Railway for `STRIPE_PRICE_BUILD_TIER2/TIER3`, `STRIPE_PRICE_PRO_TIER2/TIER3`, `STRIPE_PRICE_POWER_TIER2/TIER3`.** This is the one that carries money. If any is unset, a tier-2/3 customer is shown the regional amount and charged the Tier-1 price id, silently — and `/manifesto` now publicly promises regional pricing. Two minutes in the Railway dashboard settles it. If they are set, nothing to do; if they are not, that is a live billing bug independent of this PR, and the honest interim move is to hold belief 7 rather than the pricing.
1. **Open both pages on a device.** `/about` and `/manifesto` on a physical iPhone, standalone-PWA if possible — the safe-area behaviour is the one thing the evidence here cannot show (Limitation 4). The PR's Vercel preview is the quickest route.
2. **Supply the German prose.** `apps/web/lib/copy/about.ts` and `apps/web/lib/copy/manifesto.ts`, the `de` blocks. Replace the values, delete the `@needs-german` markers, and flip `PROSE_GERMAN_READY` to `true` in `apps/web/lib/copy/prose-locale.ts` — that one constant turns the copy *and* `<html lang>` back on together. Nothing else needs to change; the DE/EN shape-parity test will catch a dropped paragraph.
3. **Read the copy as shipped**, not as written — the line breaks and the emphasis are a design decision this wave made on top of the prose (see the numbered-belief hierarchy and the serif italics).
4. **Merge is yours.** PR opened, not merged.
