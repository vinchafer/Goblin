# Token Contrast Resolution — Phase 6 / B11 (2026-05-31, Sprint 5)

Founder approved Sprint-4's deferred recommendation to darken `--ink-3` (~4.04:1 on sand, fails
WCAG AA). Applied + verified with axe-core.

## Changes
| Token | File | Was | Now | Rationale |
|---|---|---|---|---|
| `--ink-3` | design-tokens.css:62 | `#74694F` | `#5F5640` | 4.04:1 → **5.4:1 on sand**, 6.0:1 on bone — clears AA |
| `--color-ink-3` | globals.css:59 | `#74694F` | `#5F5640` | parallel Tailwind token synced (`.text-ink-3` utilities) |
| `--text-faint` | design-tokens.css:238 | `var(--ink-disabled)` (#B8A988) | `#665C42` | decoupled from disabled; empty-state copy now **6.6:1 on white / 5.6:1 on bone**. `--ink-disabled` stays #B8A988 for genuinely-disabled UI |

`--ink-3` resolves through `--meta`/`--text-meta` too, so this single change fixes ~498 call sites.
Dark-theme `--ink-3` (#968768, light-on-dark) left unchanged — its findings were light-mode only.

## Verification — axe-core (`@axe-core/playwright`, wcag2a/2aa), 12 routes
Script: `scripts/sprint-4/a11y-audit.mjs sprint5after`. Results: `sprint-5/a11y-after/*.json`.

**Serious `color-contrast` cleared on every authed surface that was failing on `--ink-3`:**
| Route | Sprint-4 after | Sprint-5 after | Serious delta |
|---|---|---|---|
| /dashboard/chat | 2 (1 serious) | 1 (0 serious) | ✅ −1 serious |
| /dashboard/code | 3 (1 serious) | 2 (0 serious) | ✅ −1 serious |
| /dashboard/preview | 3 (1 serious) | 2 (0 serious) | ✅ −1 serious |
| /dashboard/new | 1 (1 serious) | 0 | ✅ −1 serious |

No new contrast violations introduced (counts only dropped). typecheck PASS.

## Remaining serious (pre-existing, separate from `--ink-3` — documented for founder)
These were already DEFERRED in A11Y_FINDINGS and are **not** `--ink-3` cases:
- **/ , /login, /register** — landing decorative + usage-bar `rgba(244,236,216,.5)` on green (low-
  opacity light-on-dark; intentional muted marketing/caption).
- **/dashboard** — composer `textarea` placeholder + a `.gobl-hero` caption on the **dark** hero
  surface (light-on-dark at low contrast). Not an ink-3-on-light issue; fixing means raising the
  on-dark caption opacity — a separate dark-surface decision.
- **/pricing** — gold wordmark `#D4A737` on `--brand-green`, flagged at the normal-text threshold
  (18px/700). **Not changed:** gold is a LOCKED v1.1 anchor (non-negotiable §e). Per A11Y_FINDINGS
  the fix is either bump the wordmark to ≥18.66px (counts as large text → 3:1 threshold) or shift
  fill one ramp step — both are founder calls on a locked anchor. Recommend bumping the wordmark
  font-size to 18.66px (cheapest, no anchor change).

## Gate
- `--ink-3` ≥ 4.5:1 verified (5.4:1 on sand) ✅
- No new violations introduced ✅
- Authed-app serious contrast findings resolved ✅
- typecheck PASS ✅
