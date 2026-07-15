# U1 — F-12/F-13/F-14 code-view affordances — evidence

## F-12 — "An Code senden" brand mechanic: visible, gold, aligned, reachable at file end
`apps/web/components/chat/CodeBlock.tsx` (the code card rendered in the standalone chat):
- The send-to-code affordance was a faint green `FolderInput` icon. It is now GOLD,
  consistent with the real gold CodeBlock affordance (`workspace/CodeBlock.tsx`,
  `rgba(212,167,55,…)` recipe):
  - Expanded block header: a gold **labeled** pill (`ArrowUpRight` + label), `data-testid`
    `cb-add-to-project`. Label hides under 480px via `.cb-stc-label` (globals.css) so it
    never crowds.
  - Collapsed card header: a compact gold icon (`StcActionIcon`) — same gold recipe, no
    label (tight row).
  - **File-end reachability**: for a long block (`lineCount > 24`) a matching gold pill is
    repeated at the bottom of the code body (`data-testid` `cb-add-to-project-end`), so
    after scrolling a long file the mechanic is still one tap away.
- Alignment: the header actions sit in an `inline-flex; align-items:center` row; the pill
  uses `line-height:1`.

## F-13 — "Goblin Swift" label vertically off-centre in the model selector
`apps/web/components/app-shell/model-switcher.tsx` (header switcher, the persistent one):
- Root cause: the trigger row mixed font sizes (13/11/9) and ended in a raw `▾` glyph whose
  asymmetric vertical metrics pulled the baseline, so "Goblin Swift" read off-centre.
- Fix: `line-height:1` on the button + each label span, and the `▾` glyph replaced with a
  baseline-neutral inline SVG chevron (`display:block`) — the same pattern the ChatInput
  pill + the Icon component already use for centred glyphs.

## F-14 — "…" overflow menu / git fields open off-screen in split-screen/narrow
`apps/web/components/code/SessionPane.tsx` + `SessionGitPill.tsx`:
- The bottom-bar "…" menu now has `maxHeight: min(70vh, calc(100dvh - 24px))` +
  `overflowY:auto`, so it can never overshoot the top of a short pane.
- Root cause of the "two fields at the top of the viewport": the git panel used
  `position: fixed; top:0`, but the code surface has `position:relative`/transformed
  ancestors (split-screen panes) which make a fixed child resolve to that ancestor, not the
  viewport — so `top:0` landed at the top of the (off-screen) pane. Fix: the scrim + panel
  are now rendered through `createPortal(document.body)`, so `position:fixed` is truly
  viewport-relative and the commit-message / repo-name fields are always reachable.

## Verification
- `tsc --noEmit` clean across all three files.
- **F-12 visual gate (live local render):** `evidence/fw5-shots/u1-f12-codeblock-720.png`
  and `-375.png`. A temporary `/demo-fw5codeblock` route rendered the REAL
  `chat/CodeBlock` with a mock send-to-code handler; screenshots confirm the gold labeled
  pill in the header AND a repeated gold pill at the END of a long (>24-line) block, with
  the header pill degrading to icon-only at 375px (label hidden). DOM assert from the same
  run: header affordances=2 (both blocks), file-end affordances=1 (long block only). The
  temp route was deleted after capture (not shipped).
- **F-13 / F-14 (screenshotBlocked: true):** the header model-switcher and the code-view
  "…"/git panel live inside the authenticated workspace, which can't be driven headless in
  this environment (no test-account backend). Both are structural fixes proven by the diff
  + `tsc`: F-13 is a line-height + SVG-chevron alignment change; F-14 is a `createPortal`
  + max-height change. Founder eye confirms in the re-walk.
