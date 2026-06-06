# Row 1b — Hunk-Review Card on the LIVE surface · DONE report

Scope: bring the Row-1 multi-hunk review card to the surface a prod phone user
actually hits (`SessionPane`/`CodeWorkspace`), reusing the Row-1 card + lib + the
existing draft write path. No parallel apply path. Save/publish/streaming wiring
untouched. Commit `ROW1B-1` (9f8cf9d) — pushed, deployed.

## What changed (file:line)
- **`apps/web/components/code/SessionPane.tsx`** (only app file):
  - Imports `DiffModal` (Row-1 card), `lib/diff-hunks` via the card, `parseCodeBlocks`,
    `createTwoFilesPatch`.
  - `reviewBaseRef` + `reviewCard` state.
  - `handleSubmit` snapshots the edited file's **pre-edit content** before
    `agent.submit` (the only place the base exists — the agent overwrites it with
    a draft).
  - `maybeOpenReviewCard(text)` (runs in agent `onDone`, after `detail.refresh()`):
    `parseCodeBlocks(text)` → the produced block for the snapshot path; if it's an
    **edit of an existing file** (base non-empty, base ≠ produced) →
    `createTwoFilesPatch(base, produced)` → open the reused `DiffModal`.
  - Card wiring: whole-file accept → keep draft (close); per-hunk subset →
    `detail.editActive(reconstructed)` (the SAME draft write path); discard →
    `detail.discardDraft(path)` (existing).
- Reused unchanged: `components/project/diff-modal.tsx`, `lib/diff-hunks.ts`.

## Phase 0 finding (LIVE_REVIEW_MAP.md)
Live review today = the agent persists a draft, you eyeball it in the editor
(Kopieren/Verwerfen) — no diff, no hunks. No persisted base-vs-proposed pair
(refresh overwrites the saved content). So the base is captured client-side at
generation time. Slottable without touching save/publish → no Stop Condition.

## Verification — honest split

**GREEN — proven LIVE on prod (`vinc.hafner3`, account confirmed via dashboard
greeting "GUTEN ABEND, VINC.HAFNER3" — NOT the personal account):**
- Surface confirmed `SessionPane` (`.gb-session-pane` present), not the fallback.
- Real agent edit of an existing `styles.css` (Groq Llama 3.3 70B) → the
  **hunk-review card appeared on the live surface**, diffing base→draft
  (green #00ff00 → lila #7C3AED + font-size 18px), `+2 −1` — `_live-test-result.png`.
- **Apply landed in the EXISTING file** (lila present, **no new/generated file**)
  — ties to the 10–11A no-new-file guarantee — `_after-apply.png`.
- Live card at **390px** (bottom sheet, design-system faithful, rust/green diff
  tints), a real body+header edit `+2 −2` — `card-live-mobile.png`.
- typecheck (web+shared) PASS; api has no typecheck script (untouched).
  `pnpm @goblin/web build` PASS.

**AMBER — not reproduced live (but proven on the real component):**
- **Multi-hunk per-hunk + partial subset apply.** Groq's small-CSS edits land as
  contiguous changes, so `createTwoFilesPatch` merges them into ONE hunk (proven:
  two separate body+header changes still rendered as a single `+2 −2` hunk). The
  per-hunk ✕/✓ + subset reconstruction is proven on the **same** `DiffModal` +
  `diff-hunks` in the Row-1 local harness (reject accent / accept grid →
  orange+2col). The live surface runs that identical code via `editActive`, so
  the path is covered; a far-apart multi-hunk edit would exercise it live.

## Nothing lost / loop protected
SessionPane's streaming overlay, editor, Kopieren/Verwerfen, Sichern, Veröffentlichen,
the thread, file nav — all untouched. New files → no card (stream as today). The
card is additive: even if a base snapshot were off, accept=keep-draft (no-op),
discard=existing discard — the publish loop cannot break from this.

## Deploy
`origin/master == HEAD == 9f8cf9d`. Web deployed via Vercel (verified live above);
no API/migration changes.

## VERDICT
**GREEN** — the hunk-review card is now on the LIVE surface a phone user reaches
(`SessionPane`), proven with a real prod edit on the test account: card renders
(desktop + 390px), the change lands in the existing file, no new file, publish
loop untouched. Multi-hunk per-hunk subset apply is AMBER-on-live only because
Groq merged the edits into one hunk; that path is proven on the identical
component+lib. Next refinement (optional, founder's call): nudge the diff context
or labelling so distinct edits split into reviewable hunks live.
