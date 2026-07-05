# MOBILE-1 — MERGE REPORT

## Merge
- **Merge SHA:** `84c69d79e4b126fe0a2c556a327918f55ea913fb` (`84c69d7`)
- **Merged:** `mobile-1-2026-07-07` → `master`, `--no-ff`, pushed `8a682ed..84c69d7`.
- **Timestamp (prod build):** 2026-07-05T19:18:35Z (api buildTime).
- Rebase: no-op (master unmoved since branch; merge-base = master HEAD). No conflicts.

## Units (all committed, all gates green at 375px)
| Unit | Commit | Gate |
|---|---|---|
| I0 instrument | `067343b` | 13 unit tests + apps/api 354/354; migrations 0077/0078 authored |
| M1 command bar + status strip | `d7cd782` | command bar promoted to top + mic; layoutJump 0 |
| M2 file cards + Reader + Diff sheet | `b6c9721` | GEÄNDERT +n −m float top → Diff sheet; Reader no keyboard; filter highlights |
| M3 point & instruct (Tier 2) | `6e03ed3` | long-press → anchor chip → **real model targeted edit** at the region; ledger M7 |
| M4 Live stellen | `f9a9eb1` | inline truth-gated n/6 stream; **real Vercel deploy**; ⋯ menu |
| M5 Tier 3 editor | `1dcd156` | compact search overlay (not desktop panel); no keyboard grab on open |
| M6 dark mode + JIT | `e59be6b` | prefers-color-scheme default; JIT github after 1st publish, dismiss persists |
| W10 + deploy fix | `4277888` | acceptance re-run + self-documenting deploy errors |

## W10 acceptance
From the one canonical message the model built the settings page (4 files) on the new surface; reached
**verified Live in 2 interactions** (Live stellen + confirm) vs **baseline 7**, target ≤5. 3 with a
review-first diff view. See `W10_RERUN.md` (incl. the 429 root-cause of the first deploy attempt).

## Final checks
- apps/api suite: **37 files / 354 tests passed.**
- tsc: clean (apps/web + apps/api).
- Desktop regression (1440px): editor is the front door (two-column split), desktop thread composer
  present, **no mobile chrome leaking** (command bar / file cards / status strip all absent).

## Prod smoke (post-push)
- **api `/api/version` = `84c69d79e4b…` (merge SHA), `apiReady: true`, `/health` ok.**
- Web reachable: `/` 200, `/login` 200, `/dashboard` 307→/login.
- Unauthenticated endpoints 401: `GET /api/code-sessions`, `POST /api/code-sessions/:id/deploy`,
  `POST /api/transcribe` — all **401**.
- Pre-migration safety: platform_events insert silent-fails and completion_costs.project_id write retries
  without the column, so prod is safe before the founder applies 0077/0078.

## Migration flags for the founder (apply in Supabase SQL Editor — NOT auto-applied)
- `supabase/migrations/0077_completion_costs_project_id.sql` — `completion_costs.project_id` + view refresh
  (enables A19 project-vs-standalone split).
- `supabase/migrations/0078_platform_events.sql` — the platform-events table (enables A20 platform COGS +
  B2 context-retry measurement from the DB). Until applied, I0 telemetry writes are inert no-ops (by design).

## Honest limitations
1. **Authed mobile-surface prod smoke = founder acceptance.** The 401/version/web-reachable checks passed,
   but a full authed drive of the mobile Code surface on prod needs a prod session (prod test-auth is off).
   The real-iPhone pass is founder acceptance, as the spec states.
2. **M6 dashboard-readability defect** left unfixed — under-specified in the spec; flagged for the founder to
   point at the specific element, then a one-token change (see M6_REPORT.md). Dark-mode default + JIT shipped.
3. **M2 badge base map is async** — a card can flash NEU/plain for a beat before flipping to GEÄNDERT while
   the project-files base loads; cosmetic. A real >10-file project could brush strictRateLimit (10/min) on
   load and mislabel some cards NEU; a bounded retry-on-429 / batch content endpoint would harden it (flagged).
4. **Telemetry inert until migrations applied** (by design — code is tolerant).
5. `.e2e-tmp/mobile1-*.mjs` harnesses are committed as gate evidence (test scaffolding, not imported by the app).
