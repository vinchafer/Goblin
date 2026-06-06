# DONE — Walk 3 (data-loss + two layout bugs + nav MAP)

Date: 2026-06-06 · Branch: master · Test user: **vinc.hafner3** (Groq) confirmed live.
Commits: `34f58c0` (WALK3-1 + WALK3-2) · `174f9ab` (WALK3-2b) · evidence commit follows.
All pushed; origin/master == HEAD. Deployed to prod (Vercel), verified by CDP at 390 as vinc.hafner3.

## Verdicts
- **Phase A (data-loss delete): GREEN** — confirm + undo, proven on prod.
- **Phase B (layout): GREEN** — 390 overflow 30→0; Dateien actions de-duplicated.
- **Phase 0 (MAP): delivered** — `NAV_MAP.md`, every symptom → cause (file:line), classified.

---

## Phase A — stop the one-tap data loss (`SessionPane.tsx`)
Root cause: the editor file-tab "x" (`CodeFileTabs onClose`) and the file-bar "Verwerfen"
both called `detail.discardDraft(path)` directly — a draft (unsaved generated work) was
destroyed instantly, no confirm, irreversible.

Fix (additive, no loop touch):
- Both now route through `requestDiscard(path)` (`SessionPane.tsx`): a **draft** → a confirm
  dialog ("Datei verwerfen? Nicht gespeicherte Änderungen … kann nicht rückgängig gemacht
  werden"); a **saved** file → plain close (it persists on the server).
- On confirm → `confirmDiscard()` snapshots the file, discards, and shows a **7 s
  "Verworfen · Rückgängig" toast**; `undoLastDiscard()` restores the exact draft + reselects it.
- FileExplorer (`FileExplorer.tsx:341`) and the dormant file-tree (`file-tree.tsx:238`) already
  confirm — this closed the only unconfirmed destructive path.

Prod proof (CDP, vinc.hafner3, 390): tapping "x" on a styles.css draft → confirm shown
(`a-delete-confirm.png`); **Abbrechen** keeps the file; **Verwerfen** removes it + shows the
undo toast (`a-undo-toast.png`); **Rückgängig** restores it (`discarded_gone=True →
restored_after_undo=True`).

## Phase B — two contained layout bugs (`project/[id]/page.tsx`, `RecentChats/SessionsCard.tsx`)
- **B.1 overflow:** the hub grid's mobile rule was bare `grid-template-columns: 1fr` (implicit
  min track = min-content) → a card with an unbreakable row blew the column to ~502px and ran off
  390. Fix: `minmax(0, 1fr)` + right-column `minWidth:0`. A second culprit: `RecentChatsCard` /
  `RecentSessionsCard` carried `alignSelf:'start'`, sizing them to content width in the flex
  column → `alignSelf:'stretch'` + `minWidth:0`. Prod: horizontal-overflow element count **30 → 0**
  at 390 (`b-overview-before.png` → `b-overview-after.png`).
- **B.2 duplicate button:** the Dateien panel had "Explorer öffnen" twice (top-right link + bottom
  primary). Dropped the bottom dup; panel now = one "EXPLORER ÖFFNEN →" (top-right) + one
  "Editor öffnen" (`b-dateien-dedup.png`; live link set = `["EXPLORER ÖFFNEN →","Editor öffnen"]`).
  Explorer itself untouched.

Swept the walk screens at 390: project overview now clean; coding-tab/editor toggle + review
(last pass) still fit; explorer unchanged.

## Phase 0 — MAP (no nav code shipped)
`NAV_MAP.md`: the two file stores + hydration (`code-sessions.ts:45-75`), every founder symptom
traced to a cause with file:line, classified SAFE-ADDITIVE vs NEEDS-CARE, plus the coherent
"one session, three views" target model and a classified fix list. Highlights:
- **S1** (no top Code from chat): project chats open `/dashboard/chat/[id]` → no `/project/`
  segment → `hasProject=false` → Code tab disabled. SAFE-ADDITIVE.
- **S3** (sidebar trap): live repro — hamburger in code tab doesn't surface the sidebar overlay
  (`<aside>` display:none). NEEDS-CARE (stacking).
- **0.3** (Send-to-Code brings old/no files): inject-into-existing-session + full-project
  hydration buries the new task. NEEDS-CARE — touches the two-store hydration feeding the loop.

## Stop conditions
None hit. A & B were pure additive UI/layout; the publish loop (`hydrateSessionFiles`/`/save`/
`/deploy`) was not touched. Nav fixes were mapped only, per scope.

## E2E (honest — names the fails)
- **Bounded prod public suite: 18 passed / 1 skipped** (`static.spec` + `landing.spec`, @public,
  chromium, `--timeout=25000`, 30s). Confirms the deploy renders and public surfaces aren't broken.
- **Full prod-targeted run (exclude @local-only): NO CLEAN SIGNAL.** It hangs — the auth/dashboard
  specs use `waitForLoadState('networkidle')`, which never settles against the live Vercel site
  (persistent connections), so the run stalled >1h and was killed. Not a pass, not a fix-it-now —
  a harness/env limitation, same family as last pass's documented fragility.
- **@local-only specs** (which cover the code tab / SessionPane) need a locally-provisioned test
  project; `openFirstProject` (`helpers/auth.ts:291,336`) can't provision against prod, and the
  local hybrid (local web + prod API) didn't authenticate cleanly last pass. So no existing spec
  exercises the changed surfaces (delete-confirm, hub grid, dedup).
- **Coverage for this pass's changes = direct prod CDP** as vinc.hafner3 at 390 (screenshots above):
  delete-confirm + cancel + discard→undo→restore; overflow 30→0; dedup link set verified. Build
  (web+shared+api) typecheck PASS, prod build PASS (`build.log` BUILD_EXIT=0).

## Screenshots (sprint-codetab/walk3/)
- `a-delete-before.png` — editor file tabs with bare "x" (pre-fix).
- `a-delete-confirm.png` — confirm dialog before discard.
- `a-undo-toast.png` — "Verworfen · Rückgängig" undo toast.
- `b-overview-before.png` / `b-overview-after.png` — 390 overflow fixed.
- `b-dateien-dedup.png` — single Explorer + single Editor action.
- `0-sidebar-in-codetab.png` — sidebar trap repro (overlay doesn't surface).
