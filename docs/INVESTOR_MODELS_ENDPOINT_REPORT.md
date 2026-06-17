# Investor-Gated Model Endpoint + Name Scrub — Report

Date: 2026-06-17. Repo: Goblin (APP). Branch: master. Status: built, green, **NOT
pushed** (awaiting founder approval + the new prod env var).

## 1. User-facing name audit (before → after)
See `docs/MODEL_NAME_AUDIT.md` for the full grep-backed table.

- **Before:** no user surface tied "Goblin Swift/Forge" to its underlying model
  (DeepSeek/Kimi). The two-level-truth design held in the picker, the new
  "Goblin-Modelle" settings area, the `/api/models` catalog, and the SSE stream.
  ONE latent vector: a pre-pivot seed row (migration 0009, "Qwen Coder 32B", slug
  `qwen-coder-32b`, layer `goblin_hosted`) could pass through `getCatalogForUser`
  from the `models` DB cache and reach the browser as a Goblin-tier model carrying
  an underlying open-source name.
- **After:** `GOBLIN_HOSTED_TIERS` is the SOLE source of `goblin_hosted` catalog
  entries; stale DB/static `goblin_hosted` rows are no longer passed through. Grep
  re-run confirms zero underlying-model/provider names on any user-facing or
  client-bound surface (BYOK DeepSeek, the legal /privacy DeepInfra disclosure, and
  server-only config/comments/tests are the only remaining hits — all correct).

`DeepSeek`/`Llama`/`Qwen` still appear as **BYOK providers** (user brings own key) —
that is an intended, separate feature, not a Goblin-tier leak.

## 2. The endpoint contract

**Route:** `GET /api/investor/models`
**Auth:** header `x-investor-token: <INVESTOR_MODELS_TOKEN>` (shared secret, same
mechanism as `/api/admin/*` but a dedicated, narrowly-scoped token — lower blast
radius than the admin key). Missing/wrong token OR unset secret → `401` (fail
closed). Read-only; no mutation.
**Source of truth (HR-3):** `getInvestorModelMapping()` in
`apps/api/src/services/goblin-hosted.ts`, which reads the SAME env-overridable slugs
the router sends to the provider (`GOBLIN_HOSTED_MODEL_*` ?? `DEFAULT_MODEL_*`).
Change the model in that one config → both routing AND this endpoint follow, zero
second copy.
**Never returned:** the wholesale provider name (DeepInfra) and any API key.

**Response shape (200):**
```json
{
  "swift": { "id": "goblin/efficient", "label": "Goblin Swift", "model": "DeepSeek V3.2", "slug": "deepseek-ai/DeepSeek-V3.2", "tierClass": "efficient" },
  "forge": { "id": "goblin/premium",   "label": "Goblin Forge", "model": "Kimi K2.6",     "slug": "moonshotai/Kimi-K2.6",     "tierClass": "premium" }
}
```
`model` is a readable label (`modelDisplayName`); an unknown slug degrades to its
last path segment, humanized.

## 3. How the PITCH session must consume it (server-to-server — HR-4)

Fetch from the pitch's **backend / ISR / route handler** (never the browser bundle),
so the names never ship to the client:

```ts
const res = await fetch(`${process.env.GOBLIN_API_URL}/api/investor/models`, {
  headers: { 'x-investor-token': process.env.INVESTOR_MODELS_TOKEN! },
  // server-side only — Next.js Route Handler / getStaticProps / ISR revalidate
});
const { swift, forge } = await res.json();
```

Env vars to set on the **pitch's Vercel project** (server-side, NOT `NEXT_PUBLIC_*`):
- `GOBLIN_API_URL` = the Goblin API origin (e.g. `https://<railway-app>` or the
  api subdomain used in prod).
- `INVESTOR_MODELS_TOKEN` = the SAME secret value set on Goblin's Railway (below).

Because the call is server-to-server with no `Origin`, there is no browser CORS
exposure. Do not expose this fetch via a public, unauthenticated pitch route.

## 4. New prod env var (HEARTBEAT — founder action)

Set on **Goblin's Railway** (the API), Railway-only:
```
INVESTOR_MODELS_TOKEN=<a long random secret>
```
Until set, `GET /api/investor/models` returns `401` to everyone (fail closed) — safe
default. Set the SAME value on the pitch's Vercel project so the pitch can fetch.
Generate e.g. `openssl rand -hex 32`. Placeholder added to `apps/api/.env.example`.

## 5. Founder verification

After deploy + setting the secret (replace `$API` and `$TOKEN`):
```bash
# Denied without the secret →  {"error":"Unauthorized"}  (401)
curl -i $API/api/investor/models

# Allowed with the secret → 200 + the mapping
curl -s -H "x-investor-token: $TOKEN" $API/api/investor/models | jq
# expect: swift→DeepSeek V3.2 / deepseek-ai/DeepSeek-V3.2, forge→Kimi K2.6 / moonshotai/Kimi-K2.6
```
And in the app (any account): open the model picker + Settings → Goblin-Modelle —
confirm only "Goblin Swift" / "Goblin Forge" appear, no real model name, no provider.

## 6. Tests / build
- API vitest: **184 passed / 0 failed** (incl. new `investor.test.ts` auth-gate +
  no-leak, `goblin-hosted.test.ts` mapping/single-source-of-truth, `catalog.test.ts`
  stale-row leak guard).
- API `tsc --noEmit`: clean.
- No web source changed → no web build needed.
- Secrets absent from tree (only placeholders in `.env.example`).

## 7. Files changed
- `apps/api/src/services/catalog.ts` — goblin_hosted entries come only from the
  single source of truth (leak fix).
- `apps/api/src/services/goblin-hosted.ts` — `modelDisplayName`,
  `getInvestorModelMapping`, `InvestorTierInfo`.
- `apps/api/src/routes/investor.ts` — new auth-gated read-only endpoint.
- `apps/api/src/index.ts` — mount `/api/investor`.
- `apps/api/src/middleware/trial-gate.ts` — skip `/api/investor` (own auth).
- `apps/api/.env.example` — `INVESTOR_MODELS_TOKEN` placeholder + doc.
- Tests: `investor.test.ts` (new), `goblin-hosted.test.ts`, `catalog.test.ts`.
- Docs: `MODEL_NAME_AUDIT.md`, this report.
