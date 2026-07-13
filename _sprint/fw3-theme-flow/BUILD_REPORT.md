# FIX-WAVE 3 — Theme & Flow · BUILD REPORT

**Branch:** `claude/fix-wave-3-theme-flow-ya3o6s` (from `master` @ 660d8b5)
**Date:** 2026-07-13 · Cloud session (Opus)
**Status:** ✅ all 5 units built + evidenced · **HALT for founder Vercel-preview review** (U3 taste gate)

Per-unit, revert-able commits (one unit = one commit, Gesetz 1):

| Unit | Finding | Commit |
|---|---|---|
| U1 | F-05 post-onboarding flicker-loop | `95e3c04` |
| U4 | F-09 project missing from sidebar | `e0dca27` |
| U2 | F-03/04/06/07/08 theme contrast cluster | `be764fc` |
| U3 | D-B Sage & Copper palette (Option 2) | `5be5740` |
| U5 | D-A banner removal + F-32 purchase confirmation | `bcb2493` |
| — | lint parity (no net-new set-state-in-effect) | `660efe8` |

Build order followed the prompt: **U1 reproduce-first → U4 → U2 root-cause → U3 palette on the fixed base → U5.**

---

## U1 — F-05 post-onboarding flicker-loop (P0, reproduce-first)

**Race pinned in code** (not reproduced live — see Honest-Limitations). Two guards read the
same `onboarding_steps.completed` flag through **different** Supabase clients on the
onboarding-exit path:
- **Back leg** `app/dashboard/layout.tsx:65-88` — server, USER-scoped SSR client (RLS applied):
  a stale/RLS-filtered `false` → `redirect('/welcome/language')`.
- **Forward leg** `app/welcome/_components/chrome.tsx:64-77` — client, API SERVICE-ROLE read
  (RLS bypassed): `true` → `router.replace('/dashboard')`.

The completion write (`welcome/build` → `PUT /api/onboarding/state`) is done by the service role
and is best-effort/async. In the window between that write committing and it becoming visible to
the user-scoped SSR read (replication lag, or a straight RLS read-asymmetry), the back leg reads
stale-false and bounces to `/welcome`, the forward leg reads fresh-true and bounces to
`/dashboard` — endless oscillation, only for `isNewUser` (< 10 min) accounts. Matches the founder
repro (escaped via manual `/dashboard`) and its intermittency.

**Fix (root + defensive):** a synchronous handshake the server guard trusts in the same
navigation, independent of DB replication/RLS. `welcome/build` sets a short-lived
`goblin_onboarded` cookie the instant onboarding finishes (chrome sets it too when it observes
completion); the dashboard back leg treats its presence as authoritative and never redirects
back — a grace state that never bounces backward, so the loop is impossible even while the read
is still stale. Decision extracted to a pure `resolveOnboardingGate()` (`lib/onboarding-gate.ts`).

**Gate evidence:** `lib/onboarding-gate.test.ts` (8 tests) — models both guards and proves the
system **oscillates without** the handshake and **settles on /dashboard immediately with** it,
plus the stale-read probe.

## U2 — Theme contrast cluster root cause (F-03/04/06/07/08 + W2-7)

**Root cause named:** one dominant anti-pattern — a LOCKED brand foreground
(`--brand-green`/`--ink-deep`, or literal `rgba(0,0,0,x)`) used as **text** on a surface that
**flips** → dark-green/black on a dark surface, invisible — plus two token-coverage gaps and one
theme-state wiring bug. NOT five hand-patched values.

Root fixes (`styles/design-tokens.css`, `app/globals.css`, + the affected surfaces):
- **`--brand-fg`** — new flip-aware brand foreground (brand green in light, sage in dark), the
  twin of the locked `--brand-green` anchor. Repointed `.section-title`/`.page-hero-title`/
  `.msg-mark` + the inline usages (trial-gate headline/secondary button, sidebar active labels +
  collapsed icon, quota bar fill + plan label).
