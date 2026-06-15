# Layer-2 "API-First" Pivot — Session 1 Report

**Date:** 2026-06-15 · **Scope:** narrative refactor + code scaffold, flag OFF, no live inference, nothing pushed.
**Repos:** Goblin (`master`), Pitch (`justgoblin-pitch`/`main`), + standalone `Architektur/GOBLIN_ARCH_v6.md`.

The substrate strategy changed from self-hosted GPU rental (Clore/Vast, ~Q1 2027) to **wholesale per-token inference APIs** — "bought tokens wearing a Goblin badge." The user-facing promise is unchanged ("Goblin-bundled models, no key"). This session did the narrative + scaffold only; live wiring is Session 2.

---

## Phase 0 — NAV_MAP
`docs/NAV_MAP_L2_PIVOT.md`. Mapped every old-GPU/self-host string, public inference copy, the layer-numbering inversion, stale infra names, and the cap data-model touchpoints across both repos. No edits in this phase.

## Phase 1 — Public narrative (provider-agnostic, no wholesale names)
**Pitch `lib/i18n.ts`** (EN + DE): `stack.l2Body1/2` (GPU-rental + Clore/Q1-2027 → managed bundled inference), `problem.walls[3]` ("own the substrate" → "manage and bundle the inference"), `whyNow.b1Body2` (rented-GPU economics → managed open-source-class), `pricing.metrics[2].explain` (Q1-2027 GPUs → "structural margin… from day one").
**Goblin web:** `landing/sections/Faq.tsx` + `landing/faq.tsx` (Qwen/Llama names → "Goblin-bundled models — curated, no key"), `dashboard/billing/page.tsx` ("Goblin GPU (Phase 3)" → "Goblin-bundled (coming soon)").

## Phase 2 — Investor mode (honest API-first, corrected economics)
**Pitch `lib/i18n.ts` `unitEconomics`** (EN + DE): cost table rows reworked (no GPU line; Layer-2 = variable per-token), `costNote` clarifies inference is variable, `bulletHosted` rewritten (net ARPU ≈ $9.40, contribution ≈ $8.83, break-even ~13 users, GM ~75%→~93%, zero idle cost, GPU buildout deferred), **new `bulletConditions`** (the three existential conditions + adverse-selection), `ask.cards[1].list` ("GPU pool costs" → "early Layer-2 inference spend").
**`S10b_UnitEconomics.tsx`:** `COST_FIXED` lowered (no GPU buildout) + renders the new conditions bullet. **`S11b_Trajectory.tsx`:** "Phase 3 / Goblin-Hosted live" → "Layer 2 launches — API-first."

## Phase 3 — Architecture doc (`GOBLIN_ARCH_v6.md` → v6.1, primary deliverable)
- GPU-rental plan **replaced** with API-first (§6, §9, §15); short "GPU buildout — deferred decision" note kept (crossover ~5,000+ users & >55% util).
- Layers **renumbered to canon** (§6) with a traceability note: L0 cloud machine · L1 free-tier · L2 Goblin-bundled (core) · L3 BYOK.
- Stale infra fixed: **Hetzner Object Storage → Backblaze B2** (`goblin-projects`, eu-central-003), **Fly.io → Railway** (kept Fly.io only as a user deploy target).
- Cost/break-even/margin tables → API-first (inference variable; break-even ~13 users net of VAT+Stripe; GM 75→93%).
- Three existential conditions + adverse-selection note added (§6).
- Old model picks (Qwen 32B / DeepSeek R1 / Llama 70B) marked superseded → efficient default vs. large-MoE premium, provider-agnostic.
- Version bumped v6.0→v6.1 (April→June 2026) + changelog at top.

## Phase 4 — Code scaffold (behind `GOBLIN_HOSTED_API`, no live calls)
- **Provider abstraction** — `apps/api/src/services/goblin-hosted.ts` refactored in place: API-first, server-side-keyed (inverse of BYOK), flag `GOBLIN_HOSTED_API`, OpenAI-compatible endpoint via LiteLLM **library** (no proxy). `model-router.ts` Layer-2 block updated to the new config + tier resolution. Unreachable while flag off.
- **Model branding** — two Goblin-named tiers (`goblin/efficient` default, `goblin/premium` upsell) → provider-agnostic model IDs via env. Placeholder display names ("Goblin Swift" / "Goblin Forge"). Mirrored in `apps/web/lib/goblin-hosted-models.ts`. Pricing rows added (`model-pricing.ts`).
- **Cap data model** — `supabase/migrations/0067_goblin_hosted_token_rollup.sql` (per-user monthly goblin_hosted token rollup view, `security_invoker`, built on `completion_costs`). **File only — NOT applied.**
- **Usage bar** — `apps/web/components/usage/GoblinUsageBar.tsx`, design-system tokens (HR-13), EN/DE. Flag OFF → neutral "coming soon" empty state, no cap implication. Flag ON → renders a `CapStatus`.
- **Cap logic + tests** — `apps/api/src/lib/goblin-cap.ts` (pure, no network) + `goblin-cap.test.ts` (10 tests).
- Activation runbook (`infra/GOBLIN_HOSTED_ACTIVATION.md`) + `.env.example` + `index.ts` env comments rewritten to API-first.

