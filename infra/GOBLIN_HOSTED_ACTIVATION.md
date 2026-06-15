# Goblin-bundled (Layer 2) Activation Guide — API-first (v6.1)

**Estimated time: ~30 min from decision to live.** No GPU buildout.

This activates Layer 2 (the Goblin-bundled models) by pointing it at a **wholesale
per-token inference API** (OpenAI-compatible). The inference key lives server-side —
the inverse of BYOK. Routed through LiteLLM as a library; no proxy is deployed.

> **Public-surface rule:** never name the wholesale provider on any user-facing
> surface. Internally it is a swappable backend; to users it is "Goblin-bundled
> models, no key." The two Goblin-named tiers (`goblin/efficient` default,
> `goblin/premium` upsell) map to provider model IDs via env, so the provider
> behind them can change with zero UI change.

---

## Prerequisites

- A wholesale per-token inference account (DeepInfra/Novita-class), efficient
  model-class default. **See the founder setup checklist** in
  `docs/L2_PIVOT_SESSION1_REPORT.md` (account, spend cap, EU endpoint, data policy).
- Access to Railway dashboard (API env vars) and Vercel (frontend flag).
- Supabase migration `0067_goblin_hosted_token_rollup.sql` applied (per-user
  monthly token rollup for the fair-use cap).

---

## Step 1: Provision the wholesale account (~15 min)

1. Open the account, set a **hard $50 spend cap + $25 alert**.
2. Pick the **EU endpoint** where offered.
3. Confirm the data policy is **no-training / zero-retention**.
4. Create an API key. Note the **base URL** (OpenAI-compatible `/v1`) and the
   **model IDs** for an efficient-class coder and (optionally) a premium model.

---

## Step 2: Set Railway environment variables (~5 min)

In Railway dashboard → Goblin API service → Variables:

```
GOBLIN_HOSTED_API=true
GOBLIN_HOSTED_BASE_URL=https://<wholesale-endpoint>/v1
GOBLIN_HOSTED_API_KEY=<server-side wholesale key>      # secret
GOBLIN_HOSTED_MODEL_EFFICIENT=<provider efficient model id>
GOBLIN_HOSTED_MODEL_PREMIUM=<provider premium model id>   # optional
```

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
but `GOBLIN_HOSTED_BASE_URL` / `GOBLIN_HOSTED_API_KEY` is missing.

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
