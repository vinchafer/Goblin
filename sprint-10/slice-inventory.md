# Sprint 10 — Slice Inventory (Phase 0.4)

What exists vs what's new, per slice. Existing systems are EXTENDED, not replaced.

## Slice 1 — Project Intent (DONE)
- Extend: `projects.ts` (POST/GET), `components/projects/new-project-modal.tsx`, `code-tab.tsx`→`CodeWorkspace`→`SessionPane`, project hub page.
- New: migration 0057, `lib/intent.ts`, `ProjectIntentControl.tsx`, `PATCH /:id`.
- Risk: low. DB column missing pre-migration → defensive writes + localStorage hint.

## Slice 5 — Find/Replace + Multi-cursor
- Extend: `components/editor/code-editor.tsx` (CodeMirror 6 config).
- New: `@codemirror/search` extension wiring + keymap. Multi-cursor already default in CM6.
- Risk: low. Mobile find panel may be cramped (acceptable per brief).

## Slice 2 — Real Command Palette
- Extend: existing `components/ui/CommandPalette.tsx` (already fuzzy + categorized) + `useCommandPalette` registry; binding doc says reuse the shell, add registry (NOT cmdk).
- New: dev commands (go-to-file, find/replace, git, model, layout, new session). Mobile long-press / button trigger.
- Risk: med. Wiring commands to editor + session actions across the shell.

## Slice 4 — Git Surface (READ + WRITE)
- Extend: `apps/api/src/routes/github.ts` (OAuth + push already exist — verify).
- New: `git.ts` status/commit/push endpoints, git pill + panel UI. Degrade to READ-only if GitHub App not configured (autonomous authority d).
- Risk: med-high. Storage-layer → git mapping; OAuth state.

## Slice 3 — Multi-file editing in one session
- Extend: `SessionPane`, `useCodeSessionDetail`; `CodeFileTabs.tsx` already exists (check reuse).
- New: migration 0058 (open_files/active_file JSONB), `PATCH /code-sessions/:id`, file-tab state. AI multi-file system-prompt tweak in `code-sessions.ts`.
- Risk: med.

## Slice 6 — Explorer ops + session-linked tree
- Extend: `/files` page, `projects.ts` (rename already exists at POST /files/rename).
- New: move/folder endpoints, context menus, `SessionFileTree.tsx` in Code Tab (web_app/import intents).
- Risk: med. Drag-drop on mobile → long-press substitute.

## Cross-cutting constraint
Localhost can't reach the prod API (CORS) and migrations aren't applied. All slices: build defensively, verify UI on localhost, leave DB/API E2E for founder push+deploy.
