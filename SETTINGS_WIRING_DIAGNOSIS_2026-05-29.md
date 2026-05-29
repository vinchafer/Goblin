# Settings Desktop Wiring — Read-Only Diagnosis (2026-05-29)

**Scope:** Why does desktop "Einstellungen" do nothing while mobile works end-to-end?
**Method:** Static read of working tree + diff against committed `HEAD`. Zero source edits.
**Headline:** The desktop wiring in the **working tree is correct and consistent**. The desktop-Settings code (modal mount, `isDesktop` gate, desktop popover) exists **only as uncommitted/untracked changes** — it is not in `HEAD`. The "nothing happens" symptom matches the **committed** state and a **dev server / build that predated the untracked files**, not the current working tree.

---

## 1. State location (Q1)

**Mechanism: React Context.** Canonical declaration: `apps/web/contexts/app-context.tsx`.

- Declared in interface: `app-context.tsx:42-43`
  ```ts
  showSettingsSheet: boolean;
  setShowSettingsSheet: (show: boolean) => void;
  ```
- State lives here: `app-context.tsx:67` — `const [showSettingsSheet, setShowSettingsSheet] = useState(false);`
- Provided: `app-context.tsx:114-115`.
- Single `AppProvider` mounted once: `apps/web/app/dashboard/layout.tsx:74` (wraps `DashboardShell` → so Header/AvatarMenu, Sidebar, SettingsSheet, SettingsModal all share one context instance).

**Write sites (`setShowSettingsSheet`):**
| File | Line | Call |
|------|------|------|
| `components/header/AvatarMenu.tsx` | 121 | `() => { close(); setShowSettingsSheet(true); }` |
| `components/layout/Sidebar.tsx` | 323 | desktop user-pill: `() => { setShowSettingsSheet(true); onClose?.(); }` |
| `components/layout/Sidebar.tsx` | 490 | mobile user-pill: `() => { setShowSettingsSheet(true); onClose?.(); }` |
| `components/app-shell/dashboard-shell.tsx` | 51 | `closeSettings` → `setShowSettingsSheet(false)` |
| `components/app-shell/dashboard-shell.tsx` | 74 | keyboard shortcut `onSettings` → `setShowSettingsSheet(true)` |
| `components/settings/settings-sheet.tsx` | 23 | `close()` → `setShowSettingsSheet(false)` |

**Read sites (`showSettingsSheet`):**
| File | Line | Use |
|------|------|-----|
| `components/app-shell/dashboard-shell.tsx` | 177 | `open={showSettingsSheet && isDesktop}` (SettingsModal) |
| `components/settings/settings-sheet.tsx` | 28, 31 | `if (isDesktop \|\| !showSettingsSheet) return null;` / `<BottomSheet open={showSettingsSheet} …>` |

Confirmation: **Context-based**, single canonical file `app-context.tsx`. No Zustand, no duplicate provider.

---

## 2. Viewport detection (Q2)

`isDesktop` is **component-local state**, computed independently in **three** components, all identical:

`dashboard-shell.tsx:40-48`
```ts
const [isDesktop, setIsDesktop] = useState(false);
useEffect(() => {
  const mq = window.matchMedia('(min-width: 768px)');
  setIsDesktop(mq.matches);
  const on = () => setIsDesktop(mq.matches);
  mq.addEventListener('change', on);
  return () => mq.removeEventListener('change', on);
}, []);
```
Identical copies: `settings-sheet.tsx:12-20`, `AvatarMenu.tsx:96-111`.

- **Breakpoint:** `min-width: 768px`. ≥768 → `true`.
- **SSR / first render:** initial value is `false` (mobile default). The `matchMedia` read runs only in `useEffect` (client). So on the **first client render** `isDesktop` is `false`, then flips to `true` after hydration on a ≥768 viewport. This is the standard "default mobile until client confirms" pattern — **safe**, because the click that opens settings happens long after hydration, by which time all three copies read `true` on a 1280-wide desktop.
- It is **not** stuck on `false`: the `useEffect` runs once on mount and the value is stable thereafter. No evidence of it being pinned to mobile.

---

## 3. SettingsModal mount (Q3)

