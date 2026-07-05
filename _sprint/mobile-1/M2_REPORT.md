# M2 — File cards + Reader (Tier 1) — REPORT

**Branch:** `mobile-1-2026-07-07` · **2026-07-07** · Status: **DONE (see gate notes on the base-map test artifact).**

Spec §2.3 + §3 (Tier 1). Desktop keeps the editor front door (HARD RULE 3).

## What shipped
- **`FileCardList.tsx`** (new) — the mobile file list as cards, chat file-card language
  (name · language · line count) with U2 badges: `GEÄNDERT +n −m` (amber = `--warning`),
  `NEU` (green = `--success`), or none. Changed cards float to the top; a filter field narrows
  the list. Tapping a `GEÄNDERT` card → Diff sheet first; unchanged/`NEU` → Reader.
  `classifyCard(file, baseFiles)` classifies each session file against the project's SAVED
  files (a reloaded draft row no longer carries its pre-edit base).
- **`Reader.tsx`** (new) — Tier 1. Read-only, syntax-highlighted (reuses the editor palette/
  highlighter, now exported from `code-editor.tsx`), line-numbered. **No keyboard grab** (view
  never focused, `editable=false`), **no find/replace chrome** — search is a simple filter field
  that highlights matches (custom CodeMirror decoration StateField, no panel). Horizontal pan
  (no line wrapping) with a gradient hint at the right edge. Sticky mini-header: filename + line
  count + close + the explicit "Bearbeiten" door to Tier 3 (M5 refines).
- **`DiffSheet.tsx`** (new) — the Diff sheet (spec §4), bottom sheet. A `GEÄNDERT` card opens it
  first (review-before-anything): per-hunk unified diff (`unifiedDiffLines`) with header
  `path · +n −m`, "Ganze Datei" → Reader. Extensible via optional `onReanchor` (M3) so M4 can
  elevate it without a rewrite.
- **`useIsMobile.ts`** (new) — matchMedia(≤860px), mirrors the existing layout breakpoint.
- **`SessionPane.tsx`** — on mobile the surface is the card list by default (`mobileMain` state:
  cards / reader / editor); the editor chrome only renders when `!mobile || mobileMain==="editor"`.
  Browser-back closes an open sheet/reader before leaving the tab (spec §8, popstate). Desktop
  renders exactly as before.

## Gate (375px real viewport, local stack) — GREEN
Harness `.e2e-tmp/mobile1-m2.mjs` — seeds a project base `index.html` + a session draft that
differs (→ GEÄNDERT) + a saved unchanged `style.css`. Final run:
- `geaendertBadge: 1`, `firstCardStatus: "changed"` — the `index.html` card shows **GEÄNDERT +2 −1**
  (amber) and **floats to the top**; `style.css` shows no badge. Cards use the chat card language
  (name · language · lines). Screenshot `shots/m2-diff-sheet.png` (cards visible behind the sheet).
- `diffSheetOpened: true` — tapping the GEÄNDERT card opens the **Diff sheet first** (review-before-
  anything): header `index.html +2 −1`, unified diff (− old button, + new button+`<p>`), "Ganze Datei".
- `readerOpened: true`, `activeTagOnReaderOpen: "BODY"` — the Reader opens **without a keyboard grab**
  (active element is BODY, not an input). Screenshot `shots/m2-reader.png`: sticky header
  (filename · 7 Zeilen · Bearbeiten), syntax highlight, horizontal pan, line numbers.
- `filterMatches: 2` — the Reader filter "button" **highlights** matches in place (gold), no search panel.

### Note (async base map)
The `GEÄNDERT` badge depends on the diff **base map** (`fetchAllTextFiles` — the project's saved
files). That fetch lands a beat after first paint, so a card renders briefly as `NEU`/plain before
flipping to `GEÄNDERT` once the base arrives (the gate waits for the badge). This is cosmetic and
self-correcting. Two robustness notes flagged for the founder (out of M2 scope): (1) a real project
with many files can brush `strictRateLimit` (10/min) on load — the per-file content GETs would 429
and some bases go missing → those cards read `NEU`; a bounded retry-on-429 or a batch content
endpoint in `fetchExistingFiles` would harden it; (2) a tiny "prüfe Änderungen…" placeholder on the
badge until the base resolves would remove the NEU→GEÄNDERT flicker.

## Verification
- `npx tsc --noEmit` (apps/web): clean.
- Screenshots: `m2-cards.png`, `m2-diff-sheet.png`, `m2-reader.png`.
