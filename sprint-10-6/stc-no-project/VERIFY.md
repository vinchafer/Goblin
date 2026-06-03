# Sprint 10.6-4 — Send-to-Code Without Project

Date: 2026-06-03

## Flow (code-path verified)
1. Standalone chat (no project), code in last message → "Code" menu → "Send to Code".
   `standalone-chat.tsx:handleSendToCode` (no `hasProject`):
   - stashes `{content, filename}` under `sessionStorage['goblin:stc-pending']`,
   - fetches the user's projects (best-effort),
   - opens the picker modal: **Neues Projekt erstellen** (primary) · existing
     projects · Abbrechen.
2. "Add to existing" → `router.push('/dashboard/project/<id>/work?tab=code')`.
3. "Create new" → `router.push('/dashboard?start=1')` → new-project modal.
4. `CodeWorkspace` mount effect reads `goblin:stc-pending`, removes it, and
   re-dispatches `goblin:sendToCode` → app-context sets `pendingCodePayload` +
   switches to the Code tab → the payload lands as a draft.

## Bug found + fixed (10.6-4)
The "Create new" branch was **broken**: both new-project modals navigated to the
project **hub** `/dashboard/project/<id>` (which defaults to the Chat tab and never
mounts `CodeWorkspace`), so the stashed payload was never consumed — it sat in
sessionStorage until the user happened to open the Code tab.

Fix: a shared `pendingStcTab()` helper (`lib/stc-pending.ts`) appends
`/work?tab=code` to the post-create navigation **iff** `goblin:stc-pending` exists.
Applied to all create paths:
- `components/projects/new-project-modal.tsx` (blank + template create)
- `components/app-shell/new-project-modal.tsx`

The "Add to existing" branch already routed to `/work?tab=code`, so it was fine.
`/work?tab=code` → `ProjectWorkspace` sets `activeTab='code'` → `CodeTab` →
`CodeWorkspace` mounts → rehydrate consumes the stash.

## Status
- Code-path: VERIFIED + fixed. typecheck green.
- Live CDP walk: **could not run locally** — no Chrome with `--remote-debugging-port`
  on this machine (`browser-harness`: "DevToolsActivePort not found"). Deferred to
  the founder's iPhone Max-walk.

## Founder live-verify
- [ ] Open standalone chat (no project), generate code, "Send to Code" → picker.
- [ ] "Neues Projekt erstellen" → after create, land on the **Code tab** with the
      code already present as a draft (not the hub, not chat).
- [ ] "Add to existing" → same: code lands as a draft in the chosen project.
