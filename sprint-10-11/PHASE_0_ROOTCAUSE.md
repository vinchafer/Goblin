# Phase 0 — Conversation Context: Root Cause (Sprint 10.11)

**Status: ROOT CAUSE PROVEN LIVE ON PROD. Fix written. Prod-apply of the
migration is BLOCKED on a credential the session does not have (stale DB
password, no Supabase management token) → founder applies `0065`.**

## Symptom (founder, prod)
Every chat message behaves as turn 1 — no conversation is built up.
"make the heading bigger" → the model asks "which heading?". Iterative
building impossible.

## Investigation

### Message assembly is CORRECT in all three backend paths
- `apps/api/src/routes/chat.ts` (project chat → `chat_messages`): fetches
  history, passes to `streamCompletionGuarded`.
- `apps/api/src/routes/chat-sessions.ts` (standalone chat → `standalone_messages`):
  fetches history `:127`, `.slice(0,-1)` to drop the just-inserted turn `:135`.
- `apps/api/src/routes/code-sessions.ts` (code tab → `code_session_messages`
  + `code_session_files`): fetches prior thread + file context + `activePath`
  edit-in-place `:323-345`.
- Assembly point: `apps/api/src/services/model-router.ts:316-319`
  `messages = [...chatHistory, { role:'user', content: message }]`.

So the code includes the full ordered thread. The bug is not in assembly.

### Real cause: a table is MISSING in prod
Probed prod via REST (service role):

| table                  | prod status |
|------------------------|-------------|
| chat_sessions          | EXISTS (38) |
| **standalone_messages**| **404 — MISSING** |
| chat_messages          | EXISTS (61) |
| code_sessions          | EXISTS (5)  |
| code_session_messages  | EXISTS (8)  |
| code_session_files     | EXISTS (8)  |

`standalone_messages` (and `chat_sessions`) were only ever defined in the
manual `scripts/migrate-chat-sessions.sql` (Sprint 10.7), never promoted to a
formal `supabase/migrations/` file. `chat_sessions` reached prod;
`standalone_messages` did not.

Because `routes/chat-sessions.ts` did **not check** the insert/select errors,
the failure was silent:
- user-message insert (`:96`) → PostgREST 404, swallowed.
- history select (`:127`) → 404, `history = null` → `chatHistory = []`.
- assistant-message insert (`:178`) → 404, swallowed.

→ Every standalone-chat turn sends ONLY the current message. Zero memory.
The UI still shows the thread because that is client-side React state, not
re-read from the DB.

### Live proof (vinc.hafner3, Groq, prod)
- **Standalone chat** (`/dashboard/chat/<id>`, table missing): turn 1 built a
  newsletter landing page; turn 2 "make the heading bigger" → *"I would like
  more information… Are you referring to a specific document?"* — **NO memory**.
  Evidence: `context-3turn/turn1.png`, `turn2.png`.
- **Code tab** (`code_session_messages`/`_files` exist): "mach den Hintergrund
  blau" on the open newsletter session → model used full context and wrote
  `styles.css` with `background-color: #0000ff;` as a reviewable draft —
  **memory + edit-in-place WORK**. Evidence: `context-3turn/code-blue-result.png`,
  `code-styles-css.png`.

This is the cleanest possible demonstration: identical assembly code, one path
with the table (works), one without (amnesia). Creating the table fixes the
standalone path.

### Note on the code-tab "edit didn't apply" hypothesis (0.3)
Disproven for the code-tab path: the edit applies (draft `styles.css`, live
diff). The founder's edit-failure was the standalone-chat amnesia and/or a
Gemini-model failure (session default was Gemini 2.5 Pro; switched to Groq for
the test). The Goblin edit-in-place mechanic (`activePath` → same-file draft →
diff) functions on prod.

## Fix
1. `supabase/migrations/0065_standalone_messages.sql` — creates
   `standalone_messages` (+ `chat_sessions` IF NOT EXISTS) with index + RLS.
   Idempotent. **Founder must apply** (`npx supabase db push` or Studio) — this
   session's DB password is stale and there is no management token.
2. `routes/chat-sessions.ts` — insert/select errors now surface
   (`console.error`; user-msg failure returns 503 instead of faking a
   memory-less reply). A missing table can never again masquerade as silent
   amnesia.
3. `routes/chat.ts` — also fixed a latent duplicate: the project-chat history
   fetch included the just-inserted user turn AND the router appended it again,
   so the last user message was sent twice. Now `.slice(0,-1)`, matching the
   other two routes. Added the same error logging.

## Verify-after-apply (founder)
After applying 0065 + Railway API redeploy: repeat the 3-turn standalone build
("newsletter page" → "heading bigger" → "background blue"). Each turn must
build on the last. Expected: identical to the code-tab behaviour proven above.
