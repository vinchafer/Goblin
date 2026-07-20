# U4 — Admin-Konsole Audit (Founder-Walk-1, 4a)

**Branch `claude/founder-walk-1-srdrp9`. Code-level audit of every `/admin` route** (purpose · data
source · 375px state · render bugs). Assessed from source — see Honest-Limitations for what only a
running admin session + founder device can confirm. Findings numbered; the shell-level cause and the
per-page fixes applied in 4b/4c are cross-referenced.

## Shell-level finding (the cause behind most "cramped/broken" verdicts)
**F-S1 — the admin shell was a desktop layout shrunk onto a phone.** `components/admin/admin-shell.tsx`
rendered a FIXED 220px sidebar inside a horizontal flex on a `100dvh` row. At 375px the nav ate ~59%
of the width, leaving a ~155px content column — the "Desktop-IDE auf Handy geschrumpft" anti-pattern.
Every table verdict below was compounded by this. **Also: the old `👺` goblin-face logo sat in the
sidebar header, and the nav linked only 9 of the 11 routes (Costs + Rankings were unreachable).**
→ Fixed in 4b (mobile-first shell, wordmark replaces `👺`, all 11 routes in nav).

## Per-route audit

| # | Route | Purpose | Data source | 375px | Notable render risk |
|---|---|---|---|---|---|
| 1 | `/admin` (index) | Redirects → `/admin/users` | none | n/a | none |
| 2 | `/admin/health` | Ops health: version sync, DB counts, trial funnel, env presence, failed runs | Supabase server client + `GET {API}/version` + `process.env` | **USABLE** (cards, no tables) | Supabase queries in `Promise.all` unguarded → a query rejection throws the whole SSR page |
| 3 | `/admin/users` | List/search/paginate users, stat cards, suspend/plan/delete | `/api/admin` proxy: `GET /users`, `GET /stats`, `PATCH/DELETE /users/:id` | **BROKEN** — stat grid `repeat(4,1fr)` fixed; action buttons ~24px (<44px); table scrollable | `$${estimated_mrr}` unguarded → `$undefined`/`$NaN`; server-search + client re-filter makes "Next" (`filteredUsers.length<20`) unreliable; mutations never check `res.ok` |
| 4 | `/admin/models` | Model catalog CRUD + availability toggle | `/api/admin` proxy: `GET/POST/PATCH/DELETE /models` | **BROKEN** — 6-col table, NO overflow wrapper → page overflows | optimistic toggle diverges from server on failure; no try/catch → a throw sticks on "Loading…"; buttons <44px |
| 5 | `/admin/catalog` | Catalog ops (DE): sync status, manual refresh/test-digest, provider health, sync log | `/api/admin` proxy: `GET /catalog`, `POST catalog/refresh`, `POST digest/send` | **CRAMPED** — sync-log 5-col table no wrapper; stats row no flex-wrap | `(errorRate*100).toFixed(0)` → `NaN%` if null. Best error handling of the set (try/finally + toast) |
| 6 | `/admin/telemetry` | Founder read-only cost/usage telemetry | `/api/admin` proxy: `GET /telemetry` | **USABLE** — table wrapped in `overflowX:auto` | `.toFixed(4)` unguarded → **throws at render** if a field is missing; `calibrated` fetched but the "not yet calibrated" badge is hardcoded (dead data) |
| 7 | `/admin/insight` | Founder funnel/behaviour view (DE): signup→live funnel, journeys, pulse, safety | `/api/admin` proxy: `GET /insight` | **USABLE** — explicitly mobile-first, ellipsis truncation, no tables | none material — best-in-class error branches (403/401/500) + guarded math. Reference for the others |
| 8 | `/admin/promo` | Promo-code console: batch-generate, group, edit labels, copy | `/api/admin/promo` GET, `PATCH /:code`, `POST /batch` | **USABLE** — mobile-first, flex-wrap, ≥40px controls | `saveLabel` always flashes success (never checks `res.ok`); `load` no error surface |
| 9 | `/admin/builds` | Build-job ops: filter, paginate, log modal, cancel | `/api/admin/builds`, `POST /:id/cancel` | **BROKEN** — 6-col table in `overflow:hidden` (not `auto`) → clipped, no scroll; filter row overflows | **Crash:** `Array.isArray(d)?d:d.builds??d` can set `builds` to a non-array → `builds.map` throws; `progress_pct` raw → `undefined%`; mutations unchecked |
| 10 | `/admin/status` | Status-incident manager: create/edit/delete, active vs history | `/api/admin/incidents` GET/POST/PATCH/DELETE | **USABLE / mildly CRAMPED** — card-based; header title can crowd "+ New"; action buttons ~28px | save/delete swallow errors (always optimistic) |
| 11 | `/admin/rankings` | Read-only ranking-source ingestion health | **public** `GET {API}/api/rankings/sources` (no admin auth) | **BROKEN** — 4-col table no wrapper; a long non-breaking `curl` `<code>` string overflows the content box | `last_record_count` raw → `undefined`; no loading spinner (empty tbody before data) |
| 12 | `/admin/costs` | SSR cost dashboard: spend/completions/avg cards + per-provider table (30d) | **SSR** `GET {API}/api/admin/cost-summary` with `x-admin-key` | **CRAMPED** — 4-col table no wrapper; `padding:32` eats 64px | robust env/status/network error handling; `.toFixed` assumes non-null `cost_usd` (throws if null) |

