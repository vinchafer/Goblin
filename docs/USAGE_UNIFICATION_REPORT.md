# USAGE_UNIFICATION_REPORT — retire the request-count system, unify on the weighted allowance

Branch `dd-hardening-2026-06-20` (merged to master at the end of this session — the P0
walk fixes + the F4 leak fix + this unification ship together). Executes
`docs/DD_RECOMMENDATIONS.md` §A (one coupled change-set) + §C (free-pool advertising),
on the founder's locked decisions.

## Founder decisions executed
- **D1** — Usage shows ONE weighted Goblin allowance bar (overall %, reset date) PLUS a
  per-model **activity** line in Builds: "Goblin Swift: N Builds · Goblin Forge: M Builds".
  The per-model figure is a plain RUN COUNT — no cost units, tokens, or weight.
- **D2** — Pricing expresses each plan's allowance as **"≈ N Builds / month"** (tangible
  proxy), not "AI requests" and not raw tokens/cost. "Build" is the user-facing unit
  everywhere a limit is described.
- **D3** — The legacy request-count system is retired entirely. The weighted token
  allowance + per-day guard is the single source of limit truth.

## The bug that's fixed (real, user-facing)
On `/api/chat/stream` (project chat) a BYOK or Goblin user was blocked at `monthly_limit`
(200 default) by `usageLimitMiddleware` — wrong on both counts (BYOK is the user's own key;
Goblin is already governed by the weighted allowance), and applied ONLY there (standalone
chat had no cap, so the limit was also trivially bypassable). The middleware was the sole
incrementer of `monthly_requests_used`, which several billing/admin/support/display surfaces
then read — so it had to move as one unit.

## What shipped (by surface)

**Enforcement (API).** Removed `usageLimitMiddleware` from `routes/chat.ts` (kept
`chatStreamRateLimit`, the per-minute burst guard). Deleted `middleware/usage-limit.ts`.
Goblin spend stays capped by the weighted monthly allowance + per-day guard in
`services/model-router.ts`, which only runs for `route.layer === 'goblin_hosted'` → BYOK is
now structurally uncapped by Goblin. Guard test: `routes/chat-enforcement.test.ts`.

**Activity source (API).** `GET /api/users/me/usage` now returns `goblinBuilds: { swift,
forge }` (per-tier BUILD counts split from `agent_runs.model_used`) and no longer returns
`monthlyUsed` / `monthlyLimit`. `byTier` (byok/free_api/goblin_hosted) and `totalInPeriod`
are the activity numbers; `goblinCap` is the only limit.

**Reads repointed (API).** `billing.ts` (`/status`, `/usage` → counts `agent_runs` for the
current calendar month, no `limit`; webhook drops `resetMonthlyUsage`), `admin.ts` (user
selects), `services/support-agent.ts` (context = "N builds this month"),
`services/billing-service.ts` (no `monthly_limit` writes; `resetMonthlyUsage` removed),
`config/plans.ts` (`monthlyRequests` removed). Grep proves nothing reads/writes the frozen
columns except explanatory comments.

**Usage display rebuilt (web).** `app/dashboard/usage/page.tsx`, `components/settings/
UsagePage.tsx`, `components/sidebar/SidebarUsage.tsx`: one allowance bar + per-model Builds
+ BYOK Builds row + the qualitative "Forge uses your allowance faster than Swift" line. All
"Goblin-Anfragen X/Y" / "X von Y Anfragen" deleted. Sidebar shows the allowance % or a plain
Build count when `goblinCap` is null (comped / no plan). EN/DE parity, 390px, design tokens
unchanged. Dead `app-shell/usage-indicators.tsx` deleted.

**Pricing (web).** `geo-pricing-section.tsx`, `pricing-cards.tsx`, `landing/sections/
Pricing.tsx`, `dashboard/upgrade/page.tsx` (cards + comparison matrix + confirm modal), both
billing pages: "≈ N Builds / month" + "BYOK — all providers, no Goblin limits".

**Free-pool advertising (web + API, §C / F5-1).** `model-router.isFreeApiPoolEnabled()`
gates the `free_api` push in `catalog.ts`; keyless default prefers Goblin Swift
(`model-switcher.tsx` + `ChatInput.DEFAULT_MODEL`). Test: `services/catalog-freepool.test.ts`.