- Mounted **once**: `dashboard-shell.tsx:176-180`.
  ```tsx
  <SettingsModal
    open={showSettingsSheet && isDesktop}
    onClose={closeSettings}
    initialSectionId={settingsInitialItem ?? undefined}
  />
  ```
- `open` expression in full: `showSettingsSheet && isDesktop`.
- Single mount — not duplicated in AvatarMenu or elsewhere (grep confirms only `dashboard-shell.tsx` renders `<SettingsModal`). `SettingsSheet` is its mobile sibling mounted right above it at `dashboard-shell.tsx:175`.
- DashboardShell **does** wrap the chat route: `app/dashboard/layout.tsx:77-83` renders `<DashboardShell>{children}</DashboardShell>` for the whole `/dashboard/*` subtree, including `/dashboard/chat`. There is exactly one `layout.tsx` under `app/dashboard/` (Glob confirms no nested override).

---

## 4. AvatarMenu click trace (Q4)

`AvatarMenu.tsx:121` (verbatim):
```tsx
<SettingsRow dense testId="avatar-menu-settings" label="Einstellungen" onClick={() => { close(); setShowSettingsSheet(true); }} />
```
where `close = () => setOpen(false)` (`AvatarMenu.tsx:113`) — closes only the **local popover** `open` state, not the context flag.

Trace:
1. `close()` → `setOpen(false)` (popover unmounts).
2. `setShowSettingsSheet(true)` → context flag true.

**Race check:** No race. `close()` touches only the AvatarMenu-local `open` state; it never calls `setShowSettingsSheet(false)`. The two `setState`s are batched in one React event tick. Popover close and modal open are independent — the modal reads `showSettingsSheet` from context, which is set `true` in the same tick. The desktop popover's click-outside handler (`AvatarMenu.tsx:35-39`) is a `mousedown` listener that early-returns when the target is inside the popover, so it does not fire `onClose` for this click. **No state reset path resets the flag.**

`SettingsRow` itself fires correctly: `SettingsRow.tsx:49-53` `handleClick` calls `onClick()` (role=button, not disabled, not a toggle). The identical "Abmelden" row in the same menu proves the row mechanism works.

---

## 5. Sidebar user-pill click trace (Q5)

Two pills, two render branches:
- Desktop/collapsible aside pill: `Sidebar.tsx:322-323`, `data-testid="user-pill-desktop"`, `onClick={() => { setShowSettingsSheet(true); onClose?.(); }}`.
- Mobile-drawer pill: `Sidebar.tsx:489-490`, `data-testid="user-pill"`, same handler.

Both reach `setShowSettingsSheet(true)` directly. `onClose?.()` closes the mobile drawer only (no-op effect on the context flag).

**Guards:** The desktop pill sits inside the always-rendered desktop aside; it is shown regardless of `collapsed` (only its padding/shape changes — see `Sidebar.tsx:319,330-331`). No `if (collapsed) return` / `if (!user) return` guard blocks the click. The button is always interactive.

---

## 6. Mental click trace — desktop 1280×860 (C1)

Against the **current working tree**:
1. User clicks avatar (`header-avatar`) → `setOpen(true)`. `isDesktop===true` → `DesktopMenuPopover` renders (`AvatarMenu.tsx:173-176`).
2. User clicks "Einstellungen" → `SettingsRow.handleClick` → `onClick` → `close()` + `setShowSettingsSheet(true)`.
3. Context `showSettingsSheet` → `true`.
4. `settings-sheet.tsx:28`: `isDesktop===true` → returns `null` (no sheet). ✓ correct.
5. `dashboard-shell.tsx:177`: `open = true && true = true` → `SettingsModal` portals into `document.body` at `zIndex 1000`. **Modal appears.**

→ In the working tree the trace **completes**; the modal mounts. There is no step where it stops.

Against **committed `HEAD`** (what the symptom matches):
- `HEAD:AvatarMenu.tsx` uses **only** `BottomSheet` (no popover, no `isDesktop`) — the avatar menu itself opens as a bottom sheet on desktop.
- `HEAD:settings-sheet.tsx` has **no `isDesktop` gate** (`if (!showSettingsSheet) return null` then renders `BottomSheet` on all widths).
- `HEAD:dashboard-shell.tsx` **does not import or mount `SettingsModal`** and does not compute `isDesktop` (verified via `git show HEAD:…`).
- So on `HEAD`, desktop click → `showSettingsSheet=true` → a **bottom sheet** would render (no modal). The trace stops at "there is no `SettingsModal` to mount." If the running build also failed to load the then-nonexistent files, the net visible result is "nothing in the expected modal position."