## Cross-cutting
- **Mobile-broken:** users, models, builds, rankings. **Cramped:** catalog (sync-log), costs. **Good:**
  health, telemetry, insight, promo, status.
- **Render-throw risk from unguarded numbers:** telemetry (`.toFixed`), catalog (`errorRate`), costs
  (`.toFixed`), users (`$NaN` MRR), builds (`undefined%` + the non-array crash).
- **Touch targets <44px:** users + models + status action buttons.
- **Weakest error handling:** users, models (no try/catch, optimistic writes). **Strongest:** insight.

## Fixes applied this wave (4b + 4c) vs. deferred findings
**Applied (scope-bounded, type-checked):**
- 4b — mobile-first shell (top-bar + horizontal-scroll tabs on phone, sidebar on desktop, safe-area
  insets, ≥44px targets), `👺` → wordmark, Costs + Rankings added to nav.
- 4c — see `U4_FIXES.md`: wide tables wrapped in horizontal scroll (models, builds, rankings, costs,
  catalog sync-log); the builds non-array crash guarded; unguarded number renders guarded
  (`telemetry`, `costs`, `catalog`, `users` MRR); users stat grid made responsive; builds
  `overflow:hidden` → `auto`.

**Deferred as findings (NOT fixed — need live verification / are behaviour, not render, or risk
regressions I can't visually confirm):**
- Mutation-response checks + honest error surfaces on users/models/status/promo (behaviour change,
  best done with a live admin session).
- The users pagination double-filter unreliability (needs live data to confirm the fix).
- The models optimistic-toggle divergence (needs live PATCH to verify rollback UX).
- The telemetry `calibrated` dead-data badge (needs the real telemetry payload to wire correctly).
- health SSR `Promise.all` guard (needs a way to force a query failure to verify the fallback).

## Honest-Limitations
- **No running admin session** in this environment (no admin auth, no prod data, no browser), so every
  375px verdict is derived from the layout code, and **no per-page before/after screenshots were
  produced.** The render-bug fixes are mechanical and type-checked but visually **unconfirmed** — the
  founder's on-device pass over `/admin/insight`, `/admin/promo`, `/admin/costs` (the three
  launch-critical ones) is the confirmation.
- Data-render-truthfulness ("does its data render truthfully") can only be judged against a live API
  response; the audit reports the *shape* the code expects and where it would break on partial data.
