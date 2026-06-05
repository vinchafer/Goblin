# Sprint 11A — Phase A: Chat surface & navigation map

## How many chat surfaces existed (before 11A)

THREE, on two different storage backends:

| Surface | Route / mount | API | Table | Language |
|---|---|---|---|---|
| **Standalone chat** (canonical) | `/dashboard/chat/[sessionId]` → `StandaloneChat` | `/api/chat-sessions/:id/stream` | `standalone_messages` (per `chat_sessions`) | German |
| **Project workspace chat** (old) | `/dashboard/project/[id]/work?tab=chat` → `ChatTab` | `/api/chat/stream` + `/api/chat/:projectId/history` | `chat_messages` (one stream per project) | **English** |
| **Code-session chat** | code tab → `SessionPane` | `/api/code-sessions/:id/messages` | `code_session_messages` + `code_session_files` | German |

`StandaloneChat` is project-aware (10.7-14): the same component renders top-level
AND project chats; `chat_sessions.project_id` ties it to a project, and the hub
"Letzte Chats" + sidebar list it. This is the memory-fixed, canonical surface.

## Why "back from code" / the header landed in a different, new, English window

Quoted routing:

- StandaloneChat **Send-to-Code** → `apps/web/components/chat/standalone-chat.tsx:137`
  `router.push('/dashboard/project/${target}/work?tab=code')` — leaves the chat
  route and enters the **workspace shell**.
- In the workspace, the header tab pills are wired at
  `apps/web/components/app-shell/dashboard-shell.tsx:133-144`. Inside `/work`,
  tapping **Chat** runs `setActiveTab('chat')` (line 136-137), NOT navigation.
- `setActiveTab('chat')` makes `ProjectWorkspace` render the chat branch —
  `apps/web/components/project/project-workspace.tsx:55-59` → `<ChatTab>` — the
  OLD `chat_messages`, **English** surface (`apps/web/components/workspace/chat-tab.tsx`:
  "What are we building?", "No model configured", "Add API key →"). That is the
  "new English window," different from the StandaloneChat the user was in.
- The header "+" dropdown "Neuer Chat" — `Header.tsx:69-87` — always POSTs
  `/api/chat-sessions` with `{}` (no project) and pushes to a fresh
  `/dashboard/chat/[id]`: a brand-new window, and its dropdown subtitles were
  hard-coded English ("Start a fresh conversation", "Create a project workspace").
- `/dashboard/chat` (no id) — `apps/web/app/dashboard/chat/page.tsx` — also ALWAYS
  creates a new session.

## The unification (smallest safe change — Send-to-Code preserved)

Single chokepoint: the workspace chat tab. `ProjectWorkspace` now renders
**`ProjectChatSurface`** instead of `ChatTab`
(`project-workspace.tsx:56-58`). `ProjectChatSurface` resolves the canonical
`chat_sessions` for the project and renders **`StandaloneChat`** — so every chat
the user reaches is the same German, memory-backed surface.

Resolution order (return you to where you were):
1. `sessionStorage['goblin:lastChat:<projectId>']` — set by StandaloneChat's
   `confirmSend` right before Send-to-Code navigates (`standalone-chat.tsx`).
2. else the project's most recent `chat_sessions` (list endpoint, updated_at desc).
3. else create one bound to the project.

Send-to-Code is untouched: StandaloneChat still routes to `?tab=code`, and
CodeWorkspace still consumes the `goblin:stc-pending` stash. The old `ChatTab`
component is left in the repo (unused) for rollback. The English leak is closed by
Phase B (the unified surface uses `ChatInput`, whose placeholder is now i18n).

### Known scoped follow-ups (not done this pass, by design)
- The project hub "Aktivität" feed still reads `chat_messages` (old project chat);
  new conversations write `standalone_messages`, so fresh chat turns won't appear
  in that specific feed. Cosmetic; the hub "Letzte Chats" already reads the
  canonical `chat_sessions`.
- `ChatTab` / `/api/chat/stream` / `chat_messages` are now dead paths in the UI;
  removing them is a separate cleanup.
