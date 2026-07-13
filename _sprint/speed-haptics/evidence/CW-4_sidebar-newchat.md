# CW-4 — Sidebar new-chat optimistic busy (evidence)

**Offender (DIAGNOSIS Part A, #2b):** `Sidebar.tsx:588-606` (`handleNewChat`) + the "+" button (`637-655`). The click `await`s `supabase.auth.getSession()` **and** `POST /api/chat-sessions` **before** any navigation or feedback — a dead tap with no optimistic state (unlike `ProjectChatLaunch`, which already sets busy).

**Fix:**
- New `creatingChat` state in `RecentChats` (`Sidebar.tsx:570`).
- `handleNewChat`: `if (creatingChat) return;` (double-tap guard) + `setCreatingChat(true)` **before** the awaits + `finally { setCreatingChat(false) }`.
- "+" button: `disabled={creatingChat}`, `aria-busy={creatingChat}`, `cursor`/`opacity` reflect busy, and the icon swaps from the plus to a spinning ring (`@keyframes spin`, globals.css:126) while creating.

**Two wins:** (1) the press registers **instantly** (spinner) before the network work resolves; (2) the double-tap that this dead button invited can no longer fire two `POST`s (guard + `disabled`).

**Honesty (Feeling-invariant 6):** the spinner means "a chat is being created" — which is true from the tap onward. No claim of completion; navigation still happens only on `res.ok`.

**Gate (deterministic):** `setCreatingChat(true)` precedes `await supabase.auth.getSession()` in the diff; button carries `disabled`/`aria-busy` bound to `creatingChat`; `spin` keyframe confirmed present (globals.css:126). Also inherits CW-1's `:active` press scale.

**Regression:** demo-inert guard (`isDemoActive()`) unchanged; `stopPropagation` unchanged; success path (navigate + loadSessions) unchanged.
