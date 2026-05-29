# WS4 — Settings Desktop Modal

Follow-up to `REFACTOR_2026-05-28.md` (WS4 was deferred). Design ref: `Branding/GOBLIN_DESIGN_SYSTEM.md` v1.1 (A2.1.1, A2.5, A5.6). **typecheck + build PASS.**

## 1. Files changed

| File | Why |
|------|-----|
| `components/settings/sections.ts` | **NEW** — section registry (SSOT for the desktop modal) + icon set. |
| `components/settings/AppearanceSection.tsx` | **NEW** — self-contained theme-state wrapper so `AppearancePage` renders unchanged in the modal. |
| `components/settings/SettingsModal.tsx` | **NEW** — desktop 960×680 two-pane modal. |
| `components/settings/settings-sheet.tsx` | Mobile-only viewport gate (returns null ≥768). |
| `components/app-shell/dashboard-shell.tsx` | Mount `SettingsModal` (desktop) + viewport state + close handler. |

No section component edited. No SheetStack edit. No AvatarMenu/Sidebar edit (see §5/§7).

## 2. Section registry (`sections.ts`)

14 entries (`id · label · icon · group · component`):
| id | label | icon | group | Component |
|----|-------|------|-------|-----------|
| profile | Profil | User | konto | ProfilePage |
| billing | Abrechnung | Dollar | konto | BillingPage |
| usage | Nutzung | Chart | konto | UsagePage |
| personalization | Personalisierung | Sparkles | goblin | PersonalizationPage |
| features | Funktionen | Sliders | goblin | FeaturesPage |
| connectors | Konnektoren | Plug | goblin | ConnectorsPage |
| models | Modelle | Key | goblin | ModelsPage |
| appearance | Erscheinungsbild | Moon | design | AppearanceSection |
| language | Eingabesprache | Globe | app | LanguagePage |
| notifications | Benachrichtigungen | Bell | app | NotificationsPage |
| privacy | Datenschutz | Shield | app | PrivacyPage |
| report | Problem melden | Flag | hilfe | ReportProblemPage |
| help | Hilfecenter | Question | hilfe | HelpCenterPage |
| about | Über Goblin | Info | hilfe | AboutPage |

