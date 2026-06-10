# DEPLOY_TRACE_2 — the deploy-stale bug, proven on REAL bytes (attempt 3)

Date: 2026-06-10 · prod · vinc.hafner3 · mobile 390 · project **test 322r42**
(`c49f1c07-72ad-4117-af74-98d8df93b67e`).
Method: drove prod via CDP, inspected the ACTUAL stored content the deploy ships
from (`GET /api/projects/:id/files` + `/files/*` = S3) AND the live deployment.
No hypothesis — bytes quoted below.

## The decisive bytes

### S3 (deploy source) file list
```
index.html, script.js, styles.css, styles-1.css
```

### S3 `index.html` (the entry the deploy serves)
```html
<head>
  <title>Landingpage mit Anmeldeformular</title>
  <link rel="stylesheet" href="style.css">   ← links style.css (SINGULAR)
</head>
```

### The stylesheet the page links does NOT exist
- `style.css` (what `<link>` loads) → **NOT in storage**.
- `styles.css` (1160 B, has every edit, e.g. `background-color:#32CD32`) → exists, **never loaded**.
- `styles-1.css` (290 B, a de-dup artifact of an earlier orphaned edit) → exists, never loaded.

### Live deployment (`test-322r42-vincent-2-s-projects.vercel.app`)
```
GET /style.css   → 404      ← the linked stylesheet 404s
GET /styles.css  → 200      ← edits live here, page never asks for it
GET /styles-1.css→ 200
getComputedStyle(body).backgroundColor → rgba(0,0,0,0)   ← page is UNSTYLED
```

### The model's own words (session thread, prod)
> „Um den Hintergrund der Landingpage grün zu machen, müssen wir die
> **`styles.css`**-Datei anpassen.  ```css <!-- styles.css --> body { …
> background-color:#32CD32 … } ``` "

The model writes an **explicitly-named** `styles.css` block (`inferred:false`).

## Verdict — which branch

This is the **"edit is NOT in the deploy-source file the page consumes"** branch.
The edit IS persisted to S3 — but to `styles.css`, while the entry HTML loads
`style.css`. The file the page actually fetches (`style.css`) does not exist, so
**no CSS edit is ever visible live** (green never showed; blue never would). The
save→deploy loop is path-coherent and sound (proven in DEPLOY_TRACE attempt 2);
the break is upstream: the edit lands on a path the HTML does not link.

## Why attempt 2 (WALKFIX-1) did not fix it
WALKFIX-1 retargets only a **`inferred`** block whose extension **matches the
active file** to `activePath`. Here:
- the css block is **explicitly named** (`<!-- styles.css -->`) → `inferred:false`
  → retarget never fires;
- and even for an unnamed block, the active file was `index.html` (`.html`) while
  the block is `.css` → extension mismatch → retarget never fires.
So a css edit made while an HTML file is open is never reconciled to the
stylesheet the HTML links. The orphan persists.

Origin of the divergence: the **original generation** emitted `index.html` linking
`style.css` while the css block was named `styles.css` (the `LANG_EXT` default is
`styles.css`, plural). Every later edit inherited the orphan.

## The fix (WALK2-1) — surgical, loop shape unchanged
Enforce the consumption invariant: **a CSS/JS edit must land on the asset the
session's HTML actually links.**

In `POST /:sessionId/messages`, after parsing blocks (and after the WALKFIX-1
retarget), reconcile each `.css`/`.js` block against the local assets the session's
HTML links:
- parse `<link rel=…stylesheet… href="X">` and `<script src="X">` from the HTML
  files already in the session;
- if a block's path is NOT one of those linked hrefs and there is **exactly one**
  linked asset of the same type, retarget the block to that linked href.

Result for this project: the css block (`styles.css`) is retargeted to the linked
`style.css` → save uploads `style.css` → deploy ships it → the live page (which
loads `style.css`) finally shows the change. Existing broken projects **self-heal**
on the next edit. Mirrored in `SessionPane.buildReviews` so the review card + the
foregrounded file match the persisted draft. The web mirror is also in
`apps/web/lib/parse-code-blocks` consumers.

Guards: only fires when the session HTML links exactly one asset of that type
(ambiguous/multi-stylesheet projects untouched); new-project sends with no linked
asset untouched; explicitly-named blocks that already match a linked href untouched.
Loop is still draft → save(S3) → deploy(S3); only the write path is corrected.

## Verification (content half — what this session CAN prove)
After the fix + a real edit cycle, the deploy-SOURCE `style.css` provably contains
the edit (see DONE.md / re-inspected bytes). The final live-URL render needs a
publish and is the founder's check (Vercel deploy needs his Vercel token; this test
account's deploys are gated) — clearly marked, NOT a guess: the bytes the deploy
ships are shown to be correct at the source.
