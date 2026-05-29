# Architecture Audit — 2026-05-28

**Scope:** Read-only. No source files modified. Investigates 5 visual issues from the `/dashboard/chat` smoke-test + 1 cross-cutting section.

**Live shell chain (established first, all sections depend on it):**
`app/dashboard/layout.tsx` (imports `dashboard-tokens.css`, wraps children in `.gobl-dash`, redirects unauthed → `/login`) → `DashboardShell` (`components/app-shell/dashboard-shell.tsx`) → renders `components/layout/Header` + `components/layout/Sidebar` + `SettingsSheet`. Chat content = `StandaloneChat`.

---

## SECTION 1 — Header background (green vs paper)

### Files involved
- `apps/web/components/layout/Header.tsx` — the only header chrome component (git: 2026-05-17).
- `apps/web/styles/dashboard-tokens.css` — defines `--brand-header`.
- `apps/web/app/dashboard/layout.tsx` — imports the token file + applies `.gobl-dash`.
- `apps/web/components/app-shell/dashboard-shell.tsx` — the only mounter of `<Header>`.

### Exact lines
Header background, **no fallback**:
```
Header.tsx:91   background: 'var(--brand-header)',
```
Token definition, **scoped to `.gobl-dash`**:
```
dashboard-tokens.css:11   .gobl-dash {
dashboard-tokens.css:16     --brand-header:  var(--brand-green);  /* #1A3A2A — consolidated header, PRESERVED */
```
Token file imported in exactly one place:
```
app/dashboard/layout.tsx:8   import "../../styles/dashboard-tokens.css";
```
Wrapper applied:
```
app/dashboard/layout.tsx:73   <div className={`gobl-dash ${manrope.variable} ${instrumentSerif.variable}`}>
```
Header mounted only here (grep `<Header` → 1 real consumer):
```
dashboard-shell.tsx:107   <Header activeTab=... />
```

### Mechanism
`--brand-header` is **scoped** (defined only inside `.gobl-dash`) and consumed **without a fallback**. CSS resolves `background: var(--brand-header)` to *nothing* when the custom property is not in scope → the element gets no background → it shows whatever is behind it (page `--paper`/cream).

- Inside `/dashboard/*`: `.gobl-dash` is an ancestor → token resolves → header is `--brand-green`. Correct.
- Any header chrome rendered **outside** `.gobl-dash` → token undefined → paper/transparent.

`BottomSheet` (used by the settings sheet + avatar menu) renders via `createPortal(..., document.body)` (`BottomSheet.tsx:205`) — i.e. **outside** the `.gobl-dash` subtree. Its own bar uses `background: 'var(--paper)'` (`BottomSheet.tsx:132`) by design, so the sheet's top bar is paper/cream and can be mistaken for "the header gone paper."

### Verdict
**Partly intentional, partly latent bug.**
- Green within `/dashboard` is intentional and correct.
- The **no-fallback + `.gobl-dash`-scoped token** is a latent fragility: any future mount of `Header` (or header-like chrome) outside `.gobl-dash` renders paper. Hardening = `var(--brand-header, var(--brand-green))`.
- **unclear:** which exact element in the 2026-05-28 screenshots is paper. The live `Header.tsx` only mounts inside `.gobl-dash` (always green). The paper "header" is most plausibly (a) the `BottomSheet`/`SettingsSheet` top bar (`--paper`, portaled outside `.gobl-dash`), or (b) a first-paint FOUC before `dashboard-tokens.css` loads. Needs the screenshots to pin down.

---

## SECTION 2 — AvatarMenu architecture

### Inventory
| File | git last-mod | LOC | desktop/mobile branch? | render mechanism |
|------|-------------|-----|------------------------|------------------|
| `components/header/AvatarMenu.tsx` | 2026-05-15 | 108 | **No** | always `<BottomSheet size="auto">` |
| `components/ui/BottomSheet.tsx` | 2026-05-15 | ~285 (incl. 3 helper buttons) | **No** | `createPortal` → `document.body`; fixed full-screen overlay, sheet pinned to bottom-center |

