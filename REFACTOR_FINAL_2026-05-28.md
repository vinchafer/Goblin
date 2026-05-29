# Refactor Final — WS2 Sidebar Layout + Legacy Markers + SSOT Note

Closes the remaining items after WS1/WS3/WS4 (`REFACTOR_2026-05-28.md`, `REFACTOR_WS4_2026-05-28.md`). **typecheck + build PASS.**

## 1. Files changed

| File | Why |
|------|-----|
| `components/layout/Sidebar.tsx` | Collapsed width 56→48; toggle icons → lucide `PanelLeftClose`/`PanelLeftOpen` + aria-labels; projects content-fit; chats area becomes the height-filler. |
| `components/settings/sections.ts` | SSOT documentation block added (top of file). |
| `app/dashboard/settings/{appearance,billing,billing/success,hosted,integrations,keys,local,notifications,routing}/page.tsx` | LEGACY marker comment (9 files). |

No chat/header/AvatarMenu/SettingsModal/SettingsRoot/section-component edits. No token definitions changed. No deps.

## 2. WS2-A Sidebar — structural summary

**Pre-existing (already implemented before this pass):** collapse `state` + `localStorage` persistence (key `goblin:sidebar:collapsed`), per-section `!collapsed` hiding, wordmark hidden when collapsed, chats `slice(0,5)` + "See all chats →" footer + "No chats yet" empty state, projects empty state. This pass closed the **gaps** against the spec:

- **Collapse state location:** local `useState` in `Sidebar.tsx` (already there), read from `localStorage` on mount, written on toggle. Not lifted — `DashboardShell` doesn't need it (reflow is automatic, see below).
- **Width + animation:** expanded 260px / collapsed **48px** (was 56), `transition: width 200ms` already on the `<aside>`.
- **Projects content-fit:** the projects container changed from `flex: 1` (grew, pushed chats down) to `flexShrink: 0, maxHeight: '30vh', overflowY: 'auto'` — compact, scrolls internally past ~30vh.
- **Chats fill remaining:** desktop `RecentChats` is now wrapped in `<div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>` so it (not projects) absorbs free vertical space; usage + user-pill stay pinned below.
- **Main content reflow:** **Option (ii)** — `DashboardShell` renders `<Sidebar/>` and `<main style={{flex:1}}>` as flex siblings, so the animated width change reflows `main` automatically. No CSS-var/context wiring needed.
- **User-pill:** opens settings via existing `setShowSettingsSheet(true)` → surface-gating opens `SettingsModal` on desktop (WS4). Hidden when collapsed (already `!collapsed`-gated).

## 3. Code excerpts

**Collapse toggle (expanded state):**
```tsx
<button onClick={toggle} title="Sidebar einklappen" aria-label="Sidebar einklappen"
  style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent',
    border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer', color: 'var(--ink-2)', flexShrink: 0,
    transition: 'background 0.15s, color 0.15s' }}
  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = 'var(--ink-1)'; }}
  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-2)'; }}>
  <PanelLeftClose size={18} />
</button>
```
Collapsed state mirrors it with `PanelLeftOpen` + `aria-label="Sidebar ausklappen"`. Focus ring is the global 2px-gold `:focus-visible` (design-tokens.css).

**Projects content-fit:**
```tsx
<div style={{ flexShrink: 0, maxHeight: '30vh', overflowY: 'auto', minHeight: 0, paddingTop: 8 }}>
```

**Chats as filler + slice(0,5) (pre-existing slice):**
```tsx
{!collapsed && (
  <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
    <RecentChats pathname={pathname} navigate={navigate} />
  </div>
)}
// inside RecentChats: setSessions(data.slice(0, 5));  + "See all chats →" when length === 5
```

## 4. WS5-B Legacy markers

10 total `LEGACY — superseded by SettingsRoot` hits across 10 files (the 9 sub-routes added this pass + the main `settings/page.tsx` from the prior pass). 6 client files anchored on the `'use client'` directive; 3 server files (`billing`, `integrations`, `keys`) anchored before the `createClient` import. `github-connect-button.tsx` skipped (component, not a route page).

## 5. WS-C SSOT note

Added at the top of `sections.ts` (1 grep hit for `SETTINGS SECTION REGISTRY`): documents that desktop = registry, mobile = SettingsRoot inline list, both must be updated together, components shared, full-SSOT collapse deferred.

## 6. Verification

| Check | Result |
|-------|--------|
| `LEGACY — superseded` in settings routes | 10 files ✓ |
| `SETTINGS SECTION REGISTRY` in sections.ts | 1 ✓ |
| `fontSize: <numeric>` in Sidebar.tsx | 0 (all `var(--t-*)`) ✓ |
| emoji in Sidebar.tsx | 0 ✓ |

(Retired-token check unchanged from prior passes — this pass introduced no hex/font literals; source remains clean, hits only in pre-existing `/public/` assets.)

## 7. Build status
- `pnpm --filter @goblin/web typecheck` → **PASS**.
- `pnpm --filter @goblin/web build` → **PASS**.

## 8. Smoke trace (no browser; CDP not enabled)
- **Expanded:** 260px; `Goblin.` wordmark + `PanelLeftClose` toggle; Projekte (≤30vh, scrolls), Chats (fills, max 5 + "See all chats →"), Verbrauch, user-pill all visible.
- **Click toggle:** animates to 48px (200ms); wordmark + all sections `display:none`; only `PanelLeftOpen` toggle visible; `localStorage['goblin:sidebar:collapsed']='1'`.
- **Reload collapsed:** mount reads localStorage → opens at 48px.
- **Click toggle again:** animates to 260px; `localStorage…='0'`; full content returns. `main` reflows automatically (flex sibling).
- **User-pill (expanded, desktop):** opens `SettingsModal`.

## 9. Surprising
Most of WS2-A was **already implemented** in the existing 644-line `Sidebar.tsx` (collapse state, localStorage, chats slice-5 + see-all, empty states, per-section collapse hiding, wordmark-hidden-when-collapsed). This pass only closed the spec gaps (48px width, Panel icons + aria-labels, projects content-fit, chats-as-filler). The local `ChevronLeft`/`ChevronRight` helper components are now unused after the icon swap — left in place (removing them is out-of-scope cleanup; `tsc` does not flag unused top-level functions, so the build stays green). The full refactor (WS1–WS5) is now complete.