- **F-03/04** trial-gate: `rgba(0,0,0,.6/.55)` body → `--text-2`.
- **F-06** sidebar quota card: invisible `rgba(15,43,30,x)` card/track → flip-aware `color-mix`;
  the "Kein Abo" pill (`--green-700` on `--accent-soft`) → a neutral chip.
- **W2-7** notice card: cream-on-gold → locked `--ink-deep` on gold; the Stripe Elements form now
  flips (`theme:'night'`) instead of a white card in a dark modal.
- **Structural gap A:** gave the Tailwind `@theme` surface literals (`--color-surface-*`,
  `--color-paper/-bone`) dark overrides so every `@theme` surface consumer (the usage bars) heals
  at the root.
- **F-07/F-08:** the settings appearance toggle persisted `goblin_theme` but never applied
  `data-theme`. Routed `AppearanceSection` + `SettingsRoot` through the one `ThemeProvider`
  (`setTheme` applies live); extracted `resolveTheme()` (`lib/theme-resolve.ts`) as the single
  system-follow rule.

**Gate evidence:**
- `evidence/fw3-theme/all-surfaces-{light,dark}.png` — production-faithful (`data-theme` on
  `<html>`) renders of all five surfaces in light AND dark, all legible.
- `evidence/fw3-theme/contrast-table.md` — **12/12 WCAG-AA pairings pass** (tightest 4.72).
- `lib/theme-resolve.test.ts` (5) — F-08: system follows the OS live; explicit choice never does.

## U3 — D-B Sage & Copper palette (Option 2) · TASTE GATE

Founder-decided palette applied **purely at the token layer** on the U2-fixed base. Deep green
stays the anchor; the ochre/terracotta warm accents are retired for **sage (primary)** + **copper
(secondary)**. New `--sage`/`--copper` primitives + a semantic `--accent-primary`/`-secondary`
layer; interactive gold accents (focus ring, active tab underline, active sidebar tint, streaming
cursor, project-card edge, dashboard `--accent`) → sage; ochre/terracotta decorative (ochre
badge, ochre status dot, the "Rust" project swatch) → copper.

**Hard condition met:** only the accent HUE changes — surfaces stay the deep-green anchor, so dark
mode remains unmistakably dark (see evidence).

**Contrast duty (adjusted shades, stated):** base sage `#7FA98A` fails 3:1 UI on the light cream
surfaces, so `--accent-primary` flips to the deeper `--sage-strong #5E8973` in light (3.7:1) and
base sage in dark (5.3:1); copper text ink `--copper-strong` flips `#9C4E34` (light 4.8:1) /
`#DDA085` (dark 6.3:1).

**Gate evidence:** `evidence/fw3-palette/palette-old-vs-new-{light,dark}.png` (old→new side-by-side
on swatches, code tabs, dashboard active row, chat link/cursor, focus ring, report card) +
`contrast-table.md` (**8/8 pass** their WCAG threshold).

## U4 — F-09 project missing from sidebar

The sidebar renders from the **force-dynamic dashboard layout's server prop**, only recomputed on
a full load or `router.refresh()`. Every create path did a client `router.push()` that keeps the
layout mounted, so a new project showed on the projects page (its own client fetch) but not in the
sidebar until reload. **Fix:** `refreshThenNavigate()` (`lib/post-create-nav.ts`) issues
`router.refresh()` before navigating; wired into all three `NewProjectModal` success exits.
**Gate:** `lib/post-create-nav.test.ts` (2) — refresh issued once and before the navigation.

## U5 — D-A banner removal + F-32 purchase confirmation

- **D-A:** removed the active-trial upgrade nudge ("Tag X von 7 … Upgrade →") from `TrialBanner`;
  it now renders only the functional expired-state reminder. TRIAL-7's `AchievementUpgradeCard`
  (in `SessionPane`) is a separate component, **untouched** — its earned-moment nudge still fires.