## Phase 5 — Self-audit
- **api vitest:** 94 passed / 0 failed (84 prior + 10 new cap tests).
- **Typecheck:** Pitch `tsc` clean · web `tsc` clean · api `tsc` clean.
- **Wholesale provider names on public surfaces:** zero (grep DeepInfra/Novita across Pitch public sections + Goblin web = empty).
- **Flag default:** `GOBLIN_HOSTED_API` / `NEXT_PUBLIC_GOBLIN_HOSTED_API` read-only `=== 'true'`; no runtime `=true`. Default OFF everywhere.
- **DB:** migration `0067` present as an untracked file, **not applied**. No SQL run.
- **Old flag/infra residue:** `GOBLIN_HOSTED_ENABLED`/`GOBLIN_GPU_*`/Vast removed from code paths.
- **EN/DE parity:** new `bulletConditions` present in both locales; dict shape compiles.

---

## STATUS (per format)
```
Files touched: see git status below.
EN/DE parity: ok (all new/changed pitch + web copy mirrored; S11b is English-only by existing design).
Flag state verified off: yes (GOBLIN_HOSTED_API default false; getGoblinHostedConfig→null).
Tests/build: green — api 94/94, web+api+pitch tsc clean.
Open items → Session 2: below.
```

### Files changed
**Goblin:** `apps/api/.env.example`, `apps/api/src/index.ts`, `apps/api/src/lib/model-pricing.ts`, `apps/api/src/services/goblin-hosted.ts`, `apps/api/src/services/model-router.ts`, `apps/web/app/dashboard/billing/page.tsx`, `apps/web/app/welcome/routing/page.tsx`, `apps/web/components/landing/faq.tsx`, `apps/web/components/landing/sections/Faq.tsx`, `apps/web/lib/goblin-hosted-models.ts`, `infra/GOBLIN_HOSTED_ACTIVATION.md` · **new:** `apps/api/src/lib/goblin-cap.ts` (+`.test.ts`), `apps/web/components/usage/GoblinUsageBar.tsx`, `supabase/migrations/0067_*.sql`, `docs/NAV_MAP_L2_PIVOT.md`, `docs/L2_PIVOT_SESSION1_REPORT.md`.
**Pitch:** `lib/i18n.ts`, `components/sections/S10b_UnitEconomics.tsx`, `components/sections/S11b_Trajectory.tsx`.
**Architektur:** `GOBLIN_ARCH_v6.md` (not a git repo).

---

## Deferred to Session 2
- Real wholesale account + key; flip `GOBLIN_HOSTED_API=true` (Railway) + `NEXT_PUBLIC_GOBLIN_HOSTED_API=true` (Vercel).
- Apply migration `0067`.
- `/api/account/goblin-usage` endpoint returning `CapStatus` (server-side `goblin-cap.ts` over the rollup) + wire `GoblinUsageBar` to it; enforce the cap in the chat path.
- Mount `GoblinUsageBar` in the dashboard/billing surface.
- Final founder rename of the two tier display names; confirm efficient/premium provider model IDs.
- Live walk: keyless generation through Layer 2, `completion_costs` row with `source_tier='goblin_hosted'`, usage bar updates.
- (Optional) backfill the model registry `models` table with the two Goblin-bundled tiers so the Model Hub shows them.

---

## Founder setup checklist — wholesale inference account
1. **Open the account** with a DeepInfra/Novita-class wholesale per-token provider. Pick the **EU endpoint** if offered.
2. **Spend controls:** hard **$50 spend cap** + **$25 alert**.
3. **Data policy:** confirm **no-training / zero-retention** on the chosen models.
4. **Models:** pick an **efficient-class** agentic coder (Flash-class, ~$0.14/$0.28 per M) as the default; optionally a premium model for the upsell tier. Note their provider model IDs.
5. **Key placement (secrets, never committed):**
   - Railway → Goblin API service → Variables: `GOBLIN_HOSTED_API=true`, `GOBLIN_HOSTED_BASE_URL=https://<endpoint>/v1`, `GOBLIN_HOSTED_API_KEY=<key>`, `GOBLIN_HOSTED_MODEL_EFFICIENT=<id>`, `GOBLIN_HOSTED_MODEL_PREMIUM=<id>`.
   - Vercel → `NEXT_PUBLIC_GOBLIN_HOSTED_API=true`.
6. **Apply** migration `0067` via Supabase SQL Editor.
7. **Verify** per `infra/GOBLIN_HOSTED_ACTIVATION.md` (health = active, test chat streams, cost row recorded).
8. **Never** name the wholesale provider on any public surface.

> **Nothing pushed.** Per DoD #6, all changes are local and await explicit founder approval to commit/push (two repos: Goblin + Pitch; the arch doc is a standalone file).