---

## 7. SettingsModal internal guards (C2)

`SettingsModal.tsx`:
- Top: `useState(initialSectionId ?? FIRST_ID)` (17), focus/scroll-lock effects (28-54).
- Only guard: `SettingsModal.tsx:56` — `if (!open) return null;`.
- **No** `if (!isDesktop) return null`, **no** `if (typeof window === "undefined") return null`. (It uses `createPortal(..., document.body)` at 66/187 — runs only on client because it's a `'use client'` component and `open` is false during SSR, so the portal is never attempted server-side.)
- `FIRST_ID = SETTINGS_SECTIONS[0]!.id` (14) is safe: `sections.ts:87-102` defines 14 sections, array non-empty.

→ If `open` were hardcoded `true`, the modal **would render** correctly. No over-aggressive internal return blocks it.

---

## 8. Gating consistency (C3)

Both surface gates use the **same breakpoint and the same direction** — consistent, no boundary gap:

| Surface | File:line | Condition | Renders when |
|---------|-----------|-----------|--------------|
| Sheet (mobile) | `settings-sheet.tsx:28` | `if (isDesktop \|\| !showSettingsSheet) return null` | `!isDesktop && showSettingsSheet` (i.e. `<768`) |
| Modal (desktop) | `dashboard-shell.tsx:177` | `open = showSettingsSheet && isDesktop` | `isDesktop && showSettingsSheet` (i.e. `≥768`) |

Both pivot on `matchMedia('(min-width: 768px)')`. They are mutually exclusive and jointly exhaustive once `showSettingsSheet` is true — exactly one surface shows. **No gap, no overlap.** `isDesktop` cannot be `false` on a 1280-wide desktop (matchMedia is window-level, unaffected by the `.gobl-dash` wrapper or CSS).

Minor unrelated note: the header **CSS** uses `max-width:768` (mobile styling) and `min-width:769` (desktop height) — a 1-pixel cosmetic dead zone at exactly 768px versus the JS `min-width:768`. Irrelevant to this bug at 1280.

---

## 9. Root cause hypothesis

**Prediction:** Desktop Settings *will work in the freshly-restarted dev server* — the symptom was produced by the committed/stale state, not by a defect in the current working-tree wiring.

**Reasoning:** All WS4 desktop wiring is uncommitted: `SettingsModal.tsx` and `sections.ts` are **untracked (`??`)**, and `dashboard-shell.tsx`, `settings-sheet.tsx`, `AvatarMenu.tsx`, `Sidebar.tsx` are **modified (`M`)**. Committed `HEAD` has no `SettingsModal`, no `isDesktop`, and a sheet that renders on every viewport — i.e. the committed app genuinely has no desktop modal, which is the "nothing appears" the user saw. In the working tree the three `isDesktop` reads are byte-identical and the modal gate (`showSettingsSheet && isDesktop`) and sheet gate (`isDesktop || !showSettingsSheet`) are perfectly complementary, so on a ≥768 viewport the modal *must* mount and the sheet *must* suppress — there is no static path that yields "nothing." The most likely trigger for the reported failure is therefore a **dev server/Turbopack instance that was started before `SettingsModal.tsx`/`sections.ts` existed** (or a stale `.next` cache), so the new mount was never compiled in. The clean restart now serving the working tree (route returns 200, files compile) should resolve it.

---

## 10. Fix scope estimate

**Likely zero code change — verify-then-commit.** Re-test desktop Settings on the freshly-started dev server (port 3000). If the modal now opens (expected), the only remaining action is to **commit the WS4 working-tree changes** (`git add` the two untracked files + the four modified files) so the fix is durable and not lost on the next clean checkout. If — against this analysis — the modal still fails to open on the restarted server, the next probe is a one-line instrumentation of `isDesktop` in `dashboard-shell.tsx:177` (log `showSettingsSheet`/`isDesktop` at click time); but no architectural change or state-lift is anticipated. **Estimate: 0-line fix; the real "fix" is committing already-correct code.**
