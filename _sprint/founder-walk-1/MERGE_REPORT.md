# FOUNDER-WALK-1 — MERGE REPORT

**Branch:** `claude/founder-walk-1-srdrp9` (from `8cb313d`, the PR-#52 merge)
**Scope:** 23 files, +947/−343. **Web + docs only — zero `apps/api` files touched.**
**Suites:** web unit **97/97** · money-tagged API suites **80/80** (unaffected — no API change) · `tsc --noEmit` (web) clean.

Per-unit, revert-able commits (Gesetz 1 — one unit = one commit; U4 split 4a/4b vs 4c):

| Unit | What | Commit |
|---|---|---|
| U1 (P0) | Onboarding→dashboard loop in the installed PWA | `4ee6fe9` |
| U2 | Invite-code entry at the paywall | `8077d49` |
| U3 | Install-block v2 (four tabs, no icons) + legacy table removed | `83925cc` |
| U4a/4b | Admin audit + mobile-first shell + logo out + nav complete | `e359f5a` |
| U4c | Admin render bugs + broken-at-375px tables | `4a2ac5f` |

---

## U1 (P0) — the launch blocker · root cause + failing-then-passing test
Full diagnosis: `U1_ONBOARDING_LOOP_DIAGNOSIS.md`.

**Root cause (named, file:line):** the FW3 F-05 loop-breaker has ONE channel — a client-written
`document.cookie` (`goblin_onboarded`) the SSR dashboard guard reads back on the next navigation
(`lib/onboarding-gate.ts:75`, `app/dashboard/layout.tsx:72`, set at `app/welcome/build/page.tsx:30` +
`app/welcome/_components/chrome.tsx:72`). In an installed iOS PWA (standalone WebKit) that JS cookie is
not reliably visible to the same-navigation server read, so the sole loop-breaker goes missing, the
guard reads a stale `completed=false` with no cookie → redirects to `/welcome`, the forward leg
(service-role read = true) bounces back → the welcome↔dashboard oscillation the founder saw (spinner
loop, dashboard never reached), while the same account reached the dashboard in a Safari tab and
completion still persisted.

**Fix (root; extend F-05, don't fork):** a second, storage-independent channel — `?onboarded=1` on the
post-onboarding navigation — that `middleware.ts` promotes into the SAME cookie on both the forwarded
request and the response. Robust across the standalone candidate causes (cookie-in-standalone, the
middleware↔flag bounce, a stale user read) since the URL signal is authoritative and DB-independent.

**Gate:** `lib/onboarding-gate.test.ts` — an installed-PWA model that DROPS the client cookie (the
standalone condition) and keeps the DB read stale-false: **oscillates without** the new channel,
**settles on `/dashboard` with** it. 8/8 → **13/13**, `tsc` clean. Regression: the JS-cookie fast path
and the 8 original FW3 probes (non-standalone) are untouched.

## U2 — invite-code at the paywall
The redemption entry now sits where the user meets the plan decision (the `trial-gate` paywall), a quiet
"Hast du einen Invite-Code?" below the plan options that expands the **same** `PromoCodeField` inline.
**Single-component proof:** redemption logic lives only in `lib/promo-redeem.ts`; the expandable UI only
in `PromoCodeField.tsx` (now with an optional `collapsedLabel` prop, default unchanged so settings/billing
is identical). Zero new redemption paths. Money suites untouched-green.

## U3 — install-block v2
Four always-selectable tabs (iOS · Android · Mac · Windows); detection picks the default
(`defaultInstallTab`, unit-tested), every tab clickable with a 2–3 step numbered instruction. The
`beforeinstallprompt` path is kept 1:1 — the real button shows only on the detected tab when the event
fired (`showNativeInstallButton`, iOS never gets a button); the real inline Share glyph stays. No
pictographic device icons. **Legacy table removed:** the bottom-of-landing device tiles
(macOS/Windows/Linux/iPhone/iPad/Android) deleted from `Footer.tsx` + orphaned `.footer-devices` CSS;
no refs remain (grep). Detection tests 28 → 36.

## U4 — admin console
**4a audit:** `ADMIN_AUDIT.md` — all 11 `/admin` routes (purpose, data source, 375px state, render bugs).
**4b shell:** mobile-first rebuild — phone gets a top bar + horizontal-scroll tabs with safe-area insets
and ≥44px targets, desktop keeps the sidebar; the old `👺` logo → GOBLIN wordmark; Costs + Rankings added
to the nav (existed but were unreachable). **4c fixes:** `U4_FIXES.md` — the builds non-array crash
guarded; wide tables wrapped in horizontal scroll (builds/models/costs/rankings/catalog); unguarded
number renders guarded (telemetry/costs/catalog/users MRR); users stat grid made responsive.

---

## Self-review checklist (Gesetz 2 · the Steven-question)
1. **Evidence audit** — U1 test runs red-shaped (oscillation) / green (settles); pwa-install 36/36; web
   suite 97/97. The admin audit + U4c fixes are type-checked; **screenshots NOT produced** (see below).
2. **Diffstat vs scope** — 23 files, each justified by a unit; no `apps/api`, no consumption path.
3. **Regression** — FW3's 8 probes intact; settings/billing PromoCodeField default unchanged; landing
   Footer only lost the device table; admin pages: additive guards + wrappers, no logic rewrites.
4. **Honesty sweep** — new strings DE+EN, design-system tokens, no phantom affordances, no invented
   claims/times. "Invite-Code" is accurate (the codes going to invitees are these promo codes).
5. **Ledger** — no token/API cost change → no `GOBLIN_CONSUMPTION_LEDGER.md` line (Gesetz 5 satisfied).
6. **Migrations** — none authored this wave.

## Honest-Limitations (Pflicht)
- **U1's exact WebKit reason** the JS cookie is missing in standalone is **founder-device-confirmable
  only** — a headless browser can't reproduce true iOS "Add to Home Screen" cookie behavior. The
  diagnosis holds because the founder split (Safari works / PWA loops / completion persisted) is the
  signature of the single cookie channel failing while the DB read stays stale, and the fix removes that
  single point of failure regardless of the exact quirk.
- **No running app in this environment** (no Supabase/admin env, no browser). So: **no screenshot gates
  were produced** for U2 (paywall 375px dark+light DE+EN), U3 (four tab states), or U4 (every admin page
  375px+desktop dark+light). These are the founder's on-device confirmation. Every change is type-checked
  and, where pure logic exists (U1, U3 detection), unit-tested; the inline-styled admin pages have `tsc`
  + suite-green as their guarantee, not a render assertion.
- **U4c is render-fixes only.** Behaviour findings (mutation error surfaces, users pagination
  double-filter, models optimistic-toggle divergence, telemetry `calibrated` dead-data, health SSR guard)
  are documented as **deferred findings**, not fixed — they need a live admin session to verify safely.

## Founder-action list (re-walk on the TEST account `vinc.hafner3@`, NEVER the personal account)
1. **U1 (P0):** fresh signup in the **installed PWA** → onboarding → confirm the dashboard is reached
   with **no spinner loop**. Also re-confirm normal-Safari signup + login still land on the dashboard.
2. **U2:** on the paywall/trial-gate, confirm "Hast du einen Invite-Code?" appears below the plan
   options, expands, and redeems a real code end-to-end.
3. **U3:** on the landing page, confirm the four-tab install block (right default tab per device, all
   tabs clickable, no device icons) and that the old bottom-of-page device table is gone.
4. **U4:** from an iPhone, confirm `/admin/insight`, `/admin/promo`, `/admin/costs` are workable (nav
   reachable, tables scroll, no old logo); spot-check the other tabs load + render real data.

**PR + HALT — merge founder-granted.**
