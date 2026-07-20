# U4c — Admin render-bug + mobile fixes (Founder-Walk-1)

Scope-bounded fixes for the render bugs and broken-at-375px tables the audit
(`ADMIN_AUDIT.md`) found. Render bugs + dead controls + overflow, per the 4c rule —
**no new features**. All type-checked (`tsc --noEmit` clean); no behaviour/API changes.

| # | Route | Fix | Why |
|---|---|---|---|
| 1 | builds | `Array.isArray(d)?d:d.builds??d` → coerce to a real array (`[]` on unexpected shape) | a non-array payload used to reach `builds.map` and **crash** the page (blank) |
| 2 | builds | table wrapper `overflow:hidden` → `overflowX:auto` + `min-width:620` on the table | the 6-col table was CLIPPED at 375px with no way to scroll to Actions |
| 3 | builds | `{b.progress_pct}%` → `{b.progress_pct ?? 0}%` (bar width + label) | rendered `undefined%` when the API omitted progress |
| 4 | models | table wrapper `overflow:hidden` → `overflowX:auto` + `min-width:620` | 6-col table had NO wrapper → overflowed the whole page on a phone |
| 5 | costs | provider table wrapped in `overflowX:auto` (`min-width:460`) | 4-col table had no wrapper (CRAMPED at 375px) |
| 6 | costs | `total_cost_usd`/`cost_usd`/`tokens` guarded with `?? 0` before `.toFixed`/`.toLocaleString` | a null field threw at render and blanked the SSR page |
| 7 | rankings | table wrapped in `overflowX:auto` (`min-width:460`); `last_record_count ?? '—'` | no wrapper (BROKEN); raw `undefined` cell |
| 8 | rankings | the long `curl` `<code>` set to `display:block; white-space:pre-wrap; word-break:break-all; overflow-x:auto` | the non-breaking curl string overflowed the content box |
| 9 | users | stat grid `repeat(4,1fr)` → `repeat(auto-fit, minmax(140px,1fr))`; all stat values + MRR guarded `?? 0` | fixed 4-col grid overflowed 375px; `$${estimated_mrr}` rendered `$undefined`/`$NaN` |
| 10 | telemetry | `estimatedCostUsd.toFixed(4)` → `(… ?? 0).toFixed(4)` | unguarded `.toFixed` threw at render on a missing field |
| 11 | catalog | sync-log table wrapped in `overflowX:auto` (`min-width:520`); `(errorRate ?? 0)*100` | no wrapper (CRAMPED); `NaN%` on null errorRate |

## Deferred (NOT done — behaviour, not render; need a live admin session to verify)
- Mutation-response checks + honest error surfaces (users/models/status/promo) — these change UX on
  failure and should be verified against a live API, out of scope for a render-only pass.
- users pagination double-filter unreliability; models optimistic-toggle divergence; telemetry
  `calibrated` dead-data badge; health SSR `Promise.all` guard.

## Honest-Limitations
Every fix is mechanical and type-checked but **visually unconfirmed** — there is no running admin
session in this environment. The founder's on-device pass over the three launch-critical pages
(`/admin/insight`, `/admin/promo`, `/admin/costs`) is the confirmation. No unit tests exist for these
inline-styled pages; the guarantee here is `tsc` + the full web suite staying green (97/97), not a
render assertion.