Groups: `konto · goblin · design · app · hilfe` (the actual 5 mobile groups — the prompt's 2-group `account|goblin` example was illustrative; matched the real structure instead). Labels/icons copied verbatim from SettingsRoot's canonical mobile list. Non-page mobile rows (Akzentfarbe disabled, Haptisches Feedback toggle, Abmelden action) are controls/actions, not sections → excluded.

## 3. SettingsRoot — UNCHANGED (deliberate deviation from EDIT 2)

EDIT 2 asked SettingsRoot to consume the registry. **Not done — by design.** SettingsRoot's mobile rows carry runtime-dynamic right-hand values that a static registry cannot express without per-row render-time injection: `Abrechnung right={user.plan.name}`, `Erscheinungsbild right={appearance}` (current theme) + stateful `AppearancePage`, `Eingabesprache right="DE"`. Migrating those risks changing the mobile sheet, which violates the higher non-negotiable ("mobile byte-identical, zero difference"). 

Resolution: registry is the SSOT for the **desktop modal** and references the **same** section components; the mobile sheet keeps its inline list untouched. The accepted cost is that the section *ordering/grouping* is expressed in two places (mobile inline + registry). This is the one SSOT compromise, taken to protect the canonical ~30h mobile UX. Full SettingsRoot→registry migration (with dynamic-right capture) is future work.

## 4. SettingsModal

`components/settings/SettingsModal.tsx` — `SettingsModal({ open, onClose, initialSectionId? })`.
- Portal → `document.body`; backdrop `rgba(15,43,30,0.5)` (--ink-deep 50%), click closes.
- Container 960×680, `max-[w/h]: calc(100v[w/h] - 64px)`, `--surface-0`, `--radius-lg`, `--shadow-3`, two-column.
- Left nav 240px (`--surface-1`, right border): mono "EINSTELLUNGEN" eyebrow + groups from `GROUP_ORDER`/`GROUP_LABELS`; rows 40px, icon 16px, `--t-small-fs`; active = `--green-100` bg + 2px `--brand-gold` left edge + `--green-800` text; hover `--surface-3`.
- Right pane: 56px top bar (active label `--t-h3-fs` + lucide `X` close), scrollable content rendering the active section's `Component`.
- State: `activeId` (default `initialSectionId` or first section); URL-hash sync (`#profile`); Escape/backdrop/X close; focus trap (Tab/Shift+Tab cycle), body-scroll lock, focus restore on close.

## 5. AvatarMenu wiring

**No edit needed.** AvatarMenu's "Einstellungen" already calls `setShowSettingsSheet(true)`. Surface gating (below) routes that to the modal on desktop, the sheet on mobile. Chosen over EDIT 4's "branch inside AvatarMenu" because it requires zero change to the trigger and avoids parallel modal mounts — same outcome, less risk.

## 6. Sidebar user-pill wiring

**No edit needed.** The pill already calls `setShowSettingsSheet(true)` (`Sidebar.tsx:491`). Same surface-gating path → modal on desktop, sheet on mobile.

## 7. State location & single-instance

`SettingsModal` is mounted once, in `DashboardShell`, as a sibling of `SettingsSheet`:
```tsx
<SettingsSheet />                                  // self-gates: mobile only
<SettingsModal open={showSettingsSheet && isDesktop} onClose={closeSettings}
               initialSectionId={settingsInitialItem ?? undefined} />
```
Both read the existing `showSettingsSheet` context flag. `SettingsSheet` returns null when `isDesktop`; `SettingsModal` renders only when `open && isDesktop`. One instance each, mutually exclusive by viewport. AvatarMenu + Sidebar both reach it through the shared context flag — no prop chains, no second mount.

## 8. Section-component byte-identical check

I invoked Edit/Write on **zero** section components (only the 3 new files + `settings-sheet.tsx` + `dashboard-shell.tsx`). `git status` shows section files as `M`, but that is **pre-existing working-tree churn** present at session start: `git diff --stat` shows symmetric counts (BillingPage 16/16, ProfilePage 6/6) with `LF will be replaced by CRLF` warnings — i.e. line-ending normalization, not content. No section component's content was changed by this pass.

## 9. Verification

| Check | Result |
|-------|--------|
| Registry entries vs mobile SheetStack pushes | 14 = 14 ✓ |
| emoji in SettingsModal | 0 ✓ |
| retired tokens in components/settings | 0 ✓ |
| section components edited by this pass | 0 (M = pre-existing CRLF churn) ✓ |
| SheetStack / mobile sheet behavior | unchanged ✓ |

## 10. Build status
- `pnpm --filter @goblin/web typecheck` → **PASS**.
- `pnpm --filter @goblin/web build` → **PASS**.

## 11. Smoke trace (no browser; CDP not enabled)
- **Desktop, avatar → Einstellungen:** popover closes, `setShowSettingsSheet(true)` → SettingsModal opens (960×680, left nav + right content), Profil active by default.
- **Desktop, sidebar user-pill:** same modal opens (single instance).
- **Switch section (left nav):** right pane swaps to that section's Component; active row gets gold edge + green text; hash updates (`#models`).
- **Close:** X / backdrop / Escape all close; focus returns to trigger.
- **Mobile, avatar → Einstellungen / user-pill:** BottomSheet `SettingsRoot` as before (modal stays null <768). Zero mobile change.

## 12. Surprising
Two flagged deviations, both to protect non-negotiables: (a) **SettingsRoot left untouched** rather than registry-migrated — its rows have runtime-dynamic right-values that can't be captured statically without risking the mobile sheet; the registry is SSOT for desktop and shares the section components, accepting that grouping/order lives in two places. (b) **Wiring via surface-level viewport gating** instead of branching inside AvatarMenu/Sidebar — same modal-on-desktop/sheet-on-mobile outcome, no trigger edits, guaranteed single instance. The section-component `M` flags in git are pre-existing CRLF line-ending churn, not edits from this pass.
