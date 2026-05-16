# Session 9B Summary

**Date:** 2026-05-15 (evening, same day as 9D)
**Status:** Complete
**Streams done:** A (Eval-Framework) + B (Operations-Setup)
**Stream deferred:** C (DD V2 Update) → next Opus session

## Phases delivered

- **9B-0 Foundation** — added `sentry.edge.config.ts`, wrapped `next.config.ts` with `withSentryConfig` (fallback when no auth token), extended `.env.example` (web + api) for Sentry / Better-Stack / Admin / Eval keys / EVAL_CRON_SECRET. Reused existing `lib/sentry.ts` + pino-based `lib/logger.ts` instead of duplicating.
- **9B-1 Health + Heartbeat** — added `lib/heartbeat.ts` (Better-Stack ping). `/health` + `/health/deep` already existed; reused as-is.
- **9B-2 Cost-Tracking** — SQL migration `0038_cost_tracking.sql` (table + RLS + monthly view), `lib/model-pricing.ts`, `lib/track-completion.ts` hook wired into both LiteLLM and direct-SDK streaming paths in `services/model-router.ts`. Admin endpoint `GET /api/admin/cost-summary` (gated by existing `x-admin-key`). Page `apps/web/app/admin/costs/page.tsx` server-side fetches via `ADMIN_API_KEY`.
- **9B-3 Operations Runbook** — `docs/OPERATIONS_RUNBOOK.md` covering health endpoints, incident response, weekly/monthly/quarterly routines, cost snapshot.
- **9B-4 Eval Schema** — SQL migration `0039_evals.sql` with `eval_tasks` + `eval_results` + 5 seed tasks (coding × 3, reasoning × 1, instruction-following × 1).
- **9B-5 Eval Runner** — `lib/eval/{providers,scorer,runner}.ts`, 4 providers (Anthropic Sonnet 4.6, OpenAI gpt-4o-mini, Gemini 2.5 Flash, Groq Llama 3.3 70B). MVP substring scorer. `routes/internal-eval.ts` (POST `/api/internal/eval/run` gated by `EVAL_CRON_SECRET`). `lib/cron.ts` setInterval-based daily 04:00 UTC trigger, production-only.
- **9B-6 Eval Dashboard** — admin endpoints `GET /api/admin/evals/latest` + `/api/admin/evals/trends`. Page `apps/web/app/admin/evals/page.tsx` (latest-run per-provider summary + 14-day score matrix).
- **9B-7 CLI Trigger** — `apps/api/scripts/run-eval.ts` + `pnpm eval:run` script.
- **9B-8 Docs** — this summary, runbook, 9E backlog update, BUG_REGISTRY update.

## E2E tests added (4)

- `tests/e2e/32-foundation-ops.spec.ts` (@public)
- `tests/e2e/33-health-deep.spec.ts` (@public)
- `tests/e2e/34-admin-costs.spec.ts` (@local-only)
- `tests/e2e/35-admin-evals.spec.ts` (@local-only)

## DB migrations

- `supabase/migrations/0038_cost_tracking.sql`
- `supabase/migrations/0039_evals.sql`

## Deviations from briefing

1. **Admin gate** — repo uses `x-admin-key` header (existing `admin.ts` middleware), briefing proposed `ADMIN_USER_IDS` env list. Kept existing pattern; admin pages are also guarded by `users.is_admin` flag at the Next.js layout level. Server-side admin pages inject the key from `ADMIN_API_KEY`.
2. **Admin paths** — repo uses `/api/admin/*` (mounted at `app.route('/api/admin', admin)`), not `/admin/api/*` from briefing. New endpoints added to existing `admin.ts`.
3. **Test paths** — repo has `tests/e2e/` at root, not `apps/web/tests/e2e/`. Test numbering already at 31; new tests numbered 32–35.
4. **Cron** — used a 60-second `setInterval` tick instead of pulling in `node-cron` to avoid a new dependency.
5. **Logger** — repo already uses pino; reused `lib/logger.ts` instead of writing a new structured-log wrapper.
6. **Sentry edge config** — `widenClientFileUpload` is kept but `hideSourceMaps` is replaced by `sourcemaps: { disable: false }` (SDK v10 API).

## Vincent Manual (next morning)

1. Apply `0038_cost_tracking.sql` and `0039_evals.sql` via Supabase SQL Editor.
2. Railway env: set `SENTRY_DSN`, `BETTERSTACK_HEARTBEAT_URL`, `EVAL_ANTHROPIC_KEY`, `EVAL_OPENAI_KEY`, `EVAL_GEMINI_KEY`, `EVAL_GROQ_KEY`, `EVAL_CRON_SECRET` (generate `openssl rand -hex 32`).
3. Vercel env: set `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.
4. First eval run:
   ```bash
   curl -X POST https://goblinapi-production.up.railway.app/api/internal/eval/run \
     -H "x-eval-secret: $EVAL_CRON_SECRET"
   ```
5. Verify in browser: `/admin/costs` and `/admin/evals` load without error.

## Files changed

~22 files (`git diff --stat HEAD~N HEAD` after commit).

## Pre-existing issues (not from this session)

- `apps/api/src/routes/billing.ts` — strict-index errors on `PLAN_PRICES`.
- `apps/api/src/services/cache.ts` — `@upstash/redis` module not installed.

These are unchanged by 9B and not in the new code paths.