### Why it presents as a centered iOS sheet on desktop
`AvatarMenu` has no responsive path — it always renders `BottomSheet`. `BottomSheet` is hard-wired to a bottom-sheet layout for **all** viewports:
```
BottomSheet.tsx:101  return createPortal(
BottomSheet.tsx:107    position: 'fixed', inset: 0, zIndex: 1000,
BottomSheet.tsx:110    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
...
BottomSheet.tsx:129    width: '100%', maxWidth: 720,
BottomSheet.tsx:132    background: 'var(--paper)',
BottomSheet.tsx:139    animation: ... 'gobSlideUp 280ms ...'
```
`align-items: flex-end` + `justify-content: center` + `maxWidth: 720` + slide-up = a centered bottom sheet. On a wide desktop viewport that's the iOS-style sheet the founder flagged. There is also drag-to-dismiss (`onPointerMove`/`onPointerUp`, lines 87-99) — a touch affordance with no desktop equivalent.

### BottomSheet consumers (blast radius)
`rg BottomSheet` → real consumers:
- `components/header/AvatarMenu.tsx`
- `components/settings/settings-sheet.tsx` (the `SettingsSheet`)
- `components/settings/SettingsSheetInner.tsx`
- `components/sidebar/RecentChatRow.tsx`
- `components/layout/Header.tsx` — **comment only** (`// opens BottomSheet menu`), not an actual import.

So replacing/forking `BottomSheet` for desktop affects **4** live consumers (avatar menu, settings sheet + inner, recent-chat row).

### Existing alternative (anchored-popover) patterns already in the repo
- `Header.tsx` plus-menu + mode-menu: `position:'absolute'` popovers anchored to their button (e.g. `Header.tsx` plus dropdown `position:'absolute', right:0, top:'calc(100% + 8px)'`).
- `ChatInput.tsx` `ModelHub`: `position:'absolute', bottom:'calc(100% + 8px)', left:0, right:0` anchored dropdown.
- `components/chat/ComposerPlusPopover.tsx` (anchored popover component, `anchorRef` prop).

These are reusable anchored-dropdown patterns — a desktop AvatarMenu could adopt the same absolute-anchored approach instead of a portal sheet.

### Verdict
**Bug (missing responsive affordance), not intentional.** `BottomSheet` is correct on mobile; on desktop the avatar menu should be an anchored popover (patterns already exist in-repo). Neither `AvatarMenu` nor `BottomSheet` has a viewport branch. Debt age: ~2 weeks (2026-05-15).

---

## SECTION 3 — Settings UI inventory

**Two parallel settings systems exist.**

### A) Canonical mobile Settings — `SettingsRoot` (the founder's hours-long build)
- `components/settings/SettingsRoot.tsx` (git: 2026-05-17) — content/structure source of truth.
- Rendered inside `SettingsSheet` (`settings-sheet.tsx`) → `BottomSheet size="full"` + `SheetStackProvider` (push/pop sub-pages) + `SettingsSheetInner`.
- German, uses `SettingsCard`/`SettingsGroup`/`SettingsRow` + `ProfileCard`.

**Structure (content, not styling):**
- `ProfileCard` → `ProfilePage` ("Profil")
- **Konto:** Abrechnung (`BillingPage`, right=plan name), Nutzung (`UsagePage`)
- **Goblin:** Personalisierung (`PersonalizationPage`), Funktionen (`FeaturesPage`), Konnektoren (`ConnectorsPage`), Modelle (`ModelsPage`)
- **Design:** Erscheinungsbild (`AppearancePage`, dropdown System/Hell/Dunkel), Akzentfarbe (right="Bald", **disabled**)
- **App:** Eingabesprache (`LanguagePage`, right="DE"), Benachrichtigungen (`NotificationsPage`), Haptisches Feedback (**toggle**), Datenschutz (`PrivacyPage`)
- **Hilfe:** Problem melden (`ReportProblemPage`), Hilfecenter (`HelpCenterPage`), Über Goblin (`AboutPage`)
- Abmelden (danger button, `signOut`)

