# NAV_MAP — Layer-2 "API-First" Pivot (Session 1, Phase 0)

**Date:** 2026-06-15 · **Status:** map only, no edits in this phase (HR-3).
**Scope:** two git repos + one standalone doc.

- **Goblin** — `C:/Claude Projekte/12 - Goblin/Goblin` (git, `master`) — product app.
- **Pitch** — `C:/Claude Projekte/12 - Goblin/Pitch` (git `justgoblin-pitch`, `main`) — landing + investor pitch.
- **Architektur** — `C:/Claude Projekte/12 - Goblin/Architektur/GOBLIN_ARCH_v6.md` — **not a git repo**, standalone file (no push needed).
- **Financials** (read-only source of truth) — `…/Financials_Machbarkeit/files/GOBLIN_WSC_FINANCIAL_DEEPDIVE.md`.

## Canonical decisions this map enforces

- **Flag:** new code paths gate on `GOBLIN_HOSTED_API` (default **false**). The repo today uses `GOBLIN_HOSTED_ENABLED` / `NEXT_PUBLIC_GOBLIN_HOSTED_ENABLED` + Vast.ai naming — that is the OLD scaffold; it gets refactored in place (HR-2), not duplicated.
- **Two-level truth (HR-4):** public surfaces = "curated, bundled Goblin models — managed inference, no key, no per-token anxiety." Never name a wholesale provider publicly. Investor mode = honest API-first sourcing as capital-efficiency strategy.
- **Canon layers (HR-6):** L0 cloud machine · L1 free-tier · L2 Goblin-bundled (core, API-first) · L3 BYOK. The arch doc has this **inverted** (L1=Hosted, L2=Free, L3=BYOK, no L0).
- **Infra renames (HR-7):** Hetzner Object Storage → **Backblaze B2** (`goblin-projects`, eu-central-003); Fly.io → **Railway**.
- **Numbers (Financials):** net ARPU ≈ $9.40 · contribution ≈ $8.83 · break-even ~13 users · ~$1.23/mo per L2-active user (Flash class) · soft cap ~40–60M tok/mo · GPU crossover ~4,500–13,000 users only if util >55%.

---

## 1. OLD GPU / SELF-HOST STORY (rent, Clore, Vast, vLLM, "1,000 users", Q1 2027, GPU pool)

### 1A. Pitch repo — `Pitch/lib/i18n.ts` (EN + DE mirror)

| Line (EN/DE) | Current text (abbrev) | Proposed change | Surface | Risk |
|---|---|---|---|---|
| 95 / 490 `stack.l2Body1` | "…hosted on dedicated GPU capacity Goblin **rents and routes**…" | Drop GPU-rental mechanism. "…curated, Goblin-bundled coding models — managed inference, bundled into your subscription. No API key. No per-token counter. No metered cutoff." | PUBLIC | med |
| 97 / 492 `stack.l2Body2` | "Today: LiteLLM… **Tomorrow (Q1 2027): Goblin-owned GPU pool on Clore.ai**…" | Remove Clore.ai + Q1 2027 GPU-pool promise. Reframe: managed bundled inference today, provider-agnostic, scales without per-token anxiety. | PUBLIC | med |
| 76 / 471 `problem.walls[3].body` | "…we own the **substrate**, not the inference. Same Layer 2 inference…" | Keep region-pricing point; soften "own the substrate" → "we manage the inference, you don't meter it." Provider-agnostic. | PUBLIC | low |
| 191 / 588 `whyNow.b1Body2` | "…**rented GPUs**… 70-80% gross margin… **fully-loaded GPU rental**…" | Public econ framing without GPU mechanism: managed open-source-class inference now a fraction of frontier API cost; bundled economics work. Keep the "window" thesis. | PUBLIC | med |
| 252 / 651 `pricing.metrics[2].explain` | "once we **run our own GPUs from Q1 2027**" | "from managed, bundled inference economics" (provider-agnostic). | PUBLIC | low |
| 326 / 725 `unitEconomics.costs[Phase 3]` | "+ **Clore.ai RTX 4090**" | API-first cost table — inference is a linear per-token variable cost, not a GPU line. Reframe rows (see §5). | INVESTOR | med |
| 335 / 734 `unitEconomics.bulletHosted` | "…hosted on **rented GPU capacity**… Fixed **GPU rental**…" | Honest investor framing: L2 sourced via wholesale per-token APIs; ~90%+ GM on variable COGS; GPU buildout deferred. | INVESTOR | med |
| 362 / 761 `ask.cards[1].list[1]` | "bridging Phase 3 **GPU pool costs**…" | "bridging early Layer-2 inference spend ahead of full revenue ramp" | INVESTOR | low |

