# NAV_MAP — project ↔ chat ↔ session ↔ coding ↔ editor ↔ explorer

Walk 3, Phase 0. **Map only — no nav code shipped this pass.** file:line throughout.
Classification: **SAFE-ADDITIVE** (fixable next pass without touching build/save/publish)
vs **NEEDS-CARE** (touches routing/session model/loop — decide first).

---

## 0.1 What is a "session"? The two file stores

A **project** owns the canonical files. A **code session** is a working view over them.

| Store | Where | Role | Lifetime |
|---|---|---|---|
| **S3 / project storage** `projects/{id}/…` | `apps/api/src/services/file-storage.ts` (`uploadFile`/`listFiles`/`getFile`) | the REAL project files; what FileExplorer shows and what Deploy ships | permanent |
| **`code_session_files`** (Postgres) | `apps/api/src/routes/code-sessions.ts` | per-session working copy, `change_state` = draft / saved / deployed | per session |

**Hydration** = `hydrateSessionFiles` (`code-sessions.ts:45-75`). On **every** `GET /:sessionId`
(`:177`) and **every** `POST /:sessionId/messages` (`:371`) it pulls all S3 paths NOT already in
the session into `code_session_files` as `saved` (cap 50). Idempotent; drafts never clobbered.

Flow: chat-edit → `parseCodeBlocks` → upsert as **draft** (`:430-435`) → **Sichern** (`/save`,
`:273`) uploads drafts to S3 + marks `saved` (`:288-291`) → **Veröffentlichen** (`/deploy`, `:302`)
ships S3 + marks `deployed`. **This is the load-bearing loop — do not rewire.**

**Consequence (root of 0.3):** because hydration re-mirrors the *entire* project file set into
*any* session on open/prompt, a session is not "a task's files" — it's "the whole project, plus
this session's drafts." Multiple sessions of one project all converge on the same S3 file set.

---

## 0.2 Entry/exit paths + founder symptoms

Route truths:
- Project **overview** = `/dashboard/project/[id]` (`app/dashboard/project/[id]/page.tsx`).
- Project **workspace** = `/dashboard/project/[id]/work?tab=chat|code|preview`
  (`work/page.tsx` → `project-workspace.tsx`). `activeTab` is client state in `app-context.tsx:65`.
- **Standalone chat** = `/dashboard/chat/[sessionId]` (`app/dashboard/chat/[sessionId]`).
- Header tab switcher (`Header.tsx`) is driven by `dashboard-shell.tsx`. **`hasProject` =
  `!!activeProjectId`, and `activeProjectId` is parsed FROM THE URL** (`dashboard-shell.tsx:62-65`,
  regex `/\/project\/([^/]+)/`). Code tab is **disabled when `!hasProject`** (`Header.tsx:198, 247-249`).

### Symptom 1 — "from the project chat you can't switch to Code at the top; only via Letzte Session (slow)"
**Cause (SAFE-ADDITIVE):** project chats open on the **standalone** route. `ProjectChatLaunch.tsx:42`
and `RecentChatsCard.tsx:35` push `/dashboard/chat/{id}` — which has **no `/project/` segment**, so
`activeProjectId = undefined` → `hasProject = false` → the header **Code tab is disabled**. The user
must detour: overview → `RecentSessionsCard` → `/work?tab=code` (`RecentSessionsCard.tsx:31`).
**Fix shape:** either (a) open project chats inside the workspace shell
(`/dashboard/project/[id]/work?tab=chat`, where `ProjectChatSurface` already renders the same
`StandaloneChat`), or (b) make `dashboard-shell` derive `activeProjectId` from the chat session's
`project_id` (the chat page already knows it) so Code stays enabled. (a) is cleaner; both are
additive (no loop touch). Verified live: confirmed in code; the `/chat/[id]` route shows the
mode-tile but Code is gated off.

