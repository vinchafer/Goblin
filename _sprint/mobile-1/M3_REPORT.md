# M3 — Point & instruct (Tier 2) — REPORT

**Branch:** `mobile-1-2026-07-07` · **2026-07-07** · Status: **DONE, gate green (incl. real model round-trip).**

Spec §3 Tier 2 — the differentiator. Consumption-relevant → **Ledger M7 same commit.**

## What shipped
- **`LineActionSheet.tsx`** (new) — the Tier-2 bottom sheet with exactly two actions (spec: resist
  menu-bloat): **"Diese Stelle ändern lassen"** + **"Kopieren"**, headed by `file · Zeile a–b`.
- **`Reader.tsx`** — long-press detection (pointer hold ~500ms, cancels on >8px move). Resolves the
  line under the pointer via CodeMirror `posAtCoords` → `doc.lineAt`, or the current selection's line
  range if a range is selected → `onLineAction(from, to)`.
- **`lib/anchor-message.ts`** (new) — `buildAnchoredMessage()`, a **pure, deterministic** builder for
  the structured anchor payload: the instruction + `[Anker → file · Zeile a–b] …` + **±`SURROUNDING_LINES`
  (=10)** lines of surrounding code WITH line numbers. This is the sole new token-consuming mechanism
  (ledger M7); being pure makes the payload verifiable without a model round-trip.
- **`CommandBar.tsx`** — the anchor chip (already scaffolded in M1) now driven: shows `file · Zeile a–b`,
  dismissible.
- **`SessionPane.tsx`** — wires it: Reader/Diff-sheet long-press → action sheet → "ändern lassen"
  pre-anchors the command bar (`commandAnchor`) and returns to the cards so the incoming GEÄNDERT card
  surfaces; `submitCommand` wraps the instruction with `buildAnchoredMessage` when anchored and sends it
  as a **normal chat message** (no new endpoint). The result lands as a reviewed `GEÄNDERT` draft — the
  existing user-reviewed flow, **no auto-apply**. Diff-sheet `onReanchor` wired to the same flow.

## Gate (375px real viewport, local stack, REAL free-key model)
Harness `.e2e-tmp/mobile1-m3.mjs` — Reader long-press on the `<button id="cta">` line, choose "ändern
lassen", type "mach diesen Button größer und grün", send. Captures the outgoing `/messages` request body.
- `actionSheetOpened: true` — long-press opened the Tier-2 sheet.
- `anchorChip: true`, `anchorChipText: "index.html · Zeile 7"` — command bar pre-anchored (screenshot
  `shots/m3-anchor-chip.png`).
- **Anchor payload captured:** `sentPromptHasAnchor: true`, `sentPromptHasLineNums: true`. The sent
  message = the instruction + `[Anker → index.html · Zeile 7] …` + lines 1–12 with line numbers
  (`sentPromptExcerpt` in the run log — the ±10 surrounding lines around the anchored line 7).
- **Targeted edit arrived (real model):** `changedCardArrived: true`, `diffTouchesAnchor: true`,
  `fileHasTargetedEdit: true`, `fileChangeState: "draft"`, `agentErrorText: null`. The model made a
  *surgical* edit at the anchored region — added `#cta { background-color: green; padding: 10px 20px;
  font-size: 18px; }` (bigger + green button) — surfaced as a review diff (`+12 −2`, **Verwerfen /
  Übernehmen**), NOT auto-applied. Screenshot `shots/m3-result.png`.

## Ledger (M7 — same commit)
`docs/GOBLIN_CONSUMPTION_LEDGER.md` new **M7** row: trigger, token formula (+~200 input tok = preamble
+ ±10 numbered lines, additive to M2 injection), billed to **user allowance**, knob = `SURROUNDING_LINES`
(=10) at `apps/web/lib/anchor-message.ts`, cost ≈ +$0.00004/anchored send, CFO A6/A19. M6 "Reserved"
updated (MOBILE-1 anchored line removed — now built as M7).

## Verification
- `npx tsc --noEmit` (apps/web): clean.
- Screenshots: `m3-action-sheet.png`, `m3-anchor-chip.png`, `m3-result.png`.
