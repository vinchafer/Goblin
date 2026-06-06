# NAVFIX — DONE

Untangle project ↔ chat ↔ session ↔ coding ↔ editor. Implements the SAFE-ADDITIVE
and NEEDS-CARE fixes mapped in `../walk3/NAV_MAP.md`. Phased so the safe wins ship
first; the publish loop (`hydrateSessionFiles` / `/save` / `/deploy`) was **not
touched** — every fix is routing / presentation / titling.

Branch: master. Commits `9e8eb17 → 90929d7`, all pushed. Web → Vercel, API → Railway
(both auto-deploy on push). Prod verified via CDP as **vinc.hafner3** (greeting
confirmed "HALLO, VINC.HAFNER3" — never personal), mobile **390**.

Loop guard held: no Stop Condition hit → no NAVFIX_NOTES.md proposal needed. The
"task sinks under the project's files" concern was solved at the **presentation**
layer (foreground the draft + land on the editor), keeping all hydrated project
files present (correct coherence) without changing hydration/save/deploy.

---

## Phase A — SAFE-ADDITIVE  ·  **GREEN**

### A.1 — Code tab reachable from a project chat  ·  GREEN (prod-verified)
A project chat opens on `/dashboard/chat/[id]` (no `/project/` segment) → the shell
saw no project → Code tab disabled. Approach (b): StandaloneChat publishes its
owning `project_id`; the shell falls back to it.
- `apps/web/contexts/app-context.tsx:56,80,135` — `chatProjectId` + setter.
- `apps/web/components/chat/standalone-chat.tsx:238,245-247` — publish project_id on mount, clear on unmount.
- `apps/web/components/app-shell/dashboard-shell.tsx:67-71` — `activeProjectId = urlProjectId ?? chatProjectId`.
- **Prod:** from project chat `…/chat/dc99ff5c` the Code tab is `disabled:false`; clicking it routes to `…/project/c7f53841/work?tab=code` (enters that project's code). A fresh project-LESS chat `…/chat/3178b608` keeps Code `disabled:true` ("Starte ein Projekt …"). Screenshots `d-a1-projectchat-390.png`, `d-a1-code-after-click-390.png`.

### A.2 — Editor keeps a way to ask Goblin  ·  GREEN (prod-verified)
Mobile editor view hid the thread (`display:none`); now a persistent docked bar in
the editor routes through the existing chat→edit path (`handleSubmit`).
- `apps/web/components/code/SessionPane.tsx:60` (`askText`), `:337-338` (`.gb-editor-ask` CSS), `:529-555` (the form, `onSubmit → handleSubmit`).
- **Prod:** in the editor view the bar "Goblin um eine Änderung bitten…" is visible with the file/review still shown (not hidden). Screenshot `d-a2-editor-askbar-390.png`.

### A.3 — Content-aware session titles (heuristic, no model call)  ·  GREEN
- `apps/web/lib/session-title.ts` (new) — `deriveSessionTitle` / `titleFromPrompt` / `titleFromPath` / `isPlaceholderTitle`.
- `apps/web/components/code/CodeWorkspace.tsx:125,148,209` — Send-to-Code sessions titled from the primary file path.
- `apps/web/components/code/SessionPane.tsx:141-143` — the first prompt renames a still-placeholder session like the task (via `onAutoTitle` → `renameSession`).
- **Prod (path-title):** a Send-to-Code session was created titled **"index.html"** (not "Aus dem Chat"/"Session N"). First-prompt rename is code-verified (the path-title flow proves the wiring; a live model turn was not driven this pass).

### A.4 — Cap the session list  ·  GREEN-by-code (endpoint functional on prod)
- `apps/api/src/routes/code-sessions.ts:105,112` — `.limit(20)` on the recency-ordered list.
- **Prod:** the list endpoint loads sessions and the picker/tabs render (query intact). The cap value is 20; forcing >20 sessions on prod was avoided (would pollute the test account), so the limit itself is code-verified.

---

## Phase B — Sidebar trap  ·  **GREEN** (prod-verified)
On mobile the hamburger didn't surface the sidebar over the full-height code surface
→ project rows unreachable. Additive stacking only (no shell restructure).
- `apps/web/components/layout/Sidebar.tsx:142` (backdrop z-index 1000), `:380` (mobile aside z-index 1001).
- Belt-and-suspenders: `apps/web/components/code/SessionTabs.tsx:18,97-106` ("Zurück zum Projekt" button) wired in `CodeWorkspace.tsx:174`.
- **Prod:** in the code tab, tapping the hamburger opens the mobile sidebar (`transform translateX(0)`, `z-index 1001`); `elementFromPoint` at its centre is inside the sidebar → it's **above** the code surface; "Test Vincent" row is reachable. The "<" back-to-project button is visible in the code tab's session bar. Screenshots `b-before-hamburger.png`, `b-after-hamburger.png`.

---

## Phase C — Send-to-Code / "my task sinks"  ·  **GREEN** (prod-verified, loop untouched)
Routing / presentation / titling only — `hydrateSessionFiles` / `/save` / `/deploy`
unchanged.

### C.1 — Deterministic ingest (no empty-window race)
- `apps/web/components/code/CodeWorkspace.tsx:42-43,57-81` — the stash is read ONCE synchronously into local state (`stashPayload`) instead of round-tripping through a window event; auto-create is blocked until the stash is checked (`stashChecked`) and while any payload is pending (`incoming`). The payload is never lost and never lands on an empty session.

### C.2 — A new task → its own clear titled session (no silent inject)
- `apps/web/components/code/CodeWorkspace.tsx:110-152` — 0/1 session → create a fresh content-titled session; 2+ → picker (pick-existing or new). The silent inject-into-stale branch is gone.

### C.3 — The task surfaces visibly (doesn't sink)
- `apps/web/hooks/code/useCodeSessionDetail.ts:52-61` — the active file prefers a **draft**, so a fresh task isn't buried behind a hydrated saved file.
- `apps/web/components/code/SessionPane.tsx:100-108` — a draft-only / message-less (Send-to-Code) session lands on the **editor view** so the file shows immediately (kills the "empty window + chat" look). Runs once; never overrides a manual toggle.
- **Prod:** Send-to-Code of a 2-file snippet created a new session **"index.html"**; it opened on the editor showing `<button>Klick mich!</button>` with both files as drafts (tabs `index.html ·`, `index-1.html ·`), the docked ask bar present, and the save/publish actbar intact. No empty window; no inject into the prior "Aus dem Chat" session. Screenshots `c-preview-sheet.png`, `c-after-stc-codetab.png`, `d-a2-editor-askbar-390.png`.

---

## Publish loop — untouched
`hydrateSessionFiles` / `/save` (`/:sessionId/save`) / `/deploy` in
`apps/api/src/routes/code-sessions.ts` were not modified. The save/publish actbar
and a prior session's LIVE card render normally in the verified code tab. A full
deploy round-trip was not re-run this pass (would cost a real Vercel deploy); the
loop code and UI are unchanged from the shipped-and-verified state.

## E2E
The changed surfaces (code tab session/editor, Send-to-Code, the shell project↔chat
derivation) have **no Playwright spec coverage** — they were verified by CDP on prod
as above. The public suite was run against prod for regression; see report for the
honest status. No green-wash: code-tab behaviour is CDP-verified, not spec-asserted.

## Verdict
- Phase A: **GREEN**
- Phase B: **GREEN**
- Phase C: **GREEN**