**Forge-faster mention (HR-5).** Already on Settings → Goblin-Modelle (`ModelsPage.tsx`);
added to the usage page + settings usage tab. Qualitative, no number.

## The build-number assumption (HR-6 — traceable + adjustable)
The public "Builds / month" figures are derived from each plan's server-side weighted
allowance (`GOBLIN_MONTHLY_ALLOWANCE` in `apps/api/src/lib/goblin-cap.ts`) divided by ONE
documented constant, `COST_UNITS_PER_BUILD = 50,000` (also in `goblin-cap.ts`), then rounded
DOWN to a clean figure. A "build" = one agent run / generation turn; 50k is a deliberately
conservative estimate of a typical mixed Swift/Forge build, so the public numbers under-count
rather than over-promise.

| Plan  | Allowance (internal, server-only) | ÷ 50k | Shown    |
|-------|-----------------------------------|-------|----------|
| Trial | 4.9M                              | ~98   | ≈ 100    |
| Build | 17.4M                             | ~348  | ≈ 350    |
| Pro   | 30.0M                             | 600   | ≈ 600    |
| Power | 61.7M                             | ~1234 | ≈ 1,200  |

Ascending (no Build > Pro inversion). Intentionally lower than the retired "200 / 800 /
3,000 AI requests" copy, which over-promised at the cap (a Forge build costs ~4.4× a Swift
build). The web copy (`apps/web/lib/plan-builds.ts`) carries only the rounded numbers + a
pointer back to `goblin-cap.ts`; the raw allowances / divisor / weight stay server-side
(two-level truth). To change the numbers later, edit `COST_UNITS_PER_BUILD` and the rounded
figures in `plan-builds.ts` — or swap "Builds" for another word in the i18n strings
(`buildsPerMonth` + the usage surfaces); the NUMBER stays honest to the allowance either way.

## 🔴 Founder action — apply the migration
`supabase/migrations/0068_drop_legacy_request_counters.sql` is written but NOT applied (file
only). After this branch is deployed (so no running code selects the columns), apply it via
the Supabase SQL Editor:

```sql
drop function if exists public.increment_request_count(uuid);
alter table public.users drop column if exists monthly_requests_used;
alter table public.users drop column if exists monthly_limit;
```

It is idempotent and safe to run any time after deploy. Until applied, the columns are
harmless dead weight (no code reads or writes them). `packages/shared/src/database.types.ts`
still lists the columns (it reflects the pre-migration schema) — regenerate types after
applying if desired; nothing depends on them.

## Verification
- API: **197/0** vitest (+7 new: 3 free-pool gating, 4 enforcement guards); `tsc --noEmit`
  clean.
- Web: `tsc --noEmit` clean; `pnpm --filter web build` PASS (exit 0, full route list).
- Two-level truth: grep clean on user surfaces — only "Goblin Swift"/"Goblin Forge" public
  names; no slug / tier id / provider / cost unit / token / weight / $ in rendered text.
- Legacy copy: zero "AI requests" / "Anfragen X/Y" in rendered text; no frozen-counter
  reads remain (comments only).
- No real provider spend (deterministic mock used for all streaming/limit tests).

## Updated re-walk (founder, iPhone @390px — DE and EN)
1. **Pricing** (public + `/dashboard/upgrade`): each plan reads "≈ N Builds / month"
   (100 / 350 / 600 / 1,200), BYOK line says "no Goblin limits". No "AI requests" anywhere.
2. **Usage** (`/dashboard/usage` + Settings → Verbrauch): one allowance bar (% + reset
   date), "Goblin Swift: N Builds · Goblin Forge: M Builds", a BYOK Builds row, and the
   "Forge uses your allowance faster" line. No "Goblin-Anfragen X/Y".
3. **Sidebar usage widget**: allowance % when on a plan; a plain Build count when comped.
4. **Project chat as a BYOK user**: send many messages — never a 200-cap 429 (burst guard
   only). Goblin Swift/Forge still refuse cleanly once the monthly allowance is reached.
5. **Keyless composer**: default model is Goblin Swift (not a Groq slug); the picker shows
   no "Gemini · FREE" / "Llama · FREE" rows while the free pool is off.
6. **Settings → Goblin-Modelle**: Forge card still notes it uses the allowance faster.
7. Then apply migration `0068`.
