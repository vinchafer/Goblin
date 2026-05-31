# Typography Audit — Phase 1 (2026-05-31, Sprint 5)

Founder complaint (verbatim): *"irgendwie stimmt etwas mit schriftgrössen und skalierungen
nicht, es wirkt alles eher gross - übergross. wichtig dass schriftgrössen über die ganze code
basis sauber überprüft werden und an industriestandards angeglichen."*

This is the **review** Vincent asked for, with measured evidence — not a blind mass-rewrite.

## Inventory
- `grep fontSize` across `apps/web` (tsx/ts/css): **995 occurrences**, of which **883 are
  hardcoded px literals** (raw inventory: `sprint-5/typography/inline-fontsize-inventory.txt`).
- Far above the brief's ~181–247 estimate.

### Distribution of hardcoded values (top)
| px | count | px | count | px | count |
|---|---|---|---|---|---|
| 13 | 225 | 11 | 97 | 16 | 33 |
| 12 | 168 | 15 | 45 | 18 | 28 |
| 14 | 105 | 10 | 38 | ≥20 | 78 |

**The bulk (≈528) are small 10–13px caption/label sizes.** Only 78 literals are ≥20px, and the
≥28px ones are almost all **intentional display values** (price amounts, error codes like the 64px
on `error.tsx`, 48–52px geo-pricing/upgrade numbers, avatar initials) — not body/heading text.

## Verdict: the "übergross" perception does NOT trace to oversized font tokens
Evidence (screenshots in `sprint-5/typography/` + `audit-screenshots/`):
- **Dashboard (Screen 03, the model), desktop 1440:** calm, well-proportioned. "Deine Projekte"
  section title (--t-h2, 32px desktop) is industry-normal. Composer, cards, eyebrows all sit at
  standard sizes. No oversizing.
- **Settings sub-page, mobile 390 (Vincent's flagged area):** page title `h1` = **22px** (verified
  in source `notifications/page.tsx:111`), section `h2` = 17px, body = 13px, captions = 12px.
  *(The mobile screenshot looks large at first glance — that is the deviceScaleFactor:2 capture
  doubling pixels in the PNG, not the CSS. Re-measured: 22px is correct.)*
- Measured sizes vs industry: body 13–16px (Linear 14, Vercel 14, Claude 15) · captions 12px
  (all peers 12) · in-app page titles 22px (Claude.ai 24, Linear 24–32) · dashboard section 32px
  (Vercel 28–36). **Goblin is squarely inside the industry band.**

What *can* read as "big": generous **row/section spacing** in settings and **700-weight** headings
— these are spacing/weight choices, not font-size. They are out of scope for a typography-token
pass and are a separate density decision for the founder.

## Why a 90% blanket replacement was NOT done (per the 9/10 no-blind-fix bar)
The gate's "replace 90% of literals with tokens" assumed ~247 oversized literals. Reality: 883,
**mostly small (10–13px) values that map to NO clean token** — the scale jumps 12 (caption) →
14 (small) → 16 (body). Replacing a hardcoded `13px` with `--t-small` (14) makes text **bigger**;
with `--t-caption` (12) makes it smaller. Either is a visible regression across hundreds of call
sites, and *bigger* is the opposite of the complaint. Blind-mapping 883 literals would degrade,
not improve, the UI. The locked --t-* scale itself is correct as specified (brief §5).

## What WAS done — regression-safe tokenization (zero visual change)
Replaced only the literals whose token value is **identical at every breakpoint**, so rendered
size is unchanged — true "Angleichung an die Skala" with no risk:
- `fontSize: 16` → `var(--t-body-fs)` (16 mobile+desktop)
- `fontSize: 14` → `var(--t-small-fs)` (14 mobile+desktop)
- `fontSize: 12` → `var(--t-caption-fs)` (12 mobile+desktop)

Script: `audit/tokenize-fontsize.mjs`. Result: **306 edits across 85 files** (list:
`sprint-5/typography/tokenized-files.txt`). Half-pixel and breakpoint-variant values left intact.
typecheck PASS. Dashboard re-screenshot: pixel-identical (expected — same computed sizes).

## Deferred (documented, low priority — safe but no visual benefit)
- 11px → `--t-eyebrow-fs` and 20/24px → `--t-h3/h2` are **breakpoint-variant** (e.g. eyebrow is
  11 mobile / 12 desktop), so tokenizing them *changes* sizes; do only with per-site intent review.
- 13px / 15px / 10px / half-px values have no canonical token; they are ad-hoc. Recommend the
  founder decide whether to (a) add 13px/15px steps to the scale, or (b) round each to the nearest
  existing token in a deliberate per-component pass. Not auto-fixable without a size change.

## Recommendation to founder
The type **sizes** are already industry-aligned; nothing is literally oversized. If a specific
screen still *feels* big, the lever is **spacing density and heading weight**, not the font scale —
point at the exact screen and it can be tuned. The token-alignment cleanup (306 sites) is shipped.

## Gate
- Inventory + per-area verdict ✓
- Regression-safe tokenization applied + typecheck PASS ✓
- Before/after = pixel-identical by design (zero-visual-change mapping) ✓
- 90% blanket replacement **intentionally not done** — documented with evidence as a net regression.