### Symptom 2 — "in the editor you lose the chat; can't ask the tool to change code from the editor view"
**Cause (SAFE-ADDITIVE):** the code tab DOES have a chat (`SessionThread` + `SessionPromptInput` in
`SessionPane.tsx:276-289`), but on mobile the pane **toggles** thread↔editor via `mobileView`
(`SessionPane.tsx:258-262`); in editor view the thread is `display:none`. After a generation the
code lands on the editor view, so the composer is one toggle away ("Zurück zum Thread",
`SessionPane.tsx:327`) but not visible. **Fix shape:** a persistent "ask Goblin" affordance in the
editor view (re-open the composer / a docked prompt bar) without hiding the review — additive,
no loop touch. (Ties to last pass's Phase C layout.)

### Symptom 3 — "can't exit the code tab via the sidebar; clicking the project does nothing (trap)"
**Cause (NEEDS-CARE):** sidebar project rows call `navigate('/dashboard/project/{id}')`
(`Sidebar.tsx:269, 449` → `router.push`, `:121`). Live repro on prod (390, code tab): tapping the
hamburger did **not** surface the sidebar overlay — the `<aside>` stayed `display:none; width:0`
(`0-sidebar-in-codetab.png`). So the project row is **unreachable** from the code tab on mobile →
the trap. Likely the mobile overlay open-state / stacking vs the full-height `gb-codetab` surface
(`dashboard-shell.tsx:154-167` renders Sidebar + `main` in a flex row; the code surface fills `main`).
**Fix shape:** ensure the mobile sidebar overlay opens above the code surface (z-index/portal) and/or
a visible "back to project" affordance in the code tab header. NEEDS-CARE because it touches the
shell layout/stacking; verify open-state with fresh session before changing.

---

## 0.3 Send-to-Code reliability (the most confusing)

Path: `StandaloneChat.confirmSend` (`standalone-chat.tsx:129-146`) stashes files in
`sessionStorage['goblin:stc-pending']` and routes to `/work?tab=code`. `CodeWorkspace` ingests via
**two** paths: the mount replay of `goblin:stc-pending` (`CodeWorkspace.tsx:54-73`, re-dispatches
`goblin:sendToCode` → `app-context.tsx:84-101` sets `pendingCode` + `setActiveTab('code')`) **and**
the `pendingCode` prop effect (`CodeWorkspace.tsx:96-134`). Plus an **auto-create** empty session
(`CodeWorkspace.tsx:76-81`). Routing of a payload: 0 sessions → create; 1 → **inject into that
existing session**; 2+ → picker (`CodeWorkspace.tsx:124-131`).

- **"Morning's files reappear instead of the new task" (NEEDS-CARE):** Send-to-Code **injects into
  an existing session** (`injectIntoSession`, `CodeWorkspace.tsx:83-93`) and then `GET /:sessionId`
  **hydrates the whole project's S3 files** (`code-sessions.ts:177`) back in as `saved`. So the new
  payload is one draft amid the morning's entire saved file set — the new task "sinks." A new task
  is not given a clean session.
- **"Send-to-Code brings nothing → empty window + chat" (NEEDS-CARE):** race between the auto-create
  effect (`:76-81`), the `stc-pending` replay (`:54-73`) and the `pendingCode` prop effect
  (`:96-134`, guarded by `consumedRef`). If auto-create wins or the payload is consumed before a
  session exists, you land on an empty session.
- **"Prompt typed directly in the coding tab hydrates the previous files in ~1s":** that's hydration
  on `POST /messages` (`code-sessions.ts:371`) working as designed — but it's the same mechanism that
  drowns a fresh Send-to-Code task.

**Fix shape:** make "a new task" map to a clear session (new, or explicitly chosen — not silent
inject), and decide hydration policy so a fresh task isn't buried under the full project history
(e.g. hydrate lazily / mark the task's own files). Touches the session/hydration model → **NEEDS-CARE.**

---

## 0.4 Session titles
Code-session `name` is set to `'Neue Session'` / `'Aus dem Chat'` / `Session N`
(`useCodeSessions.ts:79,105`, `CodeWorkspace.tsx:105,126,152,189`); rename via
`PATCH /:sessionId` (`code-sessions.ts:204-222`). **No content-aware titling exists.** A
content-derived title could be (a) a cheap heuristic from the first prompt / first file path
(SAFE-ADDITIVE, client or on create), or (b) a model-generated summary on first turn
(**scope flag** — needs the agent/model path in `code-sessions.ts:351`).

## 0.5 Session picker cap
`GET /api/code-sessions` returns **all** active sessions, `order updated_at desc`, **no limit**
(`code-sessions.ts:102-107`). `SessionPickerDialog` / `SessionTabs` render the full list; only the
hub `RecentSessionsCard` caps (5). Unbounded growth → add `.limit(N)` to the query (and/or "show
more" in the picker). **SAFE-ADDITIVE.**

---

## 0.6 Coherent target model (proposal — not built)

**One session, three views.** chat / coding / editor are views of a single session the user moves
between freely: the project chat lives **inside** the workspace shell so the top Chat·Code·Preview
switcher is always live (no `/chat/[id]` detour, no disabled Code tab); the editor keeps a docked
"ask Goblin" affordance so you never lose the chat; the sidebar always opens above the code surface
so there's no trap; **Send-to-Code creates/targets one clear session and hydration never buries the
new task** under the whole project history; sessions are content-titled and the picker is capped.

### Fix list, classified
**SAFE-ADDITIVE (next pass):**
- S1: open project chats in `/work?tab=chat` (or derive `activeProjectId` from chat `project_id`) → Code tab live in chat.
- S2: docked "ask Goblin" composer in the editor view (don't hide the chat).
- 0.4a: heuristic content title from first prompt/file path.
- 0.5: `.limit(N)` + recency order on the session list / picker.

**NEEDS-CARE (decide first — routing / session model / stacking):**
- S3: mobile sidebar overlay stacking over the code surface + a "back to project" affordance.
- 0.3: Send-to-Code → one clear session + a hydration policy that doesn't drown a fresh task (touches the two-store hydration that feeds save/publish).
- 0.4b: model-generated titles (adds a model call).

**Do NOT touch** without a decision: `hydrateSessionFiles`, `/save`, `/deploy` (`code-sessions.ts`)
— the publish loop.
