# FOUNDER-WALK-2 — Merge Report

**Branch:** `claude/founder-walk-2-dmtl7v` (from `origin/master` @ `1b54005` — the PR #53 merge)
**Scope:** 9 isolated, revert-ready commits. `apps/web` + `evidence/` only — **zero** `apps/api`/money code touched.
**Baselines held:** web `tsc --noEmit` clean · web build compiles · web unit suite **126/126** green.

Each unit = one commit. Findings from the founder's second prod walk (screenshots = ground truth).

| Unit | Commit | What | Gate (re-opened & checked) |
|---|---|---|---|
| U1 | `ccff8c7` | Mobile admin nav — kill the colliding-tabs strip | `assert-admin-nav.mjs` **10/10** + 375px renders (dark+light) |
| U2 | `437befb` | Landing "no app store" line (DE+EN) | `assert-landing-note.mjs` **8/8** + 375px DE/EN × light/dark |
| U3 | `5ee9382` | Tour popup dark-mode contrast | `assert-tour-contrast.mjs` **14/14** WCAG + 375px renders |
| U4 | `6a881b6` | Safe-area for the onboarding/welcome flow | safe-area asserts **top 20/20 · bottom 21/21** + before/after render |
| U5.1 | `7911d13` | Mutation error surfaces (users/models/status/promo) | `mutation-error.test.ts` **10/10** |
| U5.2 | `eb7e3f4` | Users pagination double-filter | `pagination.test.ts` **7/7** (incl. the regression) |
| U5.3 | `c5d48f2` | Models optimistic-toggle divergence | `optimistic-toggle.test.ts` **4/4** |
| U5.4 | `64a32f2` | Telemetry calibrated dead-data | `telemetry-state.test.ts` **4/4** |
| U5.5 | `ff2dec4` | Health page SSR guard | `settle.test.ts` **4/4** |

## Unit detail

### U1 — Admin nav (`components/admin/admin-shell.tsx`)
The founder saw the mobile tab row as one run of text ("HealthInsightCosts PromoUsers ModelsCatalog…"
with "Ops" wrapping): a 4px gap + no per-tab framing made the labels read as a single string.
Rebuilt: **gap 16px**, per-tab bounded ≥44px touch targets, **gold-underline active indicator**,
a **right-edge fade** scroll affordance, founder-relevance order (**Insight·Promo·Costs·Users·Health**
first), "Catalog Ops" a single non-wrapping label. Desktop sidebar untouched (the new scroller is a
passthrough there). **No collision possible ≥320px** — `overflow-x:auto` + `white-space:nowrap` +
generous gap. Proof: deterministic CSS assertions + real renders showing separated tabs and the fade.

### U2 — Landing line (`components/landing/sections/InstallAppBlock.tsx`)
Chosen phrasing (the confident option, per brief — not the apologetic "…yet"):
- DE „Bewusst in keinem App Store — Goblin kommt direkt aufs Gerät."
- EN "Deliberately not in any app store — Goblin goes straight to your device."
Under the block, i18n-wired (`t(lang, …)`), meta typography (`--ink-3`/`--small`), no icons.

### U3 — Tour contrast (`components/onboarding/first-run-tour.tsx`)
**Diagnosis:** the card hard-coded `background:#fff` (a LOCKED light anchor) while using flip-aware text
tokens, so in dark mode the text flipped light on the light card — the founder's unreadable pale-gold
title. **Design-system-consistent fix** (the app's own P1.1 pattern): flip SURFACE + TEXT together —
card → `--panel` (#FFFFFF light / #08170F dark). Swept the whole popup family: progress fill
`--brand-green` → `--brand-fg` (sage in dark; the locked green was ~1.6:1 → invisible); skip link
`--disabled` → `--meta` (`--disabled` fails AA on both surfaces). Computed WCAG for every text element:

| Element | Light | Dark |
|---|---|---|
| Title (`--text` on card) | 15.17:1 | 17.21:1 |
| Body (`--meta` on card) | 7.26:1 | 5.23:1 |
| Skip link (`--meta` on card) | 7.26:1 | 5.23:1 |
| Next button (`--brand-gold` on `--brand-green`) | 5.58:1 | 5.58:1 |
| Close × (`--meta` on `--div`) | 5.41:1 | 4.57:1 |
| Progress fill vs card (UI, ≥3:1) | 12.48:1 | 6.97:1 |
| Progress fill vs track (UI, ≥3:1) | 9.31:1 | 6.10:1 |

Every text element clears AA (≥4.5:1) in **both** modes; lowest text = 4.57:1 (close × dark).

### U4 — Safe-area (`app/welcome/_components/chrome.tsx`, tour card)
The /welcome flow was never covered by #41/#44 (they treated the app shell). Applied the **shipped
`env()` idiom** (no new mechanism): header `padding-top: calc(22px + env(top))` + left/right insets;
footer `padding-bottom: calc(18px + env(bottom))` + left/right; tour card `bottom: calc(80px +
env(bottom))`. **Path audit (signup→onboarding→dashboard):** `(auth)` login centers its card in
`100dvh` with 40px padding → not edge-anchored, no inset needed; `/onboarding` redirects to
`/dashboard`; `/welcome/*` step pages flow inside the chrome (footer is the bottom anchor, now inset);
dashboard shell already covered by #41/#44. Extended the shipped assert scripts (top 16→20, bottom
18→21). Before/after render (simulated iOS chrome) shows the logo clearing the status bar and the
footer clearing the home indicator.

### U5 — the five deferred behavior findings (`_sprint/founder-walk-1/U4_FIXES.md`)
Each its own commit + a pure, tested helper under `lib/admin/`:
1. **Mutation error surfaces** — every admin mutation now checks the response and shows an honest,
   visible danger banner on failure (modal stays open); promo no longer flashes "Label gespeichert"
   without saving. Messages match each page's language (English console; promo German).
2. **Users pagination double-filter** — removed the redundant client filter (server already searched);
   paginate on the RAW page fill so a full page always offers Next.
3. **Models optimistic-toggle divergence** — optimistic flip, then reconcile to server truth + honest
   error on failure (was: flip unconditionally, even on a failed request).
4. **Telemetry calibrated dead-data** — badge derived from `data.calibrated` (was hard-coded "not yet
   calibrated"); honest empty note when there's no usage; spend marked "provisional estimate" while
   uncalibrated. No fabricated-looking numbers.
5. **Health SSR guard** — each of the four fetches wrapped in `settle()` so one rejected query can't
   crash SSR; a failed section degrades to an honest "unavailable" note (counts shown as —).

## Honest-Limitations (mandatory)
- **Renders are harnesses, not the running app.** The 375px screenshots come from standalone HTML that
  replicates the shipped CSS/markup + resolved design tokens; the deterministic assert scripts grep the
  REAL source so the rules are provably shipped, but no running Next/browser session drove the real
  components here. **Founder-verify on device**: admin nav scroll feel on a physical iPhone; the tour
  popup over the real dashboard; **U4 insets on an actual notched device** — `env(safe-area-inset-*)`
  is 0 in every non-device browser, so the before/after uses SIMULATED insets.
- **U5.1–5.4 need a live admin session to see end-to-end.** No admin auth/API existed in this sandbox,
  so the fixes are unit-tested (pure helpers) + type-checked + build-verified + code-reviewed, not
  driven against the live API. Founder spot-check: trigger a failing mutation → honest banner; page
  Users past 20; toggle a model with the API down → it reverts; open Telemetry with zero usage → empty
  note; confirm Health still loads if a query fails.
- **Money suite:** untouched by construction (diff is `apps/web` + `evidence` only). The real-Stripe
  money suites run in CI (`api-tests`, guard-armed); they were not run in this sandbox (they require
  test-mode Stripe secrets and skip locally). No consumption/ledger change (no new API calls, no model
  usage) → no ledger line.

## Founder-action list (short re-walk)
1. Admin nav scrolls cleanly — Insight·Promo·Costs·Users·Health lead, gold underline on the active tab,
   fade at the right edge, no colliding text.
2. Landing sentence reads right — quiet line under the install block (DE/EN).
3. Tour popup readable in dark — dark card, bright title (was pale-gold/invisible).
4. Onboarding header/footer clear on device — GOBLIN below the clock, footer above the home indicator
   (needs a notched iPhone to confirm).
5. Spot-check the five admin behaviors (see Honest-Limitations).

**PR opened → HALT. Merge is founder-granted.**
