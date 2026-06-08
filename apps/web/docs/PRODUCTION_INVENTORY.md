# Production Inventory — for Sprint 10 demoMode architecture

Code-based inventory of `apps/web` (the real Goblin app), produced for the Pitch
Sprint 10 "living production mirror" work. Maps the production view components,
where data/auth happen, and the patterns that affect how demo mode must be wired.

> **Method note:** This inventory is **code-based only**. The live authenticated
> browser walk-through requested in the Sprint 10 §0 read step could not be run —
> Chrome remote debugging is not enabled on this machine (browser-harness failed
> in Sprint 9 for the same reason). All findings below come from reading source.

---

## 1. Core view components (file paths)

### App shell / chrome
- `components/app-shell/dashboard-shell.tsx` — **client** (`"use client"`). The shell. Composes `Header` + `Sidebar` + children, reads `useApp()`, owns modals/sheets, mobile/desktop media query, inline `createClient()`. Props: `{ projects, children, previewUrl, isFirstLogin, userName }`.
- `components/layout/Header.tsx`, `components/layout/Sidebar.tsx` — chrome.
- `components/app-shell/bottom-tab-bar.tsx` — exists but **not rendered** (see note in dashboard-shell). Mobile mode-switch lives in the header mode-tile.
- `components/app-shell/model-switcher.tsx`, `trial-banner.tsx`, `projects-list.tsx`, `usage-indicators.tsx`.
- `components/header/AvatarMenu.tsx`.

### Chat view
- `components/chat/standalone-chat.tsx` — **client**. Main chat view. **Prop-driven initial render**: `StandaloneChat({ sessionId, initialMessages = [], projectId, projectName })`. Holds messages in `useState(initialMessages)`. Inline `fetch()` happens only on **send** (streaming to `/api/chat-sessions/...`). → demo seeds via `initialMessages`, demoMode disables send.
- `components/chat/Message.tsx` — leaf message renderer. **Already used by current demo routes.**
- `components/chat/ChatInput.tsx`, `ComposerPlusPopover.tsx`, `CodeBlock.tsx`, `EmptyChat.tsx`.
- `components/workspace/ChatMessages.tsx`, `ChatMessage.tsx`, `chat-tab.tsx` — alt chat surface (0/4 touch fetch/auth — pure presentational).

### Code view
- `components/code/CodeWorkspace.tsx` — code view shell. 16 files in `components/code/` (SessionThread, SessionPane, CodeFileTabs, CodeFileTreePanel, StreamingDiffView, etc.); **3/16** touch fetch/auth.
- `components/editor/code-editor.tsx` — leaf editor. **Already used by current demo-code route** (`readOnly`, `theme`).

### Preview view
- `components/preview/preview-tab.tsx` — **1/1** touches fetch/auth.

### Files
- `components/files/*` — **1/1** touches fetch/auth (file tree).

---

## 2. Where API calls happen (by data type)

There is **no centralized data-hook layer.** Data fetching is **inline** in
components/pages: **47 component files call `fetch(` directly**, **45 call
`getSession`/`createClient` inline.** `contexts/app-context.tsx` holds **UI state
only** (active tab/project, modals, pending injections) — no data fetching.

| Data | Where | API endpoint |
|------|-------|--------------|
| User identity | inline `createClient().auth.getSession()` / `getUser()` (43 client + 9 server files) | Supabase auth |
| Project list | `app-shell/projects-list.tsx`, dashboard pages | `/api/projects` |
| Conversations / messages | **server**: `app/dashboard/chat/[sessionId]/page.tsx` (server-side Supabase DB query → passes `initialMessages` to `StandaloneChat`); **client**: streaming on send | `/api/chat-sessions/...`, Supabase `standalone_messages` |
| Code sessions / file content | `components/code/*` | `/api/code-sessions/...` |
| File tree | `components/files/*` | `/api/code-sessions/...` |
| Preview content | `components/preview/preview-tab.tsx` | project preview URL |
| Models | `model-switcher.tsx` | `/api/models`, `/api/models/health` |
| Misc | various | `/api/byok-keys`, `/api/github/*`, `/api/integrations/vercel`, `/api/rankings` |

---

## 3. Two rendering models (decisive for demoMode)

1. **Client presentational components** — `DashboardShell`, `StandaloneChat`,
   `CodeWorkspace`, `preview-tab`, Header/Sidebar. `"use client"`, read `useApp()`,
   do inline client `createClient()`/`fetch()`. **These CAN be made demo-aware**
   via a client `useDemoMode()` context + prop.
2. **Server-component data pages** — `app/dashboard/chat/[sessionId]/page.tsx`,
   `app/project/[id]/page.tsx`, `app/dashboard/project/[id]/page.tsx`. `async`,
   `@/lib/supabase/server`, `auth.getUser()` → `notFound()`/`redirect()`,
   `force-dynamic`, server-side DB queries. **A client context CANNOT intercept
   these** — they run before any client tree mounts.

**Implication:** demo routes must render the **presentational client components
directly with seed props** (the model the current demo routes already use with
`Message`/`CodeEditor`), NOT go through the server data pages. The server pages
need **no change**. The UI the user sees is 100% the production components; only
the data path is seed-injected (by design, per Sprint 10 rule §12 server-component
clause).

---

## 4. Event handlers

Handlers are co-located in the client components (onClick/onChange/onSubmit on
buttons, composer inputs, tab switches, model switcher, sidebar nav, file tree
rows). No central command bus beyond `components/ui/CommandPalette.tsx` and
`hooks/useKeyboardShortcuts.ts`. demoMode must neutralize handlers per-component
(`onClick={demoMode ? undefined : handler}`, `disabled={demoMode}`,
`preventDefault` on nav links).

---

## 5. Context / providers

- `contexts/app-context.tsx` — `AppProvider` / `useApp()`. UI state. **Demo routes
  must wrap in this** so the shell renders.
- `contexts/build-context.tsx` — `BuildProvider`.
- `lib/theme.tsx` — theme context.
- `components/ui/SheetStack.tsx` — sheet stacking.
- New for Sprint 10: `DemoModeContext` (`lib/demo/demo-mode-context.tsx`) +
  `DemoProviders` wrapping the above with demo-safe values.

---

## 6. Demo-relevant touch set (estimate)

View subset touching fetch/auth (the files needing demoMode guards):
`app-shell` 5/9, `chat` 2/6, `code` 3/16, `preview` 1/1, `sidebar` 1/2, `files`
1/1 ≈ **~13 files with fetch/auth guards** + ~8–12 more for handler-disable/prop
plumbing ≈ **~20–25 production files, ~150–300 LOC**, all surgical, all gated on
`demoMode === true` (zero change when `false`).

---

## 7. Risks (carried to DEMO_MODE_ARCHITECTURE.md / Checkpoint #1)

- **No hook layer** → the Sprint prompt's "hook-level substitution" (B.3) has no
  `useConversation`/`useProject` to override. Substitution must happen via (a) a
  fetch+supabase **boundary shim** in `DemoProviders`, or (b) ~20 scattered
  per-component guards, or (c) prop-injected seed into prop-driven components
  (`StandaloneChat.initialMessages`) + guards only for the inline-fetch remainder.
  **Recommend (c)+(a) hybrid.** Decide at Checkpoint #1.
- **45 inline auth calls** → any missed one redirects to `/login` in demo. The
  boundary-shim (return a fake session in demo) de-risks this vs. per-call guards.
- **Server data pages bypassed** → "100% identical" holds for UI, not the data
  route. State plainly to Vincent.
- **No live browser verification** until Chrome remote debugging is enabled.
