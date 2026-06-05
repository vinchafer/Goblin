# Sprint 11A — COMPLETE (Fix the Code Loop & Navigation)

Date: 2026-06-05 · Branch: master · Quality bar 9.5
Deployed: web @ 41109c5 (Vercel, live) · API @ f45a673 (Railway, live)
Verified on PROD via CDP as **vinc.hafner3** (Groq), never the personal account.

## Per-item status (honest code-vs-prod split)

| Phase | Item | Code | Prod-verified |
|---|---|---|---|
| 0 | Edit-in-place edits the EXISTING file | ✅ | ✅ PASS (CDP) |
| A | Unify chat → workspace Chat tab = canonical StandaloneChat | ✅ | ✅ PASS (CDP) |
| A | Header dropdown subs honour language | ✅ | ✅ PASS (CDP) |
| A | Back-from-code returns to same conversation (stash) | ✅ | ⚠️ code-verified; stash round-trip not exhaustively walked |
| B | Chat composer placeholder i18n | ✅ | ✅ PASS (CDP, DE) |
| B | New-project modal i18n | ✅ | ✅ PASS (CDP, DE) |
| B | Model-search placeholder i18n | ✅ | ⚪ not separately walked |
| C | Honest health banner (API /version = HEAD) | n/a | ⏭️ founder Railway step (cosmetic) |
| F | typecheck (web+shared+api) | ✅ PASS | — |
| F | prod build (web+shared+api) | ✅ PASS | — |
| F | E2E suite | ✅ 108/0 | ✅ vs prod |

## Phase 0 — Edit-in-place (the #1 fix)

**Root cause (file:line):** a code session's files live in `code_session_files`,
seeded only from Send-to-Code; the project's REAL files live in S3 storage
(`projects/{id}/...`). `code-sessions.ts` imported only `uploadFile` (write), never
`listFiles`/`getFile` — so the session was never bridged from storage. The model
saw `(noch keine Dateien)` (`code-sessions.ts:330-335`), `activeExists` was false
(`:329`), the edit-in-place instruction was skipped (`:339-341`), and Groq invented
a fresh `styles.css`. The apply step (`:374-380`, upsert onConflict session_id,path)
was already correct. Full write-up: `sprint-11a/PHASE_0_ROOT_CAUSE.md`.

**Fix (11A-1):** `hydrateSessionFiles()` imports the project's storage files into
`code_session_files` as `saved` (only missing paths → drafts never clobbered),
called on `GET /:sessionId` and before building the model's file context in
`POST /:sessionId/messages`.

**Prod proof:** project "Test Vincent" (newsletter: index.html/styles.css/script.js).
Typed "mach den Hintergrund grün" → the EXISTING styles.css changed
(`background-color: #00ff00; /* Hintergrund grün */`), header/form styles preserved,
exactly ONE styles.css (no parallel file), shown as draft. Evidence:
`sprint-11a/edit-in-place/` (after-green-styles.png, VERIFY.md). Groq path works;
Gemini-in-code-tab not re-tested (0.3, non-blocking).

## Phase A — Unify chat & navigation

**Map:** `sprint-11a/CHAT_ARCH.md` — three surfaces (standalone / project-workspace
ChatTab / code-session), two backends. The "new English window on back-from-code"
was the workspace's old `ChatTab` (`chat_messages`, English) reached via
`dashboard-shell.tsx:136-137` `setActiveTab('chat')` → `project-workspace.tsx:55-59`.

**Fix (11A-A):** single chokepoint — `ProjectWorkspace` renders the new
`ProjectChatSurface` (→ canonical `StandaloneChat`) instead of `ChatTab`. Resolves
the conversation you came from (`goblin:lastChat:<projectId>`, stashed by
StandaloneChat's `confirmSend`), else the project's latest chat, else a fresh
project-bound session. Send-to-Code wiring untouched (still `?tab=code`).

**Prod proof:** `/work?tab=chat` now shows StandaloneChat — German "Leg los." empty
state, German composer + suggestion pills, project context bar; ZERO old-ChatTab
English ("What are we building?" / "No model configured" absent). Header "+"
dropdown subs German ("Eine neue Unterhaltung starten" / "Einen Projekt-Workspace
anlegen"). Evidence: `sprint-11a/nav/workspace-chat-is-standalone-de.png`.

## Phase B — Dashboard i18n (DE choice = DE)

Reuses the 10.10 language source (`localStorage goblin:preferred-lang`) via a shared
`useLang` hook (`apps/web/lib/use-lang.ts`) — no second i18n system. Fixed leaks:
- `ChatInput` composer placeholder (was "Describe what you want to build…" in EVERY
  chat) → DE "Beschreibe, was du bauen willst — oder frag einfach …".
- New-project modal: Blank/From-Template tabs, Project Name, What-are-you-building,
  Color, Create-project, gallery + template-detail + template-name strings.
- Model-search placeholder.

**Prod proof (lang=de):** composer placeholder DE, new-project modal fully DE
(Leeres Projekt / Aus Vorlage / Projektname / Worum geht's / Farbe / Projekt
erstellen), zero English leak detected. Evidence: `sprint-11a/i18n/`.

### Scoped follow-ups (deliberately not done — reported, not half-done)
- Project hub "Aktivität" feed still reads `chat_messages` (old); new turns write
  `standalone_messages` → won't appear there. Cosmetic; "Letzte Chats" already reads
  the canonical `chat_sessions`.
- Dead paths after unification: `ChatTab` / `/api/chat/stream` / `chat_messages` —
  separate cleanup.
- Product-wide i18n beyond dashboard+chat (settings deep pages, etc.) — out of scope
  this pass per brief.

## Phase C — Honest health banner
API `/version` = f45a673 (the Phase-0 API commit, live). HEAD 41109c5 is web-only,
so the API is functionally current. To make `/version` read HEAD exactly: founder
triggers a Railway redeploy of the API service (no code change to push). Cosmetic —
skipped this pass.

## Phase F — Self-test
- typecheck: web ✅, shared ✅, api ✅ (tsc --noEmit clean).
- prod build: shared ✅, api ✅ (tsup), web ✅ (next build).
- E2E vs prod: **108 passed / 0 failed** (public-desktop+mobile 82, auth-desktop+mobile 26).
  The auth `19-mobile-create-project` test exercises the translated new-project modal
  and passes.
- origin/master == HEAD == 41109c5 ✅. Web live on Vercel, API live on Railway.

## Commits (this sprint) — all pushed to origin/master
- f45a673 11A-1 (Phase 0, API hydrate) — deployed on Railway.
- 734475a 11A-A (Phase A chat unification) — deployed on Vercel.
- 41109c5 11A-B (Phase B dashboard i18n) — deployed on Vercel.
- (docs commit follows)
