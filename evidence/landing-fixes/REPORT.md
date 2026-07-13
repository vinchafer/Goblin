# Landing-page fixes — merge report (stream: `claude/landing-page-fixes-7tqyrh`)

**Date:** 2026-07-13 · **Base:** `origin/master` @ `0ef0b0a` (PR #28) · **Model:** Opus
**Scope:** landing/marketing components only (parallel-safe with app-repo Fix-Wave-1).

## Units

| Unit | Finding | Status | Evidence |
|------|---------|--------|----------|
| **L1 / F-01** | Stray dark bar above the logo at scroll-top | ✅ Fixed | `L1/` |
| **L2 / F-02** | §03 shows a stale in-app depiction ("Injected") | ✅ Fixed (accuracy) | `L2/` |
| **L3 / F-36** | "Preview" phantom sweep | ↪ Left to Fix-Wave-1 U7 (coordination) | see below |

### L1 — F-01 · Stray bar above the logo at scroll-top  (commit `b4b72d3`)
**Diagnosis (diagnosis-first):** not a sticky-header scroll-class artifact (`.lp-nav`
is a plain `position: fixed` server component with no scroll state). Root cause: the
visually-hidden skip link (`a.skip-link`) was hidden with a fixed `top: -40px`, but the
element renders ~44px tall on a 375px mobile viewport (mobile `text-size-adjust` inflates
the font vs desktop), leaving a ~4px dark-green sliver (`rgb(15,43,30)`) protruding below
the top edge. Its `z-index: 200` placed it above the nav (`z-index: 100`), so it showed at
scroll-top. Mobile-manifesting; desktop's shorter render (~36px) stayed hidden — which is
why it surfaced on the founder's mobile production walk.
**Fix:** height-independent hide — `top: 0` + `transform: translateY(-100%)`; drops to
`translateY(8px)` on `:focus`. File: `apps/web/styles/landing.css`.
**Gate (rendered, local `next dev`):** before/after scroll-top at 375px + desktop, scrolled
header, skip-link focus. DOM probe: before `elementFromPoint(12,2)` = `a.skip-link`
(dark green) → after = `nav.lp-nav`. Keyboard focus test: skip link at top:8, visible
(a11y preserved).

### L2 — F-02 · §03 stale in-app depiction  (commit `816b66b`)
**State-first correction:** §03 uses **no image files** — `SendToCode.tsx` is a hand-built
CSS/HTML mock. There were no "stale images" to swap. The mock's core claims are **current**:
`Goblin Swift` (live model), `Send to Code` (real feature), chat→editor flow (real).
**The one no-longer-accurate detail:** the editor pane asserted `INJECTED` — a state the
product no longer has. Send to Code now produces a reviewable **draft** (`CodeEmptyState.tsx`:
"lands right here as a draft you can review"; `AgentRunView`/`DiffSheet`/`FileCardList`
draft states `Entwurf`/`NEU`/`GEÄNDERT`). Asserting `INJECTED` is exactly the stale label
and trips the honesty invariant (never claim a product state that isn't real).
**Fix:** badge `Injected` → `Draft` (renders gold `DRAFT`); comment → `// draft from Send
to Code — review before you ship`. No image assets added; no other mock content changed.
**Gate (rendered):** before/after §03 at desktop + 375px; mobile comment wraps cleanly, no
overflow.

### L3 — F-36 · "Preview" coordination (no code change)
State-first: Fix-Wave-1 U7 has **not** merged to master (HEAD is PR #28). Per the
coordination note, F-36 is owned by U7 to keep the grep/sweep in one place — so it is
**left to U7**. Complete landing-surface sweep for reference: the only "Preview" on the
public landing is `components/landing/sections/IslandFlow.tsx:87` — step 08 "Preview · Tap
to see your live site", which is **descriptive flow copy, not a clickable phantom
affordance** (honest per the phantom-affordance rule). No other "Preview" occurs in
`components/landing/` or `app/page.tsx`. If U7's sweep decides this copy should change, it
owns that edit; this stream did not touch it to avoid duplication.

## Gates — verification
- **Typecheck:** `@goblin/shared` ✅, `@goblin/web` ✅ (both `tsc --noEmit`, exit 0).
- **Build:** `@goblin/web` ✅ — "Compiled successfully", 41/41 static pages, exit 0 (CI env).
- **Rendered visual gates:** every visual unit has before/after local-build screenshots
  attached (`L1/`, `L2/`). Full-page regression renders (both fixes live together, no
  layout breaks): `regression-mobile-fullpage.png`, `regression-desktop-fullpage.png`.
- **CI job-log:** to be confirmed green on the pushed branch before any merge (see Founder
  actions) — this report does not claim CI green from local runs alone.

## Self-review checklist
1. Evidence audit — each artifact re-opened; shows what the report claims. ✅
2. Diffstat vs scope — only `landing.css` (L1) + `SendToCode.tsx` (L2), both landing-only;
   no consumption paths touched. ✅
3. Regression — skip-link focus still works; CSS scoped to `.landing-root`; non-landing
   paths untouched; build green. ✅
4. Honesty sweep — new strings (`Draft`, draft comment) verified against real product; no
   unverified claims, invented times, English-in-DE leaks, self-labels, or future-promises. ✅
5. Ledger — no token/API/cost change (CSS + marketing copy only); no ledger line needed. ✅
6. Report completeness — SHAs, evidence refs, Honest-Limitations, Founder-actions below. ✅
7. Skeptic question — a skeptic with only this evidence reaches the same verdict (DOM probe
   + focus test for L1; before/after + source citations for L2). ✅

## Honest limitations (mandatory)
- **No production/authenticated browser this session.** All rendering is the **local**
  `next dev` build. The real chat→draft flow (auth + live backend + AI) was **not** driven;
  L2 accuracy is grounded in the current source (`CodeEmptyState`, `AgentRunView`,
  `DiffSheet`, `CodeBlock`), not in a captured live screenshot.
- **§03 remains a stylized illustration, not a real screenshot.** If literal product shots
  are preferred, the founder must supply them (see Founder actions) — I did not fabricate one.
- **CI not yet observed green.** Local typecheck + build are green; the branch CI run must be
  confirmed on GitHub before merge. This report does not assert CI green from local alone.
- **The "stray bar" was reproduced at 375px only.** On desktop the skip link stayed hidden;
  the fix is height-independent so it is safe on both, but the *bug* was mobile-manifesting.
- **Not merged.** This stream did not merge to master (see Founder actions / gate below).
- **DE label nuance:** the in-app Send-to-Code button reads German "An Code senden"; the
  English marketing label "Send to Code" is the confirmed English feature name
  (`CodeEmptyState.tsx`), correct for the marketing surface.

## Founder actions
1. **Eyeball the Vercel preview at 375px** (the unit's own founder gate): scroll-top +
   scrolled show no stray bar; §03 shows current `DRAFT` depiction; no "Preview" leak.
2. **Grant the conditional merge** only after (1) and after the branch **CI run is green**.
   This stream stopped at push and did **not** merge (master push/merge needs explicit
   founder authorization; the merge is gated on your visual eyeball, which cannot be done
   for you).
3. **§03 screenshots (optional):** if you want real captured app screenshots instead of the
   illustration, supply two images (chat panel + code/draft tab) and I will wire optional
   `<img>` slots into §03 with the mock as graceful fallback.
4. **F-36 / "Preview":** owned by Fix-Wave-1 U7 — no action here; noted for the U7 sweep
   that the only landing occurrence is `IslandFlow.tsx:87` (descriptive, not a phantom).
