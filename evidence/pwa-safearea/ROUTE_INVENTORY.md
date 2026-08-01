# Safe-Area Route Inventory

> **WAVE-KORREKTUR-1 · U1 (2026-08-01) — the inventory below was only half an
> inventory.** Everything it listed was a SIGNED-IN surface. The public landing
> page, `/login`, the `/auth/*` screens and the public content pages were never in
> it at all — so the landing shipped a bare `position: fixed; top: 0` nav and, in
> the installed PWA, the GOBLIN lockup sat on the iOS clock and "Start building"
> on the wifi/battery icons (founder screenshot). **Part 2 of this document**
> closes that hole and the assert script now keys off `middleware.ts`'s own
> `isPublic` allowlist, so a new public route cannot skip the gate silently.

## Part 1 — FOUNDER-WALK-3 U2 (the signed-in surfaces)

Every full-screen route in the web app, and how its edge chrome (device-top /
device-bottom) is treated for an installed iOS PWA. After this wave the assert
script (`assert-safe-area.mjs`) locks the inventory: a new route that ships a bare
edge header/footer must be added here **and** to the script, so an omission is
loud, not silent.

**Legend**
- **treated** — the route's own edge chrome carries `env(safe-area-inset-*)`.
- **shell** — delegates to the shared `components/layout/Header.tsx` (top-inset-safe)
  via `DashboardShell`; nothing route-specific to treat.
- **already** — carried the inset before this wave (regression-guarded by the asserts).
- **n.a.** — a redirect stub, or a non-edge-anchored / in-document-flow surface that
  never reaches the status-bar or home-indicator zone.

| Route / surface | File | Verdict | Evidence |
|---|---|---|---|
| `/dashboard/**` (chat, code view, files/explorer, projects, usage, upgrade, trial-gate, checkpoints) | `app/dashboard/layout.tsx` → `DashboardShell` → `components/layout/Header.tsx` | shell | `Header.tsx` top/height/L/R insets |
| Mobile **Settings** sheet (profile, appearance/dark-mode, billing, connectors, …) | `components/ui/BottomSheet.tsx` (`size='full'`) | **treated (this wave)** | full height `calc(100dvh - max(48px, inset-top+12))` — clears the notch; back button no longer on the clock |
| Chat composer + code sheets/drawers/toasts/checkpoints pill | `components/chat/ChatInput.tsx`, `components/code/*` | already | bottom inset (SAFEAREA-U-BOTTOM), regression-guarded |
| Sidebar (mobile drawer + desktop rail) | `components/layout/Sidebar.tsx` | already | top+bottom inset |
| Onboarding `/welcome/**` | `app/welcome/_components/chrome.tsx` | already (FW2 U4) | header top/L/R + footer bottom |
| Admin `/admin/**` (mobile top bar) | `components/admin/admin-shell.tsx` | already | `padding-top: env(safe-area-inset-top)` + bottom |
| **Legal** `/terms`, `/privacy`, `/imprint`, `/acceptable-use` | `app/(legal)/layout.tsx` | **treated (this wave)** | header top+L/R (height grows by inset) + footer bottom |
| **Pricing** `/pricing` | `app/pricing/page.tsx` | **treated (this wave)** | nav top + landscape L/R insets |
| Offline banner (fixed top) | `components/mobile/offline-banner.tsx` | already | top inset, both variants |
| First-run tour popup | `components/onboarding/first-run-tour.tsx` | already | bottom inset on the card offset |
| `/onboarding` | `app/onboarding/page.tsx` | n.a. | redirect → `/dashboard` |
| `/settings`, `/dashboard/settings`, `/dashboard/settings/*`, `/dashboard/billing` | those `page.tsx` | n.a. | redirect stubs → the in-app settings sheet/modal |
| `/about`, `/changelog`, `/manifesto` | those `page.tsx` | n.a. | back-link nav in document flow, not edge-anchored |
| `/models`, `/models/[id]`, `/status`, `/help`, `/help/[slug]` | those `page.tsx` | n.a. | content pages, no edge-anchored header/footer bar |
| Desktop `SettingsModal`, `CommandPalette`, `ShortcutsHelp` | `components/settings/SettingsModal.tsx`, `components/ui/*` | n.a. | centered dialogs, never device-edge-anchored |
| `bottom-tab-bar.tsx` | `components/app-shell/bottom-tab-bar.tsx` | already but **NOT WIRED** | inset present; component intentionally not rendered (`dashboard-shell.tsx:9-12`) |

