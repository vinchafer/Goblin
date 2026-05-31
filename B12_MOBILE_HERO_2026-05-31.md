# B12 — Mobile Hero Whitespace ≤390px (2026-05-31, Sprint 4 Phase 3)

The audit flagged the hero collapsing to "workshop**for**" (lost word-space) at ≤390px. Sprint 3's
static review found clean markup + clean CSS and could not produce a confident fix without live
inspection. This pass inspects live via CDP at 320 / 360 / 375 / 390 / 414 px.

Script: `scripts/sprint-4/hero-mobile-probe.mjs`. Screenshots: `sprint-4/b12-hero/before-*.png`.

## Result: the reported defect does NOT reproduce
At every tested width the hero renders correctly:

| Width | Horizontal scroll | H1 fits viewport | Lead overflow | Word-spacing |
|---|---|---|---|---|
| 320 | none | right 284/320 | none | normal |
| 360 | none | right 324/360 | none | normal |
| 375 | none | right 339/375 | none | normal |
| 390 | none | right 354/390 | none | normal |
| 414 | none | right 378/414 | none | normal |

- `.hero-lead` "The cloud workshop **for** builders who don't wait for a laptop…" shows a normal
  space between "workshop" and "for" at all widths (computed `word-spacing: normal`, no negative
  tracking; `text-wrap: pretty`).
- `.hero-h1` clamps to its 52px floor on mobile, wraps cleanly to
  "Tell it what / you want. / *It ships.*", and its right edge stays inside the viewport (no
  overflow, no clipping).
- The Instrument Serif italic accent ("It ships.") renders with full descenders — line-height
  1.16 (≥1.10) and the h1's `padding-bottom: 0.32em` (≥0.12em) satisfy design-system §A3.3.
- No horizontal scroll at any width.

## Conclusion
The "workshopfor" collapse appears to predate the landing's refactor to v1.1 brand tokens (the
hero markup/CSS now uses normal spacing + `text-wrap: pretty`). It is **not present** in the
current code at 320/360/375/390/414. **No fix applied** — changing clean, correct CSS under the
9/10 "don't blind-fix" bar would risk regression for no benefit. Documented with before-state
screenshots as evidence at all five widths.