### 1B. Pitch repo — components

| File:line | Current | Proposed | Surface | Risk |
|---|---|---|---|---|
| `components/sections/S11b_Trajectory.tsx:20` | "Trigger: Phase 3 launches. **Goblin-Hosted live.**" | Investor trajectory: Layer-2 (API-first) launch milestone, not GPU. Align to API-first phases. | INVESTOR | low |
| `components/sections/S03_TheStack.tsx` | renders `stack.l2*` strings | No literal GPU text in TSX (strings come from i18n) — verify after i18n edit, no code change expected. | PUBLIC | low |
| `components/sections/S10b_UnitEconomics.tsx` | renders `unitEconomics.*` | Verify table renders new rows; structure likely unchanged (zip by index). | INVESTOR | low |

### 1C. Goblin app — `apps/web` / `apps/api`

| File:line | Current | Proposed | Surface | Risk |
|---|---|---|---|---|
| `apps/api/src/services/goblin-hosted.ts` (header + models) | "Layer C (**Vast.ai / vLLM**)", `GOBLIN_HOSTED_ENABLED`, `GOBLIN_HOSTED_URL`, Qwen/Llama model picks | Refactor in place → API-first provider abstraction, flag `GOBLIN_HOSTED_API`, server-side-keyed bundled provider, Goblin-named tiers (efficient/premium) mapping to provider-agnostic model IDs. | code (flag OFF) | med |
| `apps/web/lib/goblin-hosted-models.ts` | "hosted by Goblin **on Vast.ai**", `NEXT_PUBLIC_GOBLIN_HOSTED_ENABLED` | Genericize copy (no Vast.ai), align to `GOBLIN_HOSTED_API`, Goblin-named tiers. | code/UI | low |
| `infra/GOBLIN_HOSTED_ACTIVATION.md` | full Vast.ai/vLLM GPU rental runbook | Replace with API-first activation runbook (wholesale account, server-side key as secret, flag flip). Session-1 may stub; final in Session 2. | doc | low |
| `apps/web/app/dashboard/billing/page.tsx:240` | label "Hosted", desc "**Goblin GPU (Phase 3)**" | "Goblin-bundled — coming soon" (provider-agnostic). | PUBLIC | low |
| `apps/web/components/landing/sections/Faq.tsx:14` | "Goblin-hosted open-source models coming soon." | OK as-is (no provider/GPU). Optional: "Goblin-bundled models coming soon." | PUBLIC | low |
| `apps/web/components/landing/faq.tsx:18` | names "Qwen Coder 14B, Llama 3.3 70B … coming soon" | Genericize to "Goblin-bundled models — coming soon" (model picks superseded, HR-F). | PUBLIC | low |
| `apps/web/app/welcome/routing/page.tsx:6` | comment "Layer 2, Goblin-Hosted, **Q1 2027**" | Update internal comment to API-first; keep waitlist endpoint. | comment | low |
| `apps/web/app/welcome/_components/i18n.ts:380` | "Soon Goblin's own models run straight through — no key, no token panic" | OK — provider-agnostic, keep. | PUBLIC | low |

---

## 2. PUBLIC STRINGS ABOUT HOW INFERENCE IS PROVIDED (HR-4 public level)

Public, **keep** (already provider-agnostic / benefit-led): `hero.bundled`, `problem.walls[2]` (bundled-not-metered), `stack.l1Body` (free tier), `stack.l25*` (routing moat), `model-switcher.tsx:290` "GOBLIN HOSTED — COMING SOON" (HR-9 keep), `SoftLimitBanner.tsx` comment.

