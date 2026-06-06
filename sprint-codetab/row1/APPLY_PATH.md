# Row 1 — Phase 0: the wired apply path (read before reshaping)

**How a diff becomes a written file today:**

1. A chat/Send-to-Code change calls `POST /api/projects/:id/diff` with
   `{filePath, proposedContent}` → `apps/api/src/routes/projects.ts:761` builds
   a **unified diff** via `createTwoFilesPatch(...)` and returns
   `{ diff, currentContent, proposedContent }`.
2. `useCodeInjections.handleSendToCodeApply` (`hooks/code/useCodeInjections.ts:99`)
   stores that as `diffData = {filePath, currentContent, proposedContent, diff}`.
3. `code-tab-classic.tsx:66` renders `<DiffModal …>` from `diffData`.
4. **Apply = whole-file only.** `handleDiffApply` (`useCodeInjections.ts:106`) →
   `applyInjectionDirect(filePath, proposedContent, t)` (`:69`) → saves
   `currentContent` as `undoPayload`, then `applyExternalEdit` (`useCodeFiles.ts:99`)
   does `PUT /api/projects/:id/files/:path {content: proposedContent}` — writes
   the **entire** proposedContent. `onDiscard` = `setDiffData(null)` (writes nothing).
   Undo = `handleUndoInjection` re-PUTs `previousContent` (surfaced by InjectedBanner).

**Diff shape:** `createTwoFilesPatch` output → parseable by `diff`'s `parsePatch`
→ `patches[0].hunks[]`, each `{oldStart, oldLines, newStart, newLines, lines:[" ctx","-del","+add"]}`.

**Where I make it hunk-aware (no new write path, no agent change):**
- New pure lib `apps/web/lib/diff-hunks.ts`: `splitHunks(diff)` (mechanical,
  via `parsePatch`), `labelHunk()` (honest: "Änderung N · Z. x–y", CSS-prop
  heuristic only when certain), `reconstructWithHunks(currentContent, diff,
  acceptedIdx)` (via `applyPatch` on a subset patch; returns `string|null`).
- `DiffModal` reshaped in place into the responsive review card; per-hunk ✕/✓.
- The card computes the accepted-subset content with the lib and commits via a
  thin new hook handler `handleDiffApplyContent(content)` in `useCodeInjections`
  that calls the **same** `applyInjectionDirect` write path (PUT files/:path).
- Whole-file accept = today's `handleDiffApply` (proposedContent) — robust default.
- Reject-all = `onDiscard`. Reconstruct fail (`null`) → fail-safe, keep file,
  surface message, offer whole-file. Never write corrupt content.

Render site: `DiffModal` is used **only** in `code-tab-classic.tsx` (not SessionPane).
