# Safe-Area Route Inventory — FOUNDER-WALK-3 U2 (the LAST safe-area wave)

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
