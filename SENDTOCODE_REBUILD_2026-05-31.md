# Send-to-Code — Root Cause + Fix (Phase 3, 2026-05-31, Sprint 5)

R1 (Sprint 4) found the headline chat→ship demo blocked: after Send-to-Code → Apply, Build
errored **"Project has no files to deploy."** This phase found the *actual* root cause (not the
one R1 hypothesised) and fixed it, verified end-to-end at the API level.

## The real root cause — a Hono wildcard routing bug (not "snippet not persisted")
R1 guessed the snippet wasn't being written. The truth is worse and broader:

`apps/api/src/routes/projects.ts` registered file routes as `/:id/files/*` and read the path via
**`c.req.param('*')`**. In **Hono 4.x, `param('*')` is not populated for a `/*` wildcard route** —
it returns `undefined`. So **every** GET/PUT/DELETE on a file path hit the `if (!filePath) return
400 "File path required"` branch.

Consequence — confirmed by live probe against both the prod (Railway) API and the local API:
```
PUT /api/projects/{id}/files/index.html  ->  400 {"error":"File path required"}
GET /api/projects/{id}/files/index.html  ->  400
```
This means **file load AND save were broken app-wide** (the code editor could never persist or
reload a file), and Send-to-Code Apply silently failed → `listFiles()` returned `[]` →
`vercel-service.ts:39` correctly refused: *"no files to deploy."* R1's symptom was a downstream
effect of this single bug.

## Fix
`apps/api/src/routes/projects.ts`:
- Added `wildcardPath(c)` — returns `c.req.param('*')` if present, else extracts the segment after
  `/files/` from `c.req.path` and URL-decodes it (handles client `encodeURIComponent`'d paths,
  including nested `a/b/c.tsx`).
- Applied to the GET, PUT, and DELETE `/files/*` handlers.
- Added the missing `isSafePath()` traversal guard to the PUT handler (parity with POST/DELETE).

## Verification (live, API-level) — `audit/stc-persist-probe.mjs`
As the test user, against the **local** API after the fix (and the same probe reproduced the bug
on prod before):
```
createProject     201
filesBefore       []
putIndexHtml      200  {"success":true,"path":"index.html"}      ← was 400
filesImmediate    ["index.html"]                                  ← was []
filesAfterDelay   ["index.html"]
readBack          200  len=158  "<!DOCTYPE html>…"                ← persisted content correct
cleanup           200  (project deleted)
```
`listFiles()` now returns the file, so the deploy `length === 0` guard passes. The headline
chat→Apply→Build path is unblocked. Raw: `sprint-5/stc-flow/persist-probe.json`.

> Note: the local API runs this fixed code; the **prod Railway API still runs the old build** until
> the founder redeploys it. The web app (`pnpm dev`) talks to prod, so a full browser walk of the
> deploy loop will only pass once prod is redeployed with this commit. The fix itself is proven.

## Filename improvement (secondary, also shipped)
Even with persistence working, the old fallback named HTML blocks `html-snippet` (extensionless,
not servable). New `apps/web/lib/detect-filename.ts` derives a deployable name from content/
language (HTML→`index.html`, JSX→`Component.tsx`, CSS→`styles.css`, JSON→`data.json`, …, last
resort `snippet.txt`). Wired into the chat `CodeBlock` + `chat-tab` send-to-code dispatch.

## Chat code-block polish (canon §A — partial)
`components/workspace/CodeBlock.tsx`: two buttons with tooltips + accessible names — **Kopieren**
("In Zwischenablage kopieren") and **An Code senden** ("An Code-Tab senden (filename)"). Replaced
the old ✓ glyph + `</>`-style arrow with lucide `check` / `copy` / `code` SVGs (zero emoji).

## Deferred — full canon UX (designed, not built; documented for founder)
The brief's full Send-to-Code canon includes more than persistence. Given the overnight budget was
prioritised on the **beta-blocking** persistence bug across all 9 phases, these UX layers are
**not** built and are recommended as a focused follow-up:
1. **CodeSessionPicker** — "Welche Session?" dialog when a project has 2+ open editor sessions.
   (Today: single active buffer; injection targets it / creates the file directly.)
2. **ReviewEditor** — editable preview pane before Apply with Cancel/Copy/Apply + a filename input.
   (Today: a read-only DiffModal with Apply/Discard already exists and now persists correctly.)
3. **ModelPicker in the Code tab** — scoped model selection for AI-assisted code edits.
4. **Multi-session backend** — `GET/POST/PATCH /code-sessions` + session service.

These are additive to a now-*working* persistence core. The R1 beta-blocker — the one fix that
makes the headline demo deployable — is resolved and verified.
