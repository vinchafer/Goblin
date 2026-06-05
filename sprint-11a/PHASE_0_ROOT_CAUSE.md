# Sprint 11A — Phase 0 Root Cause: Edit-in-place creates a NEW file

**Symptom (Vincent, iPhone, prod):** In the code tab, typing "mach den Hintergrund
blau" on a project that already has files CREATED a new css file instead of
changing the existing one. The 10.11 report's claimed "edit-in-place works (wrote
a styles.css draft)" was the bug itself — that "draft" WAS the wrongly-created new
file.

## The pipeline (code tab chat → edit → apply)

1. Web auto-creates an EMPTY code session — `apps/web/components/code/CodeWorkspace.tsx:76-81`
   (`s.createSession({ name: "Neue Session" })`, no files).
2. Session files are stored in the `code_session_files` DB table, seeded ONLY from
   the Send-to-Code payload — `apps/web/components/code/CodeWorkspace.tsx:96-134`,
   `apps/api/src/routes/code-sessions.ts:108-114`.
3. The project's REAL files live in S3 object storage under `projects/{id}/...` —
   `apps/api/src/services/file-storage.ts:70-103` (written by Save/`uploadFile` and
   the project generator).
4. Message handler builds the model's file context from `code_session_files` ONLY —
   `apps/api/src/routes/code-sessions.ts:323-335` (`existingFiles`).
5. Edit-in-place is gated on `activeExists` (the open file being a session row) —
   `code-sessions.ts:329, 339-341`. The "return the SAME path, leg KEINE neue Datei
   an" instruction is only emitted when `activeExists` is true.
6. Apply: parsed blocks are upserted with `onConflict: 'session_id,path'` —
   `code-sessions.ts:374-380` (this layer is CORRECT — same path overwrites).

## The actual cause (which of 0.1's three)

The apply step (3rd candidate) was already correct. The cause is candidates **1 + 2**:

- **The model never sees the project's existing files.** A code session is NEVER
  hydrated from project storage — `code-sessions.ts` imported only `uploadFile`
  (write), never `listFiles`/`getFile` (read). So for an auto-created or
  partially-seeded session, `existingFiles` is empty/incomplete →
  `fileContext = '(noch keine Dateien)'`.
- **Edit-in-place is therefore skipped.** With no matching session row,
  `activeExists` is false → the "edit the existing file, don't create a new one"
  instruction is never sent → the model invents a fresh `styles.css`, which gets
  upserted as a new draft.

Root cause in one line: **two disconnected file stores** (project S3 vs
`code_session_files`) with no read-bridge from storage into the session.

A secondary, lesser contributor: `parse-code-blocks.ts` de-dupe is response-local,
and an unnamed ```css block infers `styles.css`; if the real file is named
differently a parallel file can still appear. Mitigated by hydration + the explicit
named-path instruction.

## The fix (11A-1)

`hydrateSessionFiles()` in `apps/api/src/routes/code-sessions.ts`: pull the
project's storage files into `code_session_files` (as `change_state: 'saved'` —
they are the real current files), importing only paths not already present so
unsaved drafts are never clobbered. Idempotent, best-effort. Called in
`GET /:sessionId` and at the top of `POST /:sessionId/messages`.

Result: the model sees the real `index.html`/`styles.css`/`script.js`,
`activeExists` is true, the edit-in-place instruction fires, and a returned
`styles.css` overwrites the EXISTING one (shown as a draft diff against saved),
no new parallel file.

Keeps the reviewable-draft UX: hydrated files are `saved`; the model's edit makes
the target `draft` → SessionPane shows draft-vs-saved diff before Save/Deploy.
