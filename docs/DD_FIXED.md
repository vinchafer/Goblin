# DD_FIXED — what changed, why, and the regression proof

Branch `dd-hardening-2026-06-20`. Each entry: the defect, the change, before→after,
and the test/check proving neighbors still work. Nothing merged to master.

---

## Commit `93781cf` — P0: Goblin models selectable in the composer + un-clipped dropdown

**Files:** `apps/web/components/chat/ChatInput.tsx`, `apps/web/app/dashboard/page.tsx`,
`apps/api/src/services/catalog.test.ts`.

**P0-2 — the second "SOON" source.** `ChatInput.ModelHub` is the picker for ALL three
composers (dashboard hero, standalone chat, workspace chat-tab).
- Before: `const hostedModels = models.filter(m => m.layer === 'goblin_hosted')` (no
  availability filter), then each rendered as a static `<div opacity:.5>` with a
  hard-coded `SOON` badge — not a button, no `onSelect`. Flag- and `available`-blind.
- After: `const hostedModels = filter(models.filter(... 'goblin_hosted'))` (same
  availability filter as byok/free), rendered through the shared selectable `ModelRow`
  with an "INKLUSIVE · KEIN KEY" badge. When the server flag is off the API returns no
  hosted rows → the section is simply absent (no false SOON).

**P0-1 — clipped start dropdown.** `apps/web/app/dashboard/page.tsx`.
- Before: `.gobl-hero` section had `overflow:'hidden'`, clipping the hero `ModelHub`
  (which opens downward) so the list rendered cut off / behind the card below.
- After: removed `overflow:'hidden'` (kept `border-radius`, which still clips the dark
  fill to the border-box — only the popover escapes). No new stacking context created.

**Regression proof:** `apps/web` typecheck PASS; `apps/web` build PASS (exit 0, full
route list, no errors). `catalog.test.ts` gains a badge-contract test asserting hosted
tiers are `available:true` / badge `GOBLIN_HOSTED`, never `COMING_SOON`. API suite
**185/0**. Existing `goblin-hosted.test.ts` (Swift streams / Forge→Kimi / Swift-on-trial,
no slug leak) untouched and green. `GoblinLogo` import retained (still used by
`ProviderIcon`).

---

## Commit `1849cd0` — P1: scrub the usage-view model-name leak (two-level truth)

**Files:** `apps/api/src/lib/model-label.ts` (new), `apps/api/src/lib/model-label.test.ts`
(new), `apps/api/src/routes/users.ts`.

**Defect.** `GET /api/users/me/usage` built `byModel` from the raw `agent_runs.model_used`
and shipped it to the client. Both usage surfaces (`/dashboard/usage` and the Settings
usage tab) render `m.model` verbatim → leaked the internal tier id `goblin/efficient`
and raw BYOK slugs (`groq/llama-3.3-70b-versatile`).
- Before: `const m = (r.model_used as string) ?? 'unknown'; modelMap[m] = …`
- After: `usageModelLabel(r.model_used, r.source_tier)` → Goblin runs become
  "Goblin Swift"/"Goblin Forge"; any `goblin_hosted` run that didn't record a known
  tier id collapses to the neutral "Goblin" (so a future routing change can't leak the
  underlying open-source slug); BYOK/free slugs are humanized (prefix dropped, date
  stripped, title-cased).

**Regression proof:** new `model-label.test.ts` (5 tests: Goblin ids→public names; never
an underlying slug for goblin_hosted; BYOK humanized w/o prefix; date suffix stripped;
empty/null handled). API suite **190/0**. Server-side scrub fixes BOTH web surfaces from
one point; the client-side prefix-strip in `UsagePage.tsx:114` becomes a harmless no-op
(label already clean). `GoblinUsageBar` (weighted allowance, HR-4) untouched and verified
leak-free by reading.

---

## Session: unify usage/limits + ship (DD §A + §C executed)

The coupled change-set the autonomous pass deferred (§A) plus the free-pool advertising
fix (§C), executed as one reviewed unit on the founder's locked decisions (D1 per-model
**Builds** count; D2 pricing in **"≈ N Builds / month"**; D3 retire the request-count
system). Full report: `docs/USAGE_UNIFICATION_REPORT.md`.

**F4-2 / HR-3 — wrong enforcement removed.** `usageLimitMiddleware` (the sole incrementer
of `monthly_requests_used`) capped ALL tiers at `monthly_limit` (200) on `/api/chat/stream`
only — wrongly 429'ing BYOK (user's own key) + goblin_hosted (already weighted-capped),
while standalone chat had no cap (bypassable).
- Before: `chat.post('/stream', chatStreamRateLimit, usageLimitMiddleware, …)`.
- After: `chat.post('/stream', chatStreamRateLimit, …)` (burst guard kept); `middleware/
  usage-limit.ts` deleted (grep-confirmed no other importer). Goblin spend stays capped by
  the weighted allowance + daily guard in `model-router.ts`, gated on
  `route.layer === 'goblin_hosted'` — so BYOK is now structurally uncapped by Goblin,
  matching the UI promise. Guard: `routes/chat-enforcement.test.ts` (4 source-level checks).