UI patterns: nav rows (icon + label + chevron, push sub-page), toggle rows, dropdown row, disabled row, danger button. Sub-pages via `useSheetStack().push(...)`.

### B) Web Settings route — `app/dashboard/settings/page.tsx` (older, divergent)
- git: 2026-05-14 (3 days older than SettingsRoot). Uses `SettingsLayout` (`settings-layout.tsx`, 2026-05-14).
- **English**, two tabs: **Account** (`GeneralTab`: Profile card + Display Name/Email, Advanced Mode toggle, Danger Zone/delete) and **Developer** (`DeveloperTab`: Default Chat/Code Model dropdowns, Request Timeout, System Prompt Override, Export Data, API Access "Phase 4").
- Plus 10 sub-route pages under `app/dashboard/settings/`: `appearance`, `billing` (+`billing/success`), `hosted`, `integrations` (+`github-connect-button`), `keys`, `local`, `notifications`, `routing`.

### Reachability
- Canonical sheet: `AvatarMenu` "Einstellungen" (`AvatarMenu.tsx:63 setShowSettingsSheet(true)`) **and** the sidebar bottom pill (`Sidebar.tsx:491 setShowSettingsSheet(true)`). Both open the **sheet**, never the route.
- Web route `app/dashboard/settings/*`: reachable only by **direct URL** — not linked from avatar menu or sidebar.

