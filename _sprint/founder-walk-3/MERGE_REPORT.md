# FOUNDER-WALK-3 — Merge Report

**Branch:** `claude/founder-walk-3-swhu66` (from master `f65217f`)
**Scope:** web-only — **0 `apps/api` files touched** (money suites untouched).
**One isolated, revert-ready commit per unit.**

## Result at a glance
| Gate | Result |
|---|---|
| `tsc --noEmit` (web) | clean |
| Web unit tests | **140/140** (18 files; was 130 → +10: onboarding-complete 6, gate +4, admin-error 4) |
| Safe-area TOP assert | **32/32** |
| Safe-area BOTTOM assert | **23/23** |
| Admin-menu assert (+live DOM @320px) | **14/14** |
| Money suites (apps/api) | untouched (0 API changes); require live Stripe env to run — not runnable in this sandbox, and provably unaffected |
| eslint (touched files) | no NEW errors (pre-existing master errors in BottomSheet/standalone-chat unchanged) |

## Units
### U1 (P0) — the post-onboarding hang, killed at the root
`5c…`-scope commit. **Root cause named:** every completion path did
`await patchOnboardingState(...)` BEFORE `router.push(...)`; a suspended cross-origin
fetch in a backgrounded PWA never settles (no timeout) → the signal-bearing
navigation never fires → the spinner wedges. Force-quit + reopen reaches the
dashboard because the write persisted — a CLIENT-STUCK state, on top of the redirect
loop the URL signal already fixed.
**Completion paths enumerated (all covered now):**
1. `welcome/build` finish (primary + footstrip) — was blocked on the await → now raced.
2. `welcome/integrations` finish (Start building / Skip all / footstrip) — navigated to a **BARE `/dashboard`** (no `?onboarded=1` at all) AND blocked on the await → now routed through the shared mechanism (carries the signal, non-blocking).
3. `welcome/_components/chrome` forward-leg guard — the `getOnboardingState()` read could wedge the `checking` spinner → now budgeted; arms the watchdog on replace.
**Fix (one mechanism, `lib/onboarding-complete`):** cookie fast-path → best-effort write **raced against a budget** (never blocks the nav) → navigate WITH `?onboarded=1` → **watchdog** hard-navigates to `/dashboard?onboarded=1` if still on `/welcome` after 5s (a full-document request middleware promotes into the durable cookie — the most robust channel).
**Tests:** `onboarding-complete` 6/6 proves the navigation fires within the budget **even when the mutation hangs forever**; gate +4 (watchdog decision).

### U2 — Settings safe-area + full route inventory
Settings mobile = `BottomSheet size='full'`, bottom-anchored at a fixed 48px → didn't
clear the notch → back button on the clock. Height now inset-aware
(`calc(100dvh - max(48px, inset-top+12))`; `vh→dvh`). Full inventory surfaced two
never-treated surfaces — treated: `(legal)/layout.tsx` header+footer, `pricing/page.tsx`
nav. `ROUTE_INVENTORY.md` documents every route; assert extended to lock the inventory (32/32).

### U3 — the white+bone double bar
Layering named: the composer that reaches the home-indicator zone is ChatInput's
`--panel` root (white/#08170F), which owns the inset — it sat inside a `--surface-2`
(bone) wrapper (`standalone-chat.tsx:738`). Two backgrounds meeting at the safe-area
zone → the bone shows as a second bar. Fixed: wrapper `--surface-2 → --panel` (one
continuous surface; inset still applied once). Render + de-dup asserts (23/23).

### U4 — admin mobile nav v3 (menu-button, scroll-tabs out)
Mobile <900px: compact bar "Bereich: <current> ▾" → full-width sheet, every section a
≥52px row, one per line (Catalog Ops unwrapped even at 320px), current highlighted,
founder-priority order. Desktop sidebar unchanged; old scroll strip removed cleanly.
Rendered (375 light/dark + 320); asserts 14/14 incl. live DOM (no horizontal overflow, every label one line).

### U5 — admin 401 chain
Wiring verified firsthand: web proxy sends `x-admin-key: ADMIN_API_KEY` (route.ts:6,48),
API validates the same header+env (admin.ts:14,15,18) → **no name drift; a 401 is a
value mismatch.** Insight's actionable copy is now the single source
(`lib/admin/admin-error` + `AdminErrorState`) for costs (was bare "Error: API 401"),
users + models (were silent-empty), telemetry (was generic). Health "commits differ"
red → neutral (`--meta`) with an honest reason. Test 4/4. Founder env checklist in `U5_ADMIN_401.md`.

### U6 — store-neutral landing line
"Bewusst in keinem App Store —" → DE „Kein Store, kein Download-Umweg — Goblin kommt
direkt aufs Gerät." / EN "No store, no detour — Goblin goes straight to your device."
Sibling sub-line neutralised. Rendered DE+EN, light+dark; no user-facing string names a store.

### U7 — tour dark-mode re-verification (no code change)
All 3 steps rendered in dark mode (incl. the once-pale "Vom Chat in den Code" title,
now white). Contrast re-run: **6/6** element classes pass (title 17.21:1, body/skip
5.23:1, next 5.58:1, progress 6.97:1, close 4.57:1).

## Honest-Limitations
- **U1:** headless cannot reproduce true iOS "Add to Home Screen" standalone
  suspension. The fix is proven in code + unit test (navigation cannot be wedged by a
  hanging write; watchdog forces a hard nav). The actual hang disappearing is the
  founder's on-device re-walk. The diagnosis holds because the founder's signature
  (hang → force-quit reaches dashboard → persistence fine) is exactly a stuck client
  transition, and the fix removes every way the transition can stick.
- **U2/U3:** deterministic source asserts + token-accurate static renders (simulated
  34px inset). Exact per-device pixel clearance / the seam manifestation is an iOS
  `dvh`/`env()` behaviour confirmable only on the founder's device.
- **U5:** the live 401 disappears only once the founder aligns `ADMIN_API_KEY` on
  Vercel + Railway and redeploys web (checklist provided) — code can't assert env parity.
- **U7:** contrast is computed from shipped token hex; render is token-accurate. True
  iOS dark sub-pixel AA is the re-walk, but every text element clears AA numerically.
- No `apps/api` change, so the real-Stripe money suites are unaffected; they self-skip
  without live Stripe secrets (not available here) — nothing in this wave touches them.

## Founder actions
1. **Env (U5, likely already done):** set `ADMIN_API_KEY` to the **same value** on
   Vercel (web, server-side, no `NEXT_PUBLIC_`) and Railway (API), then **redeploy web**.
2. **Re-walk on the installed PWA (test account `vinc.hafner3@`, fallback `…4`):**
   - Fresh onboarding **×2** (build-finish path AND the integrations finish path) → dashboard reached, **no spinner loop**.
   - Settings → the back button clears the clock.
   - Chat view → a single continuous surface at the bottom (no white+bone bars).
   - `/admin` on the phone → "Bereich ▾" menu, sheet lists every section on one line.
   - Dark tour → all steps readable.

## Consumption ledger
No token/API-cost paths changed → **no ledger entry** (per Gesetz 5).
