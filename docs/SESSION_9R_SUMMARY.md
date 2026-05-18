# Session 9R Summary — Model Intelligence Layer

**Date:** 2026-05-15 / 2026-05-16
**Status:** Complete
**Replaces:** 9B eval phases (9B-4 through 9B-7) — Goblin's own substring-scored evals
**Strategy:** Aggregate 5 public benchmark sources instead of running our own evals

## Phases done
- 9R-0 Foundation: migration `0040_model_rankings.sql`, shared types, normalize, canonicalize, cron hook
- 9R-1 OpenRouter adapter (catalog + live pricing) + canonicalize unit tests
- 9R-2 Aider Polyglot adapter (coding benchmark, YAML from GitHub)
- 9R-3 LiveBench adapter (multi-dimensional, contamination-free)
- 9R-4 HuggingFace Open LLM Leaderboard v2 adapter (academic, OS-only)
- 9R-5 SWE-Bench Verified adapter (real-world software engineering)
- 9R-6 Aggregator + composite ranking per task type
- 9R-7 Public `/api/rankings` + `/models` + `/models/[id]` + `/admin/rankings`
- 9R-8 ModelPicker integration with "EMPFOHLEN" badge
- 9R-9 Cleanup: 9B eval code removed (lib/eval, internal-eval route, admin evals endpoints, admin/evals page, run-eval script, eval:run package script, e2e 35-admin-evals)

## DB Migration
- `0040_model_rankings.sql` — `model_sources`, `ranked_models`, `model_rankings`, `model_ranking_history`, `model_composite_rankings`
- **Note:** Table renamed `models` → `ranked_models` to avoid conflict with existing `models` table from migration 0009/0019.

## New endpoints
- `GET  /api/rankings?task=<type>&limit=N` — composite ranked list (public)
- `GET  /api/rankings/models` — flat model registry (public)
- `GET  /api/rankings/models/:id` — per-source breakdown + history (public)
- `GET  /api/rankings/sources` — source status (public, no secrets)
- `POST /api/admin/rankings/refresh` — manual aggregator trigger (admin, `x-admin-key`)

## New frontend pages
- `/models` — ranked list with task pills (coding, reasoning, speed, cost, general)
- `/models/[id]` — detail with composite, per-source, history
- `/admin/rankings` — source health table

## ModelPicker integration
- `apps/web/components/app-shell/model-switcher.tsx` — fuzzy-matches existing models against top-3 recommended for "coding" and shows `EMPFOHLEN` chip. Fails silent if API unavailable.

## E2E tests
- `tests/e2e/36-rankings.spec.ts` — 4 API smoke tests + 1 page-render test

## Cron
- `apps/api/src/lib/cron.ts` — runs `runRankingsAggregator` every 6h at 00/06/12/18 UTC, production only.

## VINCENT MANUAL
1. Apply migration: paste `supabase/migrations/0040_model_rankings.sql` into Supabase SQL Editor
2. Trigger first run:
   `curl -X POST -H "x-admin-key: $ADMIN_API_KEY" https://goblinapi-production.up.railway.app/api/admin/rankings/refresh`
3. Verify `/models` loads with rankings for "Coding"
4. Click a model → `/models/[id]` shows per-source breakdown
5. `/admin/rankings` → 5 sources, ideally all `last_status: ok`
6. Composer → ModelPicker shows `EMPFOHLEN` chips on top-3 matching models
7. Better-Stack heartbeat green after first rankings run

## Known limitations
- LMArena not included (no official data export per their ToS)
- Artificial Analysis not included (paid API only)
- `canonicalize()` is heuristic — audit monthly via `/admin/rankings` to catch model-ID mismatches
- TASK_WEIGHTS static — future A/B tuning based on user feedback
- ModelPicker matching uses substring heuristic, may have false positives/negatives until canonical IDs propagate to internal `models` table

## Architecture decisions
- Why no LMArena: ToS doesn't allow scraping, no public API
- Why no own evals: public benchmarks objectively better than 5-task substring scoring. Revisit when paid signal available.
- Why 6h refresh: balance freshness vs. load on public APIs
- Why new table `ranked_models` instead of reusing `models`: existing `models` table is Goblin's curated catalog with `layer`, `requires_key`, `phase` etc. — different shape, different ownership. Joining via canonical IDs later is cheap.