- **F-32:** `PurchaseConfirmation` — a single warm, honest celebration that triggers off the
  **webhook-confirmed** billing state (`planState === 'paid'`), NEVER the checkout redirect, so a
  failed/pending checkout can never fire a false celebration (honesty invariant). Shows once per
  plan. Numbers ("≈ 200 Builds / month", "40 GB") come from the single sources (`plan-builds.ts`,
  `plan-storage.ts`) — never hardcoded. DE + EN. One CTA back to work.

**Gate evidence:** `lib/purchase-confirmation.test.ts` (9) — renders on verified paid, never on
trial/none/comped/pending, once per plan, with the exact single-sourced numbers;
`evidence/fw3-purchase/purchase-confirmation-{light,dark}.png`.

---

## Self-review checklist (Gesetz 2 · CC before merge)

1. **Evidence audit:** every screenshot + contrast table re-opened and verified; they show what
   this report claims. ✔
2. **Diffstat vs scope:** 25 files, each justified by a unit; no drive-by fixes (the unused
   `app-shell/new-project-modal.tsx` was left untouched). ✔
3. **Regression:** full web suite 49/49 green (incl. pre-existing tests); tsc clean. ✔
4. **Honesty sweep:** new user strings are DE + EN, real numbers, no invented claims (F-32 fires
   only on verified state). ✔
5. **Ledger:** no token/LLM-cost paths changed → **no `GOBLIN_CONSUMPTION_LEDGER.md` line
   needed.** One note: `PurchaseConfirmation` adds a `GET /api/billing/status` per dashboard mount
   (a DB-read status call, no token/COGS), in line with the existing per-mount reads
   (`TrialBanner`, `SidebarUsage`). ✔
6. **Verification:** tsc clean, 49/49 tests, screenshots present. ✔
7. **The skeptic's question:** a reviewer with only this evidence reaches these verdicts. ✔

## Honest-Limitations (Pflicht)

- **Screenshots are from an isolated render harness** (`scripts/*.mjs`), not the full
  authenticated app — the container has no Supabase/API/Stripe. The harness uses the **real token
  CSS** and production-faithful `data-theme`-on-`<html>` resolution, and the markup mirrors each
  component's post-fix inline styles. This is the cloud-rider's allowed local-render fallback. The
  founder's Vercel preview is the live confirmation.
- **U1** race is pinned in code, **not reproduced live**. The RLS read-asymmetry (a potential
  *deterministic* non-healing loop) could not be confirmed — the `onboarding_steps` RLS policy
  wasn't inspectable here. The cookie handshake closes the window **regardless** of whether the
  cause is replication lag or RLS.
- **U4** verified via the refresh-contract unit test; the full create→sidebar **E2E was not run**
  (needs the auth stack).
- **W2-7 Stripe form:** the `appearance` theme-flip is **code-only** — the live Stripe iframe
  isn't renderable in the harness. The screenshot-verified W2-7 fix is the notice card.
- **F-32 "show once"** uses a per-plan **localStorage** marker, not a server flag. It is honest
  (fires only on verified paid) but not cross-device once-only; a server flag (migration +
  endpoint, mirroring `achievement_upgrade_card_seen_at`) is the follow-up if the founder wants it.
- **TRIAL-7 still-fires** is verified **by inspection** (unchanged code path), not live.
- **Lint:** two `react-hooks/set-state-in-effect` errors remain in touched files
  (`theme.tsx:22`, `SettingsRoot` `setHapticEnabled`) — both **pre-existing on master**; this wave
  introduces **zero net-new** violations.

## Founder-action list

1. **Eyeball the Vercel preview (taste gate) before merge** — the five healed theme surfaces
   (light + dark), the palette (**dark must stay dark**), and the purchase moment.
2. **Confirm the U3 mapping decision:** the **gold logo mark is KEPT** (only app-surface accents
   moved to sage/copper); the gold "gold-button" variant is also unchanged. Say if the mark should
   also move off gold.
3. No migration to apply this wave.
