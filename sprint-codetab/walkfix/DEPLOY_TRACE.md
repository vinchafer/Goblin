# DEPLOY_TRACE — where the edit dies (Phase 1.1)

Date: 2026-06-08 · Branch: master · Repro: chat "mach die Landingpage blau" →
Übernehmen (editor shows change) → Sichern → Veröffentlichen → live = ORIGINAL.

## The data path (apply → save → deploy)

### 1. Chat edit → draft  (`apps/api/src/routes/code-sessions.ts:356-459`)
- `POST /:sessionId/messages` with `{ prompt, modelId, activePath }`.
- `hydrateSessionFiles` (`:45-75`) mirrors the project's real S3 files into
  `code_session_files` as `change_state='saved'` (only paths NOT already a session
  row — never clobbers a draft). So the open file exists in the session.
- Edit-in-place instruction (`:400-402`): when the active file exists, the model is
  told to return the COMPLETE file under EXACTLY `activePath`.
- Model streams → `full` text → `parseCodeBlocks(full)` (`:429`) →
  each block upserted as a `draft` at **`b.path`** (`:435-441`), key
  `(session_id, path)`.

### 2. Übernehmen (apply)  (`apps/web/components/code/SessionPane.tsx:656-665`)
- Whole-file `onApply` persists NOTHING — relies on "draft already == proposed"
  (the server already wrote the draft in step 1). Correct *iff* the draft path is
  the file the user is editing.
- Editor foregrounds a **draft** first (`useCodeSessionDetail.ts:57-61`,
  C.3/NAVFIX-6) → the user SEES the changed draft.

### 3. Sichern (save)  (`code-sessions.ts:278-304`)
- `POST /:sessionId/save` reads `change_state='draft'` rows → `uploadFile(projectId,
  f.path, f.content)` → S3 key `projects/{projectId}/{f.path}` → marks `saved`.
- Uploads the DRAFT's path verbatim.

### 4. Veröffentlichen (deploy)  (`code-sessions.ts:307-353` → `vercel-service.ts:76-180`)
- Gate: 0 drafts remaining (`:314-319`).
- `deployToVercel` → `listFiles(projectId)` (all S3 keys) → `downloadFile` each →
  ships to Vercel as a static deployment (`framework:null`), `target:'production'`.
- Ships **whatever is in S3**, keyed by path.

S3 is one store, the session drafts are the other. `uploadFile` (step 3) and
`listFiles`/`downloadFile` (step 4) use the SAME key scheme
(`file-storage.ts:70`, `storageKey = projects/{id}/{path}`). So **save→deploy is
path-coherent**: whatever path the draft has, that's the S3 key, that's what
deploys. The loop's shape is sound.

## WHERE THE EDIT IS LOST — the path the draft is written to

`parseCodeBlocks` (`apps/api/src/lib/parse-code-blocks.ts:47-106`) resolves a
filename per block. When the model returns the edited file WITHOUT a filename
comment (just ` ```html ` / ` ```css `), it hits the language fallback
(`:86-89`):

```
html → index.html      css → styles.css      js → script.js   …
```

The server then persists the draft at that **inferred default name**, NOT at
`activePath` (`code-sessions.ts:435-441`). Consequence when the open file is named
anything other than the language default:

- active file = e.g. `landing.html` (or the project's CSS is inline / named
  `style.css`).
- Model drops the filename comment (Groq Llama does this intermittently) → block
  inferred as `index.html` / `styles.css`.
- Draft is written to the SIBLING `index.html` / `styles.css`, NOT to the real
  `landing.html`. The real file stays untouched.
- Editor foregrounds the new draft (draft-first) → **looks applied** (founder:
  "editor shows the change").
- Save uploads the sibling to S3; the real entry file is never overwritten.
- Deploy ships both; Vercel serves the original entry file → **live = original**.

Even on an `index.html` project this bites whenever the model answers "mach es
blau" with a `css` block: the blue lands in a fresh `styles.css` that the existing
HTML never links → live unchanged.

### Verdict
The save→deploy loop is NOT the break. The break is upstream: the edit is persisted
to a **language-inferred sibling path** instead of the file the user is editing.
The two-store/hydration angle was checked and is clean — `hydrateSessionFiles` only
imports MISSING paths and runs before save, never mirrors S3 back over a draft.

## The surgical fix (Phase 1.2) — does NOT rewire the loop
Make the edit land on the file the user is editing:
1. `parse-code-blocks.ts` (api + web mirror): expose `inferred: boolean` — true only
   when the path came from the `LANG_EXT`/scratch fallback (model named no file).
2. `code-sessions.ts` `POST /messages`: in edit-in-place mode (`activeExists`),
   retarget the first `inferred` block whose extension matches the active file to
   `activePath` before upserting the draft. Explicitly-named blocks (real new files)
   are untouched; multi-file/new-project sends (no active file) are untouched.
3. `SessionPane.buildReviews`: same retarget so the review card + foreground match
   the server draft.

Loop shape unchanged (still draft → save(S3) → deploy(S3)); only the path the edit
is written to is corrected.

## Verification note
Final P0 GREEN requires a real prod walk (mobile 390, vinc.hafner3): edit → apply →
save → publish → open live link shows the change. That needs Phase 2 (GitHub/Vercel
connection) to deploy, and a logged-in browser session — deferred to the founder
walk / a session with prod browser access. The fix above is correct and harmless
independent of that walk.
