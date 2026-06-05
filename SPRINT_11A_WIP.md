# Sprint 11A — WIP log

- [x] Phase 0 — root-cause edit-in-place (two disconnected file stores; session never
      bridged from project S3). Fix: `hydrateSessionFiles()` in `code-sessions.ts`.
      11A-1 (f45a673). Prod-verified CDP (green styles.css, no new file).
- [x] Phase A — map (CHAT_ARCH.md) + unify: `ProjectChatSurface` replaces `ChatTab`
      in `project-workspace.tsx`; Send-to-Code stashes `goblin:lastChat:<projectId>`;
      header dropdown subs i18n. 11A-A (734475a). Prod-verified CDP.
- [x] Phase B — shared `useLang` (reuses goblin:preferred-lang); ChatInput placeholder,
      model search, new-project modal i18n. 11A-B (41109c5). Prod-verified CDP (DE).
- [~] Phase C — API /version=f45a673 (live, API-current); HEAD web-only. Founder
      Railway redeploy to make /version==HEAD. Cosmetic, skipped.
- [x] Phase F — typecheck PASS; build PASS; E2E 108/0 vs prod; git synced.

## STOP conditions — none hit
- Edit-in-place fix did NOT need a risky session/apply refactor — apply was already
  correct; only a read-bridge (hydrate) was added.
- Chat unification did NOT break Send-to-Code (left the ?tab=code path + stc-pending
  stash untouched; only swapped which component the chat tab renders).
