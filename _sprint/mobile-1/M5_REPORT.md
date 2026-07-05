# M5 — Tier 3 editor, demoted but dignified — REPORT

**Branch:** `mobile-1-2026-07-07` · **2026-07-07** · Status: **DONE, gate green.**

Spec §3 Tier 3. Nothing removed; the editor is simply no longer the mobile front door.

## What shipped
- The editor is reached via the explicit **"Bearbeiten"** button in the Reader (wired in M2;
  `editFromReader` → `mobileMain="editor"`). Exiting (mobile back) returns to the Reader/cards.
- **Fixed sin #1 — find/replace overlay:** new **`EditorSearchOverlay.tsx`** — a compact floating
  overlay (find + prev/next + on-demand replace + close), driving CodeMirror's own search commands
  (`setSearchQuery`/`findNext`/`findPrevious`/`replaceNext`/`replaceAll`) so behaviour is identical to
  the panel; only the surface is compact. The file-bar search button now opens this overlay **on mobile**
  (`setSearchOverlay(true)`) instead of the permanent desktop `openSearchPanel`. **Desktop is untouched**
  (still the panel) — scope armor: the desktop editor stays the front door.
- **Fixed sin #2 — no keyboard grab on open:** opening the editor mounts `CodeEditor` without focusing
  the view; only explicit user actions (search overlay input, undo/redo) take focus. The overlay focuses
  its own input, never the editor.

## Gate (375px real viewport, local stack)
Harness `.e2e-tmp/mobile1-m5.mjs` — Reader → "Bearbeiten" → editor.
- **No keyboard grab on open:** `activeTagOnEditorOpen = { tag: "BODY", inCm: false }` — the active
  element is the body, not the CodeMirror content. Screenshot `shots/m5-editor.png`.
- **Compact overlay, not the desktop panel:** `searchOverlay: true` AND `builtinPanelAbsent: true`
  (`.cm-search.cm-panel` count 0). Screenshot `shots/m5-search-overlay.png` (floating find bar:
  Zeile · prev/next · replace · close).
- **Edit → save → badge updates:** typed an edit in the editor → exited to Reader → "Nur sichern".
  `editPersisted: true` (the edit is in the file), `fileChangeState: "saved"` (draft → saved; the card
  badge clears once saved — a fresh edit surfaces as GEÄNDERT, a save clears it). Screenshot
  `shots/m5-after-save.png`.

## Verification
- `npx tsc --noEmit` (apps/web): clean.