Public, **reframe** (named above): `stack.l2Body1/2`, `whyNow.b1Body2`, `pricing.metrics[2].explain`, `problem.walls[3]`, `faq.tsx:18`, `billing:240`.

---

## 3. LAYER NUMBERING (catch the inversion — HR-6)

| Location | Current numbering | Canon target |
|---|---|---|
| `Architektur/GOBLIN_ARCH_v6.md` §6 "Smart Model Routing (Three Layers)" L124–145 | **L1 = Goblin Hosted**, L2 = Free-API, L3 = BYOK, **no L0** | L0 cloud machine · L1 free-tier · **L2 Goblin-bundled (core)** · L3 BYOK + traceability note |
| Pitch `i18n.ts` `stack.*` (L87–114 / 482–510) | Already canon: L3/L2/L25/L1/L0 | No renumber — already correct; only L2 *content* changes. |
| Pitch `problem.walls[3]` "Layer 2 inference" | canon L2 | consistent — keep |
| Goblin `model-router.ts` `ModelLayer = 'byok'\|'free_api'\|'goblin_hosted'` | enum names, not numbered | keep enum; semantics map to canon L3/L1/L2 |

**Note:** the arch doc inversion is the only place needing renumber. Add a one-line traceability note at the renumber point.

---

## 4. STALE INFRA NAMES (HR-7) — arch doc only

| Line | Current | → |
|---|---|---|
| 33 | "shared cloud **GPU**" | reframe (hardware-barrier framing OK; mechanism = managed bundled inference) |
| 235–242, 301, 339 | **Hetzner Object Storage** / Hetzner Volumes | **Backblaze B2** (`goblin-projects`, eu-central-003) |
| 249, 308 | **Fly.io** | **Railway** (Hono API) |
| 223–224, 250–252, 304, 514–515, 526 | Clore.ai / Vast.ai / vLLM GPU rows | API-first (see §5); keep one "GPU buildout — deferred" note |

Leave untouched: Supabase, Vercel, Cloudflare, Stripe, Resend, LiteLLM.

---

## 5. DATA-MODEL TOUCHPOINTS (cap scaffold — Phase 4c)

| Object | Where | Role in cap |
|---|---|---|
| `agent_runs.input_tokens / output_tokens` | mig `0001`, arch §12 L392 | raw per-run token counts |
| `completion_costs(source_tier, tokens_in, tokens_out)` | mig `0038` | per-completion rows incl. `source_tier` — **the cap aggregates here filtered to goblin_hosted** |
| `monthly_costs_per_user` view | mig `0038` | existing per-user/per-provider monthly rollup — do **not** duplicate; new view is goblin_hosted-scoped per-user total |
| `goblin_hosted_usage(month, call_count)` | mig `0035` | call-count only, **no tokens** → insufficient for token cap |
| `goblin_hosted_waitlist` | mig `0060` | interest capture, unrelated to cap |
| layer enum `goblin_hosted` | `model-router.ts`, `catalog.ts` (Badge/layer), `billing.breakdown.goblin_hosted`, `model-switcher.tsx` | the L2 tier the cap meters |

**Next migration number:** highest is `0066` → **new = `0067`** (per-user monthly goblin_hosted token rollup view/counter). Migration file only, NOT applied (HR-10).

---

## 6. RISK SUMMARY

- **High:** none (flag stays OFF; no live inference; no SQL applied; no push).
- **Med:** public narrative reframes (must not leak wholesale names, must not break EN/DE shape parity); arch doc GPU-section replacement; provider-abstraction refactor of existing scaffold.
- **Low:** infra renames, comment updates, genericizing model names, usage-bar neutral state.

## 7. PHASE ORDER (post-approval)

P1 public narrative (Pitch i18n public sections + Goblin web public strings) → P2 investor mode (i18n investor sections + S10b/S11b/S12b) → P3 arch doc → P4 scaffold (provider abstraction, branded tiers, mig 0067, usage bar, tests) → P5 self-audit + report. No push without explicit approval (DoD #6).