## What this wave changed
1. `BottomSheet` `full` height is now inset-aware → the mobile Settings back button
   clears the iOS clock / Dynamic Island (the founder's report). `vh → dvh` too.
2. `app/(legal)/layout.tsx` header + footer treated.
3. `app/pricing/page.tsx` nav treated.
4. `assert-safe-area.mjs` extended: the three surfaces above + a full-inventory
   guard (6 representative routes must each carry `env(safe-area-inset-top)`).

## Honest limitation
These are **deterministic source assertions** (the shipped CSS carries the inset)
plus static renders. The exact pixel clearance on a specific device (Dynamic Island
vs. notch vs. no-notch) is confirmable only on-device — the founder's re-walk of the
Settings back button on his iPhone is the final gate.

---

# Part 2 — WAVE-KORREKTUR-1 · U1: the PUBLIC routes

**Source of truth for "which routes are public":** `apps/web/middleware.ts:54-84`
(`const isPublic = …`, 23 path predicates). The assert script enumerates that
block and fails if the count changes, so adding a public route forces a decision
here.

| Route / surface | File | Verdict | Evidence |
|---|---|---|---|
| **`/` — the public landing (P0)** | `styles/landing.css` `nav.lp-nav` | **treated (this wave)** | `padding-top: env(inset-top)` + `height: calc(64px + env(inset-top))`; container L/R = `max(--gutter, env(inset-left/right))` |
| **`/` — hero (clears the fixed nav)** | `styles/landing.css` `.hero` | **treated (this wave)** | `padding-top: calc(var(--hero-pad-top) + env(inset-top))` — the gap below the nav is preserved exactly (72px compact), so the headline never slides under a taller bar |
| **`/` — landing footer** | `styles/landing.css` `footer.lp-footer` | **treated (this wave)** | `padding-bottom: calc(36px + env(inset-bottom))` + L/R |
| **`/login`** (and `/register` → `/login?mode=signup`) | `app/(auth)/login/page.tsx` | **treated (this wave)** | form column T/B/L/R; brand panel L + T/B (iPad landscape). `app/(auth)/layout.tsx` already had `viewportFit: 'cover'` |
| **`/login/2fa`** | `app/(auth)/login/2fa/page.tsx` | **treated (this wave)** | all four insets on the centred `<main>` |
| **`/auth/confirm`, `/auth/reset-password`** | `app/globals.css` `.auth-page` | **treated (this wave)** | one shared shell → one fix: T/B `max(24px, inset+12px)`, L/R `max(16px, inset)` |
| `/auth/magic-callback` | `app/auth/magic-callback/page.tsx` | n.a. | centred one-line spinner, no edge-anchored chrome; redirects immediately |
| `/auth/callback`, `/auth/test-callback` | `route.ts` / test-only page | n.a. | not a rendered user surface |
| **`/status`** | `app/status/page.tsx` | **treated (this wave)** | `height: calc(52px + env(inset-top))` on the green bar. **Inventory correction:** Part 1 filed `/status` as "content page, no edge-anchored header bar" — the source shows an edge-anchored `height: 52` green bar |
| **`/badge`** | `app/badge/page.tsx` | **treated (this wave)** | same green bar, same fix (also missing from Part 1) |
| **`/models`, `/models/[id]`** | those `page.tsx` | **treated (this wave)** | `paddingTop: max(32px, inset-top + 12px)` — Part 1 called these n.a., but 32px is *below* a typical 47–59px iOS top inset, so the h1 landed under the clock |
| **`/help`, `/help/[slug]`** | those `page.tsx` | **treated (this wave)** | top `max(32/28px, inset+12px)`, bottom `calc(80px + inset)`, L/R |
| **`/about`, `/manifesto`, `/changelog`** | those `page.tsx` + `.safe-prose-page` | **treated (this wave)** | Tailwind `py-16 px-4` replaced by `.safe-prose-page` (`app/globals.css`), which *adds* the inset to the 64px design padding instead of replacing it |
| **`/shared/[token]`** (public share link) | `app/shared/[token]/page.tsx` | **treated (this wave)** | top/bottom/L/R |
| **`/cancel-deletion`, `/deletion-pending`** | those `page.tsx` | **treated (this wave)** | public e-mail-link targets; all four insets |
| **404 / 500** | `app/not-found.tsx`, `app/error.tsx` | **treated (this wave)** | all four insets |
| `/pricing` | `app/pricing/page.tsx` | already (FW3 U2) | nav top + landscape L/R |
| `/terms`, `/privacy`, `/imprint`, `/acceptable-use` | `app/(legal)/layout.tsx` | already (FW3 U2) | header top + footer bottom |
| `/demo-chat`, `/demo-chat-mobile`, `/demo-code`, `/demo-preview` | `components/demo/DemoApp.tsx` | shell | renders the real `Header`/`Sidebar`, both already treated |
| `/brand/*`, `/api/*`, `/_next/*` | — | n.a. | assets / API, not rendered surfaces |
| `/print` | `app/print/page.tsx` | n.a. | print view, `margin: 80px auto`, not device-edge-anchored |
| `/signup` | — | **finding, not fixed** | listed in `middleware.ts:57` as public but **no route exists** — it resolves to the 404 page (which this wave treats). Nothing in the app links to it; `/register` is the real signup URL. Reported, not fixed: outside U1's scope |

## What this wave changed
1. `styles/landing.css` — nav (top + L/R), hero (top + L/R), footer (bottom + L/R).
2. `app/(auth)/login/page.tsx` — both columns; `app/(auth)/login/2fa/page.tsx`.
3. `app/globals.css` — `.auth-page` (covers `/auth/confirm` + `/auth/reset-password`)
   and the new `.safe-prose-page` utility (covers `/about`, `/manifesto`, `/changelog`).
4. `/status`, `/badge`, `/models`, `/models/[id]`, `/help`, `/help/[slug]`,
   `/shared/[token]`, `/cancel-deletion`, `/deletion-pending`, 404, 500.
5. Assert scripts extended — **`assert-safe-area.mjs` 32 → 73 assertions**,
   **`assert-safe-area-bottom.mjs` 23 → 33**, `assert-sidebar-landscape.mjs`
   unchanged at 11. Both extended scripts pass with 0 failures.

## Double-inset guard (the #44/#55 lesson)
Two assertions exist specifically for it, and they count occurrences rather than
merely matching:
- `assert-safe-area.mjs` — the `nav.lp-nav` rule block must contain
  `env(safe-area-inset-top` **exactly twice** (once as padding, once inside the
  height `calc`). A third would mean the inset was reserved twice on one edge.
- `assert-safe-area-bottom.mjs` — the `footer.lp-footer` block must contain
  `env(safe-area-inset-bottom` **exactly once**.

The hero's `padding-top` also grows by the inset, and that is deliberately *not*
a double inset: the hero sits **behind** a `position: fixed` nav, so its top
padding measures distance from the viewport top, not from the device edge. Before
and after the change the visible gap between nav bottom and headline is identical
(136 − 64 = 72px in the shipped compact density); only the whole stack moves down.

## Honest limitation (Part 2)
Same as Part 1, and it is the binding one: headless Chromium reports every
`env(safe-area-inset-*)` as `0`, so **no automated check in this repo can observe
a real inset**. What is verified deterministically is that the shipped source
carries the correct rule; the before/after renders (`landing-header-before-after.png`)
prove the *mechanism* using a simulated 47px inset fed through `--sat` in a
harness that reproduces `landing.css` literally. **True standalone-PWA insets are
device-only** — the founder opening the installed app cold on his iPhone is the
final gate for U1.
