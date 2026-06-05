# Session Handoff — after Sprint 11A (2026-06-05)

## State
Sprint 11A "Fix the Code Loop & Navigation" complete. The product's #1 broken
promise — code-tab edit-in-place creating a NEW file instead of changing the
existing one — is root-caused, fixed, and PROVEN on prod. Chat surfaces unified to
the canonical StandaloneChat, and the dashboard now honours the language choice.

3 atomic commits, all pushed and DEPLOYED:
- `f45a673` 11A-1 (Phase 0, API) — Railway live.
- `734475a` 11A-A (Phase A, chat unification) — Vercel live.
- `41109c5` 11A-B (Phase B, dashboard i18n) — Vercel live.

typecheck (web+shared+api) green · prod build green · **E2E 108/0 vs prod**.
origin/master == HEAD == 41109c5. Reports: `SPRINT_11A_COMPLETE.md`,
`SPRINT_11A_WIP.md`. Evidence + maps: `sprint-11a/`.

## The fix that mattered (Phase 0)
Code sessions stored files in `code_session_files` (seeded only from Send-to-Code);
the project's REAL files live in S3 (`projects/{id}/...`). `code-sessions.ts` never
read storage → the model saw an empty workspace → invented a new styles.css.
Fix: `hydrateSessionFiles()` bridges project storage → session (as `saved`, only
missing paths) on GET detail + before each message. Edit-in-place (10.8-8) then
works. **Prod proof:** "mach den Hintergrund grün" changed the existing styles.css
(`#00ff00`), preserved the other rules, one file, draft. See
`sprint-11a/edit-in-place/`.

## Verified on PROD (CDP, account vinc.hafner3 — Groq, never the personal account)
- Phase 0 edit-in-place ✅ · Phase A workspace chat = German StandaloneChat ✅ ·
  header dropdown German ✅ · Phase B composer + new-project modal German (lang=de) ✅.

## 🔴 Founder action items
1. **Carry-over from 10.11 — still required:** apply
   `supabase/migrations/0065_standalone_messages.sql` to prod if not yet done (the
   standalone-chat memory fix depends on it; `.env.local` DB password was stale
   this session too, could not apply). Idempotent.
2. **iPhone re-walk of the loop:** build a page → "mach es blau" → confirm the
   existing file turns blue with a diff (no new file) → move chat↔code↔back without
   a strange new English window → DE everywhere on the dashboard.
3. **(Optional, cosmetic) Phase C:** trigger a Railway redeploy of the API so
   `/version` reads HEAD (currently f45a673 = the API code; HEAD 41109c5 is web-only,
   so the API is functionally current — the banner just over-reports drift).

## Scoped follow-ups (reported, not half-done)
- Hub "Aktivität" feed still reads `chat_messages` (old); new turns write
  `standalone_messages`. Cosmetic. "Letzte Chats" already canonical.
- Dead after unification: `ChatTab`, `/api/chat/stream`, `chat_messages` table —
  separate cleanup.
- i18n beyond dashboard+chat (deep settings pages etc.) — out of scope this pass.
- Phase A "return to exact conversation" stash is code-complete; full round-trip
  CDP walk not exhausted.

## Next (11B)
Mobile code-tab mockup — now designs on a working loop (edit-in-place + unified
chat), per the original 11A→11B plan.
