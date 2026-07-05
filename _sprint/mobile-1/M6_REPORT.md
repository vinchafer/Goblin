# M6 — Dark mode + JIT cards — REPORT

**Branch:** `mobile-1-2026-07-07` · **2026-07-07** · Status: **DONE, gate green** (one honest flag — see Notes).

Spec §5 (JIT) + §5 (Dark mode). Design-system tokens only.

## What shipped
- **Dark mode = `prefers-color-scheme` default.** `useEditorTheme` now: if the user has made a manual
  choice (moon/sun, Settings) it is persisted and wins; **otherwise the OS preference drives the surface**
  and stays live (reacts to OS changes). SSR renders light (server can't read the OS), client corrects on
  mount. The editor surface already maps every colour to design-system tokens (`code-editor.tsx` LIGHT/DARK
  palettes, resolved from `GOBLIN_DESIGN_SYSTEM.md`), so dark is a token switch, no ad-hoc colours.
- **JIT cards (spec §5):** new **`lib/jit-cards.ts`** (per-project publish count + 30-day dismissal in
  localStorage) + **`JitCard.tsx`** (GitHub / Vercel card with "Einrichten / Später"). Wired into the
  StatusStrip `jit` slot: after the **first truth-gated successful publish** → the GitHub card
  ("Dein Projekt ist live. Willst du es zusätzlich auf GitHub sichern?"); the Vercel-custom-domain card is
  authored behind the same component and enabled after the **third** publish. "Einrichten" surfaces the
  GitHub affordance (the ⋯ menu) and stops nagging; "Später" dismisses for 30 days, per project.

## Gate (375px + desktop, local stack, real deploy)
Harness `.e2e-tmp/mobile1-m6.mjs` (dark screenshots) + `.e2e-tmp/mobile1-m6b.mjs` (dark verify + JIT cycle):
- **Dark mode:** `darkTheme: "dark"` — with the OS in dark (`colorScheme: 'dark'`) the code surface renders
  dark by default (`.gb-codetab[data-editor-theme="dark"]`). Screenshots: `m6-dark-{dashboard,code,chat}-
  {mobile,desktop}.png` and `m6-jit-card.png` (dark surface + JIT card, gold accents readable on warm-dark).
- **JIT:** `jitBeforePublish: 0` → `jitAfterPublish: 1` (`jitKind: "github"`) — appears **exactly** after the
  first truth-gated successful publish (real Vercel deploy). `jitAfterDismiss: 0` ("Später") →
  `jitAfterReload: 0` — the dismissal **persists across reload** (30-day, per project).

## Notes / honest flag
- The spec asks to also "fix the known dashboard-readability defect as part of the same token pass." That
  defect is not specified in `MOBILE1_SPEC.md` and I could not identify a single concrete offending token
  without guessing (which risks a regression). The dark-mode default + JIT are complete; the dashboard
  readability fix is **flagged for the founder** to point at the specific screen/element, then it's a
  one-token change. Dark-mode dashboard screenshots are attached for review (`m6-dark-dashboard-*.png`).

## Verification
- `npx tsc --noEmit` (apps/web): clean.
