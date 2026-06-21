# W2 — The Vanishing / Unrecoverable Build Window — Diagnosis & Fix

Date: 2026-06-21 · Branch `walk-fixes-2026-06-21`

## The report (founder live walk)
Created a landing page from the dashboard composer → had to open a **new project**
→ Forge was coding → near the end the **build/preview window closed**, was **not
visible** and **not recoverable from the sidebar**. A build whose window disappears
with no way back is a trust-killer (looks like lost work).

## How the build window actually works (mapped, with cites)

1. **Dashboard composer** (`app/dashboard/page.tsx`) → "Sag Goblin" choice →
   `new-project-modal.tsx` creates a project + a chat session and navigates to
   `/dashboard/chat/<sessId>` (a project-bound chat). Forge replies *in the chat*.
2. **Send-to-Code** (`components/chat/standalone-chat.tsx`, `confirmSend`) stashes
   the produced files (`sessionStorage 'goblin:stc-pending'`) and deep-links to
   `/dashboard/project/<id>/work?tab=code`.
3. **Workspace shell** (`components/project/project-workspace.tsx`) chooses which
   surface to render from `activeTab` (`chat` | `code` | `preview`).
4. **Code surface** (`code-tab.tsx` → `CodeWorkspace.tsx` → `SessionPane.tsx`) is the
   "build/preview window": the streaming agent (`useCodeAgent`) writes draft files,
   the live diff shows code appearing, publish → live URL.

### What is and isn't lost
- **The work persists.** The agent's draft files are written **server-side** at
  completion (`useCodeAgent` comment; `done` event carries `files`). A client
  navigation does not delete them — the `code_sessions` row + files survive.
- **A specific session is deep-linkable.** `useCodeSessions` honors a
  `?session=<id>` query param on first load (hook lines ~63-70), and the project
  hub's `RecentSessionsCard` links to `…/work?tab=code&session=<id>`. So a finished
  build **is** reachable: sidebar → project (hub) → "Letzte Code-Sessions" → card.

### The real defect — the **view** is thrown away, not the work
`project-workspace.tsx` decided the tab **only** from `?tab=` and **fell back to
`chat` on every run**:

```ts
const requested = searchParams?.get('tab');
const next = requested === 'code' || requested === 'preview' ? requested : 'chat';
setActiveTab(next);
```

Consequences:
- Any return to the workspace **without** `?tab=` (a soft-nav, a re-render that
  re-emits `searchParams`, or simply navigating back) **snaps the user off the
  code/preview window back to chat** → the build/preview window "vanishes."
- Clicking the project in the **sidebar** goes to the hub (`/dashboard/project/<id>`),
  not back to the live `/work` surface — so from the user's view the window is gone
  and the sidebar doesn't bring it back. Recovery exists (hub → session card) but is
  non-obvious, which reads as "not recoverable from the sidebar."

This matches the repro exactly: opening a **new project** mid-build navigates away;
the old build keeps running and persists server-side, but its **window** is gone and
the obvious path back (sidebar) lands on the hub, not the window.

## The fix (contained)
`project-workspace.tsx`:
- Honor an explicit `?tab=` (unchanged).
- When **no** tab is requested, **restore the last tab for this project** from
  `sessionStorage('goblin:wsTab:<projectId>')` instead of forcing `chat`.
- **Persist** `activeTab` per project on every change.

Effect: the build/preview window stays in place across navigation/remount; a return
to `/work` lands back on the code/preview surface, not chat. The per-session
deep-link (already working) continues to re-open a specific build from the hub.

No schema change. No change to the streaming/persistence path (the work was never the
thing being lost). Smallest change that removes the "window vanished" class.

## Not fixed here (logged, by design — needs more than a safe contained change)
- **F-W2-a — Sidebar click lands on the hub, not the live window.** The project row
  navigates to `/dashboard/project/<id>` (server hub). Recovery to the build is one
  more click (hub → session card). Making the sidebar restore the live `/work`
  surface would change established nav semantics app-wide → out of scope for a
  contained walk-fix. The hub session card + honored deep-link is the recovery path;
  verify it reads clearly in the live test.
- **F-W2-b — Mid-stream durability on a full page reload/close.** Client navigation
  is safe (server finishes + persists). A hard reload/tab-close *during* the stream
  depends on whether the server completes its write — not verified, not changed here.
  If telemetry shows truncated sessions, add server-side run journaling (real work,
  separate task).
