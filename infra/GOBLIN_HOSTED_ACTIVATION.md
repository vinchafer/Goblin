# Goblin-bundled (Layer 2) Activation Guide — API-first (v6.1)

**Estimated time: ~30 min from decision to live.** No GPU buildout.

This activates Layer 2 (the Goblin-bundled models) by pointing it at a **wholesale
per-token inference API** (OpenAI-compatible). The provider is **DeepInfra** (US;
SOC 2 / ISO 27001; zero-retention for the open-source models used). The inference
key lives server-side — the inverse of BYOK. Routed through the OpenAI SDK as a
library; no proxy is deployed.

> **Compliance note:** inference runs in the US under EU Standard Contractual
> Clauses (SCCs); storage stays EU (Backblaze B2, eu-central-003). The privacy
> policy + sub-processor list already reflect this. DeepInfra is named ONLY on the
> legal sub-processor surface — never in marketing copy.

> **Public-surface rule:** never name the wholesale provider on any user-facing
> surface. Internally it is a swappable backend; to users it is "Goblin-bundled
> models, no key." The two Goblin-named tiers (`goblin/efficient` default,
> `goblin/premium` upsell) map to provider model IDs via env, so the provider
> behind them can change with zero UI change.

---

## Prerequisites

- A DeepInfra account with a small balance ($10) and a **monthly spend cap**.
- Access to Railway dashboard (API env vars) and Vercel (frontend flag).
- Supabase migration `0067_goblin_hosted_token_rollup.sql` applied (per-user
  monthly token rollup for the fair-use cap).

---

## Step 1: Provision the DeepInfra account (~15 min)

1. Open the account, set a **hard monthly spend cap** (matching the funded balance).
2. Confirm the data policy is **no-training / zero-retention** for the open-source
   models used (DeepSeek, Kimi).
3. Create an API key. The endpoint is OpenAI-compatible at
   `https://api.deepinfra.com/v1/openai` (this is the code default).

---

## Step 2: Set Railway environment variables (~5 min)

In Railway dashboard → Goblin API service → Variables:

```
GOBLIN_HOSTED_API=true
DEEPINFRA_API_KEY=<server-side wholesale key>         # secret — Railway ONLY
# GOBLIN_HOSTED_BASE_URL=https://api.deepinfra.com/v1/openai   # optional; this is the default
# GOBLIN_HOSTED_MODEL_EFFICIENT=deepseek-ai/DeepSeek-V3.2      # optional; Goblin Swift default
# GOBLIN_HOSTED_MODEL_PREMIUM=moonshotai/Kimi-K2.6            # optional; Goblin Forge default
```

The model slugs default to DeepSeek V3.2 (Swift) and Kimi K2.6 (Forge) in code, so
you only need to set them if a slug needs correcting against the live catalog. The
fail-closed invariant refuses to route if a tier is ever pointed at a Google /
Anthropic / OpenAI model.

Also set in Vercel (frontend feature flag):

```
NEXT_PUBLIC_GOBLIN_HOSTED_API=true
```

While `GOBLIN_HOSTED_API` is unset/false, `getGoblinHostedConfig()` returns null
and the router never selects Layer 2 — the code path is unreachable.

---

## Step 3: Verify health (~2 min)

```bash
curl https://goblinapi-production.up.railway.app/health/deep
```

Expected: `goblin_hosted: { status: "active" }`. If `misconfigured`, the flag is on
but `DEEPINFRA_API_KEY` is missing (or a tier maps to a forbidden proprietary model).

---

## Step 4: Test a chat request (~5 min)

1. Log in as a test user.
2. Open chat — the model picker shows Goblin-bundled models (no "Coming Soon").
3. Select the efficient tier and send a message — generation should stream.
4. Confirm a `completion_costs` row lands with `source_tier = 'goblin_hosted'`,
   and the usage bar reflects the new monthly token total.

---

## Rollback

1. Set `GOBLIN_HOSTED_API=false` in Railway → redeploy.
2. Set `NEXT_PUBLIC_GOBLIN_HOSTED_API=false` in Vercel → redeploy.
3. Disable the wholesale key. No GPU instance to stop.

---

## Cost shape (API-first)

Linear, variable, per token — **no fixed GPU line**. ≈ $0.56 total variable cost
per paying user/mo at base usage (efficient class), ~94% gross margin on variable
COGS. The fair-use token cap (~40–60M tok/mo base plan, enforced via the rollup +
`apps/api/src/lib/goblin-cap.ts`) protects against the heavy tail.

---

## Self-host crossover (deferred decision)

Stay API-first until steady demand clears ~10–30B tokens/mo (≈ 4,500–13,000 paying
users at base usage) **and** peak-shaping lifts achieved utilization above ~55%.
Revisit quarterly — GPU rental and open-model API prices are both falling. See
`Architektur/GOBLIN_ARCH_v6.md` §6 ("GPU buildout — deferred decision").
