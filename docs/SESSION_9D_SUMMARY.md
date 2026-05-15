# Session 9D Summary — Convention Pass

**Date:** 2026-05-15
**Status:** Complete (all 8 phases done)
**Base commit:** ebc5abd (after 9C.1)

## Phases done
- 9D-0 Foundation — Tokens additiv, BottomSheet, SheetStack, IOSToggle, SettingsRow/Card/Group, useUser/useAuth hooks
- 9D-1 Settings Bottom-Sheet — ProfileCard + 5 Groups (Konto/Goblin/Design/App/Hilfe), 11 SubPages (live + stubs)
- 9D-2 Profile Sub-Page — Avatar + name/displayName form, 2FA/Passkeys/Sessions disabled placeholders, Danger-Zone
- 9D-3 IOSToggle "Migration" — keine Legacy-Toggles im Repo (alle Treffer waren TOS/repo-private/admin-filter, kein iOS-Pattern). IOSToggle ist de-facto Single Source via FeaturesPage.
- 9D-4 API Keys + Usage — DB migration 0037, ApiKeysPage mit 8 Providers + Usage-Bars (via Supabase direkt, RLS)
- 9D-5 Empty Chat + Plus-Popover + Long-Press — EmptyChat mit time-greeting + 3 SuggestionRows, ComposerPlusPopover (5 items), RecentChatRow mit Long-Press → BottomSheet Context (6 actions, DELETE live, Rest 9E)
- 9D-6 Avatar Menu — AvatarMenu BottomSheet (responsive: mobile + desktop), ersetzt alte Header-Dropdown
- 9D-7 Filter Pills — FilterPills primitive (horizontal-scroll, aria-pressed). Project-Detail-Page-Integration → 9E
- 9D-8 Audit + Docs — Comparison-Doc, Summary, Backlog-Update

## E2E tests added (numbered 25-31, tagged @public/@auth)
| File | Tests | Tag |
|---|---|---|
| 25-foundation.spec.ts | 1 | @public |
| 26-settings-structure.spec.ts | 3 | @auth |
| 27-toggles.spec.ts | 2 | @auth |
| 28-api-keys.spec.ts | 1 | @auth |
| 29-empty-and-context.spec.ts | 2 | @auth |
| 30-avatar-menu.spec.ts | 1 | @auth |
| 31-filter-pills.spec.ts | 1 | @public |

**Total: 11 neue E2E-Tests. TS-Check clean.**

## Files changed (~30)
- Modified: globals.css, settings-sheet.tsx, ChatInput.tsx, standalone-chat.tsx, Header.tsx, Sidebar.tsx
- Created (components): BottomSheet, SheetStack, IOSToggle, SettingsCard, SettingsGroup, SettingsRow, FilterPills, ProfileCard, SettingsRoot, SettingsSheetInner, ProfilePage, FeaturesPage, ApiKeysPage, AppearancePage, LanguagePage, AboutPage, StubPage, EmptyChat, ComposerPlusPopover, RecentChatRow, AvatarMenu
- Created (lib): hooks/useUser.ts, hooks/useAuth.ts, greeting.ts
- Created (sql): supabase/migrations/0037_byok_key_usage.sql
- Created (docs): CLAUDE_VS_CHATGPT_VS_GOBLIN_COMPARISON.md, SESSION_9D_SUMMARY.md, 9E_BACKLOG.md

## Deviations from spec
1. **Path**: spec said `apps/web/tests/e2e/` — actual repo path is `tests/e2e/` at repo root. All E2E in correct location.
2. **Test numbers**: spec wanted 16-22 — collided with existing 16-24. Used 25-31 instead.
3. **Tokens**: hybrid strategy chosen by Vincent — neue Tokens additiv in globals.css statt separater tokens.css. Spec-Variablennamen (`--moss-green`, `--surface-1`, `--text-1`) auf existing (`--moss`, `--panel`, `--text`) gemappt beim Schreiben.
4. **Desktop `/settings` Two-Column page**: skipped — existing `/settings` redirected zu `/dashboard/settings` mit umfangreichem Sub-Page-Setup. Doppelarbeit vermieden.
5. **Project-Detail Files/Anweisungen Sheets (9D-7)**: skipped (Spec markierte als optional). Verschoben nach 9E.
6. **LiteLLM byok-usage-tracking-Middleware (9D-4)**: nur SQL + Read-Endpoint gemacht. Write-Hook in chat-completion-Pfad → 9E (risikoreich, getrennte Session).
7. **IOSToggle-Migration (9D-3)**: keine Legacy-Toggles vorhanden → 0 Migrationen. IOSToggle SoT durch FeaturesPage-Verwendung.

## Manual steps für Vincent
1. **DB-Migration anwenden**: `supabase/migrations/0037_byok_key_usage.sql` via Supabase SQL-Editor.
2. **Real-iPhone-Test**: Sheets, Stack-Navigation, Long-Press, Plus-Popover, Avatar-Sheet, Empty-Chat-Greeting.
3. **9E-Backlog reviewen**: `docs/9E_BACKLOG.md`.

## Known issues / scope-cuts
Siehe `docs/9E_BACKLOG.md` für vollständige Liste.