**F4-2/3/4 — every frozen-counter read repointed.** Nothing now reads/writes
`monthly_requests_used` / `monthly_limit` / `monthlyRequests` (grep: only comments remain).
- `users.ts /me/usage`: dropped `monthlyUsed`/`monthlyLimit`; added `goblinBuilds{swift,
  forge}` (per-tier BUILD counts split from `agent_runs.model_used`, plain run counts).
- `billing.ts`: `/status` drops the counter fields; `/usage` now counts current-month
  `agent_runs` by tier (was `chat_logs` + frozen fallback), drops `limit`; webhook drops
  the `resetMonthlyUsage` call (allowance auto-resets by calendar month).
- `admin.ts` user selects, `support-agent.ts` context (now "N builds this month"),
  `billing-service.ts` (no `monthly_limit` writes; `resetMonthlyUsage` removed),
  `config/plans.ts` (`monthlyRequests` field removed).
- Dead component `app-shell/usage-indicators.tsx` (direct supabase counter read + a
  hard-coded "Free-API Pool active" mislabel) deleted — no importers.

**F4-3 / HR-4/HR-5 — usage display rebuilt (D1).** `app/dashboard/usage/page.tsx`,
`components/settings/UsagePage.tsx`, `components/sidebar/SidebarUsage.tsx`:
- one weighted allowance bar (`GoblinUsageBar`, % only, headroom-positive) +
- per-model activity "Goblin Swift: N Builds · Goblin Forge: M Builds" +
- BYOK row "Über deine Keys: K Builds — kein Limit von Goblin" +
- a qualitative line "Forge … verbraucht dein Kontingent schneller als Swift" (no number).
- Every "Goblin-Anfragen X/Y" / "X von Y Anfragen" block deleted; sidebar shows the
  allowance % or a plain Build count when `goblinCap` is null. EN/DE parity; 390px; design
  tokens unchanged. "Build" is the single user-facing unit (loanword in DE).

**F4-4 / HR-6 — pricing copy.** `geo-pricing-section.tsx`, `pricing-cards.tsx`,
`landing/sections/Pricing.tsx`, `dashboard/upgrade/page.tsx`, both billing pages: "N AI
requests / month" → **"≈ N Builds / month"** (single source `lib/plan-builds.ts`) + "BYOK
— all providers, no Goblin limits" (honest once HR-3 landed). The Build numbers are the
server allowance ÷ a documented `COST_UNITS_PER_BUILD = 50,000` (in `goblin-cap.ts`),
rounded conservatively (100 / 350 / 600 / 1,200). No cost units/tokens/$/weight on any
client surface (the divisor + economics stay server-side).

**F5-1 / HR-8 — free-pool advertising gated.** `model-router.ts` gains
`isFreeApiPoolEnabled()`; `catalog.ts` gates the `free_api` push on it (mirrors the
goblin gate, holds even when the prod `models` cache is the source). Keyless default now
prefers Goblin Swift: `model-switcher.tsx` cascade + `ChatInput.DEFAULT_MODEL` (Swift when
`GOBLIN_HOSTED_ENABLED`). Guard: `services/catalog-freepool.test.ts` (no FREE rows while
off; restored when flipped on; Swift available + selectable as the keyless default).

**HR-7 — migration FILE (not applied).** `supabase/migrations/0068_drop_legacy_request_
counters.sql` drops `users.monthly_requests_used`, `users.monthly_limit`, and the dead
`increment_request_count()`. Idempotent. Code is safe both pre- and post-apply (no select/
write of the columns remains). Founder applies via Supabase SQL Editor after deploy.

**Regression proof:** API **197/0** (+7: 3 free-pool, 4 enforcement), API tsc clean; web
tsc clean; web build PASS (exit 0, full route list). Two-level-truth grep clean on user
surfaces (Goblin Swift/Forge names only; no slug/tier-id/provider/cost-unit/token/weight/$);
zero "AI requests"/"Anfragen X/Y" legacy copy in rendered text; no frozen-counter reads
remain. Design tokens + the deterministic test mock (no real DeepInfra spend) untouched.

---

## Not changed (still logged — see DD_RECOMMENDATIONS)
- apps/web component-test harness (no vitest/RTL/jsdom) → §B. The render-level surfaces
  in this session are guarded by web tsc + build + the API data-contract tests, not by
  RTL. Still worth one isolated pass.