### Verdict
**Web Settings EXISTS but is a separate, older, English system** divergent from the canonical German mobile `SettingsRoot`. They duplicate concepts (profile, models, billing, notifications, appearance) with different structure/language. The "full-width modal sheet on desktop" issue (#3) is the **canonical mobile sheet opened on a desktop viewport** via `BottomSheet size="full"` — not the web route.

**Desktop adaptation path (proposal, not implemented):** keep `SettingsRoot` content as-is (canonical, do not redesign); when viewport ≥ desktop, render `SettingsRoot` (and its `SheetStack` pages) inside a **desktop container** (two-pane: left nav from the section groups, right detail) instead of `BottomSheet`. The older `app/dashboard/settings/*` route + `SettingsLayout` is the existing web-shell candidate to host it — but its current content (English Account/Developer tabs) diverges and would need reconciliation with `SettingsRoot`, not the reverse.

---

## SECTION 4 — Sidebar user-pill ("N" + "Builder")

### Files / lines
`components/layout/Sidebar.tsx` (git: 2026-05-20). Data derivation:
```
Sidebar.tsx:102   const displayName = userName || userEmail?.split('@')[0] || 'Builder';
Sidebar.tsx:103   const initial = displayName.charAt(0).toUpperCase();
```
Data source = **props**:
```
Sidebar.tsx:32-33   userEmail?: string;  userName?: string;
Sidebar.tsx:76      export function Sidebar({ projects = [], activeProjectId, userEmail, userName, isOpen = false, onClose }: SidebarProps)
```
Top-left "Builder <" (logo/user header row):
```
Sidebar.tsx:163   Goblin<span style={{ opacity: 0.45 }}>.</span>
Sidebar.tsx:172   {displayName}
Sidebar.tsx:175-185 <button onClick={toggle} title="Collapse sidebar"> ... ChevronLeft ...
```
Bottom user-pill:
```
Sidebar.tsx:491   onClick={() => { setShowSettingsSheet(true); onClose?.(); }}
Sidebar.tsx:509   ...}}>{initial}</span>
Sidebar.tsx:511   {displayName}
Sidebar.tsx:513   <Gear size={16} ... />
```

### Source of the strings
`DashboardShell` mounts `Sidebar` **without** `userName`/`userEmail`:
```
dashboard-shell.tsx:131-139   <Sidebar projects={...} activeProjectId={...} isOpen={mobileOpen} onClose={closeMobile} />
```
→ both props `undefined` → `displayName = 'Builder'` (fallback) → `initial = 'B'`.

Meanwhile the **header** avatar uses the `useUser()` hook (real data):
```
AvatarMenu.tsx:21   const user = useUser();
AvatarMenu.tsx:26   const initial = (user.fullName?.[0] ?? user.email?.[0] ?? 'V').toUpperCase();
```

### Cross-reference
- **"Builder"** = `Sidebar.tsx:102` fallback (props never supplied).
- **"Builder <"** top-left = `Sidebar.tsx:172` displayName + the collapse-toggle button (`:175`, legit control, not orphaned).
- **"N"**: there is **no `'N'` literal in `Sidebar.tsx`** (grep clean), and the sidebar's `initial` can only be `'B'` here. `'N'` matches the **header `AvatarMenu`** initial (real `useUser()` email/name starting "n"). So the two glyphs come from **two different data flows**: header = `useUser()` hook (correct → "N"), sidebar = unfed props (broken → "Builder"/"B").

### Verdict
**Bug — dual user-data flow.** `Sidebar` reads `userName`/`userEmail` from props that `DashboardShell` never passes, so it always renders the `'Builder'`/`'B'` fallback; the header reads from the `useUser()` hook and is correct. The "Builder <" collapse control is legitimate (only the *name text* is wrong). **unclear:** whether the screenshot's "N" is the sidebar pill or the header avatar — by code, the sidebar pill cannot render "N"; it must be the header avatar. Fix path (not done): make `Sidebar` consume `useUser()` like `AvatarMenu`, or have `DashboardShell` forward `userName`/`userEmail`.

---

## SECTION 5 — Dark-surface contrast

### Token facts
On-dark token family (defined, **never used in components**):
```
design-tokens.css:65-68   --ink-on-dark-1: #FBF7EC; --ink-on-dark-2: #D8CBA8; --ink-on-dark-3: #968768; --ink-on-dark-disabled: #5A523D;
design-tokens.css:300     --ink-on-dark: var(--ink-on-dark-1);
```
`rg "var(--ink-on-dark"` → matches **only** `design-tokens.css`. **No component uses the on-dark token family** — dark-surface text is hardcoded `rgba(...)`/`#fff`/gold instead.

Latent trap — `.gobl-dash` **redefines** the mid/low inks to dark green-greys:
```
dashboard-tokens.css:34   --ink-2:  #2c4538;
dashboard-tokens.css:35   --ink-3:  #5c6f64;
```
(vs global `--ink-2 #3F3A2C` / `--ink-3 #74694F`). Any dashboard element that puts `--ink-2`/`--ink-3` text on a `--brand-green`/`--ink-deep` surface is dark-on-dark.

### (surface, text-color) pairings in the live header (bg = `--brand-header` green)
| Element | text color | reads |
|---------|-----------|-------|
| wordmark (`Header.tsx:40`) | `var(--brand-gold)` | gold-on-green — OK |
| inactive pill (`:46`) | `rgba(244,236,216,0.78)` | cream@78% on green — OK but **dim at low brightness** |
| active pill (`:47/:266`) | `var(--brand-header)` on `--surface-0` white | dark-on-light — OK |
| crumb chip (`:43`) | `rgba(244,236,216,0.85)` | cream@85% on green — OK, slightly dim |
| mode-tile (`:120`) | `var(--bone)` on `rgba(0,0,0,.18)` | light-on-dark — OK |
| sidebar pill avatar (`Sidebar.tsx:506`) | `#fff` on `--brand-green` | OK |
| settings profile avatar (`settings/page.tsx:155`) | `#fff` on `--brand-green` | OK |

### Findings
- **No hard dark-on-dark** in the live header — every text-on-green is light (cream/gold/white).
- The "dark-on-dark at low brightness" symptom most likely = the **low-opacity cream** on green (inactive pills `0.78`, crumb `0.85`) reading dim, not a true forbidden pairing.
- Two real architectural risks: (1) the spec's `--ink-on-dark-*` family is **unused** — components hardcode `rgba`/`#fff`; (2) `.gobl-dash` overrides `--ink-2`/`--ink-3` to dark greens, so those tokens are unsafe as text on dark surfaces.

### Verdict
**Mostly intentional/OK in the current header; latent risk elsewhere.** Recommend: text on `--brand-green`/`--ink-deep` should use `--ink-on-dark-1` (primary), `--ink-on-dark-2` (secondary), `--ink-on-dark-3` (tertiary) rather than ad-hoc `rgba`/`#fff`, and never `--ink-1/2/3` (which `.gobl-dash` darkens). **unclear:** `GOBLIN_DESIGN_SYSTEM.md` is **not present in the repo** (`find` → no match) — could not cite the §A2.5 safe/forbidden list verbatim; verdict is based on the token semantics documented in `design-tokens.css` comments.

---

## SECTION 6 — Cross-cutting observations

- **Two sidebars coexist.** `DashboardShell` imports `components/layout/Sidebar` (live). A second `components/app-shell/sidebar.tsx` (git: 2026-05-17) also exists and is **not** imported by `DashboardShell` — appears to be a parallel/legacy sidebar. Reachability unclear; flag before any sidebar refactor so the wrong file isn't edited.

- **Two shell systems coexist.** `components/layout/*` (Header, Sidebar) and `components/app-shell/*` (dashboard-shell, sidebar, trial-banner). The live path mixes them: `app-shell/dashboard-shell.tsx` renders `layout/Header` + `layout/Sidebar`. Naming implies a half-finished consolidation.

- **Dual user-data flow (root of §4).** `useUser()` hook feeds Header/AvatarMenu/SettingsRoot/SettingsPage; props feed `layout/Sidebar`. Same identity, two sources, one unfed. Unifying on `useUser()` would fix the sidebar pill and prevent drift.

- **Portal escapes token scope (compounds §1).** `BottomSheet` portals to `document.body`, outside `.gobl-dash`. Any dashboard-scoped token (`--brand-header`, `--green-deep`, the redefined `--ink-2/3`, etc.) used inside a sheet resolves to nothing or to the *global* value, not the dashboard value. The settings sheet currently sidesteps this by using global tokens (`--paper`, `--text`), but it's a trap for future sheet content.

- **Two settings systems (detail in §3).** Canonical German sheet (`SettingsRoot`, 2026-05-17) vs older English route (`app/dashboard/settings/page.tsx`, 2026-05-14). Any "build desktop settings" work must start from `SettingsRoot` as the content source and reconcile/retire the divergent route, not the reverse.

---

## Summary of verdicts

| # | Area | Verdict |
|---|------|---------|
| 1 | Header bg | Green intentional in `/dashboard`; **latent bug** = scoped `--brand-header` + no fallback. Observed paper bar likely the portaled sheet/FOUC (unclear w/o screenshots). |
| 2 | AvatarMenu | **Bug** — no desktop branch; always a bottom sheet. Anchored-popover patterns already exist in-repo. Blast radius: 4 `BottomSheet` consumers. |
| 3 | Settings | Web settings **exists** but is an older, English, divergent route; canonical = German `SettingsRoot` sheet. Desktop = sheet opened on wide viewport. |
| 4 | Sidebar pill | **Bug** — `Sidebar` reads unfed props → `'Builder'`/`'B'`; header uses `useUser()` → real ("N"). Dual data flow. |
| 5 | Contrast | Live header is light-on-dark (OK, some dim low-opacity cream). **Risk:** on-dark token family unused; `.gobl-dash` darkens `--ink-2/3`. Design-system doc absent — couldn't cite §A2.5. |
| 6 | Cross-cutting | Two sidebars, two shell systems, dual user-data flow, portal token-scope escape, two settings systems. |

**No source files were modified.**
