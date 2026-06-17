# User-Facing Model-Name Audit (HR-1)

Date: 2026-06-17. Scope: every surface a browser/user can read must show ONLY
"Goblin Swift" / "Goblin Forge" (or generic "Goblin-bundled models") — never the
underlying open-source model (DeepSeek / Kimi / Qwen / Llama …) nor the wholesale
provider (DeepInfra). The tier id `goblin/efficient` / `goblin/premium` is fine; the
provider slug `deepseek-ai/…` / `moonshotai/…` is NOT.

Grep terms: `deepseek`, `DeepSeek`, `kimi`, `Kimi`, `moonshot`, `Moonshot`, `llama`,
`Llama`, `qwen`, `Qwen`, `deepinfra`, `DeepInfra`, slugs `deepseek-ai/`, `moonshotai/`.

## Key distinction

`DeepSeek` (and Llama, Qwen, Mistral, …) appear on user surfaces as **BYOK
providers** — a user can connect their *own* DeepSeek key. That is a separate,
legitimate, intended feature and is NOT a leak. The invariant is narrower: the
**Goblin-bundled tier** must never reveal *its* underlying model. Nothing may tie
"Goblin Swift/Forge" → "DeepSeek/Kimi" on a user surface.

## Classification

### LEGAL — keep (HR-8)
| File:line | Hit | Note |
|---|---|---|
| `apps/web/app/(legal)/privacy/page.tsx:32` | "DeepInfra (United States) — inference for the Goblin-bundled models." | Required sub-processor disclosure. Names the *provider* only (no model name). Explicitly allowed by HR-8. KEEP. |

### USER-FACING — BYOK provider (legitimate, not the Goblin tier) — keep
DeepSeek/Llama/Qwen as a connectable BYOK provider or in benchmark rankings. None
tie the Goblin tier to its underlying model.
| File:line | Hit |
|---|---|
| `apps/web/components/settings/keys-list.tsx:17`, `add-key-modal.tsx`, `ApiKeysPage.tsx`, `ModelsPage.tsx:49-52` (KeysTab), `ProviderKeyForm.tsx`, `app-shell/model-switcher.tsx:13` (PROVIDER_URLS), `onboarding/ProviderLogo.tsx`, `app/welcome/provider/page.tsx`, `app/dashboard/settings/routing/page.tsx:33` | DeepSeek as a BYOK provider option (URL/label/logo). |
| `apps/web/components/landing/sections/TrustedBy.tsx:1`, `landing/sections/Faq.tsx:14`, `landing/faq.tsx:18` | DeepSeek listed among supported BYOK providers; FAQ says Goblin-bundled models are coming. |
| `apps/web/app/welcome/_components/i18n.ts:226,422` | Onboarding copy for the custom/OpenRouter BYOK card: "Llama, Mixtral, Qwen, DeepSeek and more." Describes BYOK reach, not the Goblin tier. |
| `apps/web/lib/model-access.ts:48-51`, `hardware-check.ts:21`, `components/workspace/ChatMessages.tsx:15` | BYOK DeepSeek access label / local-Ollama list / BYOK pricing hint. |
| `apps/api/src/config/providers.ts:143-154`, `seed-models.ts:21`, `config/pricing.ts:19-20`, `routes/models.ts`, `routes/account.ts:567`, `services/support-knowledge.ts:26`, `services/byok-service.ts`, `services/provider-discovery.ts`, `lib/rankings/*` | BYOK DeepSeek provider config / discovery / pricing / support KB / ranking canonicalization. Provider, not the Goblin tier. |

### SERVER-ONLY — the secret mapping (never shipped to the browser) — keep
| File:line | Hit | Note |
|---|---|---|
| `apps/api/src/services/goblin-hosted.ts:50-54` | `Swift → DeepSeek V3.2`, `Forge → Kimi K2.6`, `DEFAULT_MODEL_*` slugs | Single source of truth. Server config + comments. Never in a browser bundle. |
| `apps/api/src/services/model-router.ts` (comments + `apiModel`) | wholesale slug sent on the wire | `apiModel` goes only to the provider; `model`/`modelSlug`/SSE events carry the tier id. Verified. |
| `apps/api/src/lib/goblin-cap.ts:13-16`, `lib/model-pricing.ts:30-36` | COGS comments naming Swift/Forge models | Comments + pricing keyed by tier id; feeds founder telemetry $ only. Never a user surface. |
| `apps/api/src/index.ts:22-24`, `.env.example`, `infra/GOBLIN_HOSTED_ACTIVATION.md`, `docs/*` | env comments / activation runbook / session reports | Operator docs + env, not shipped to users. |
| `apps/api/src/**/*.test.ts` | test assertions incl. `deepseek-ai/…`, `moonshotai/…` | Tests that ASSERT the invariant. Server-only. |

## Findings & actions

1. **No user-facing surface ties the Goblin tier to its underlying model.** The
   model picker (`model-switcher.tsx`) and the new "Goblin-Modelle" settings area
   (`ModelsPage.tsx` `GoblinModelsTab`) show only "Goblin Swift"/"Goblin Forge".
   The catalog (`getCatalogForUser`) emits goblin tiers as `slug: tier.id`,
   `provider: 'goblin'`, `name: tier.name`. The stream `meta`/`done` events emit
   only the tier id (+ `provider:'openai'`, a generic OpenAI-compat label, not
   DeepInfra). The real slug (`apiModel`) is sent ONLY to the provider. **No edit
   needed; verified by tests.**

2. **ONE latent leak vector found + FIXED.** Migration `0009_models_table.sql:30`
   seeds a pre-pivot row `('Qwen Coder 32B', 'qwen-coder-32b', 'goblin',
   'goblin_hosted', …)`. `getCatalogForUser` previously passed through *any*
   `goblin_hosted` row from the `models` DB cache → if that stale row is present in
   prod, the browser would receive a Goblin-tier model named **"Qwen Coder 32B"**.
   **Fix (catalog.ts):** `GOBLIN_HOSTED_TIERS` is now the SOLE source of
   `goblin_hosted` entries; DB/static `goblin_hosted` rows are no longer passed
   through. The leak is impossible regardless of `models`-table contents. Regression
   test added (`catalog.test.ts` — injects the stale Qwen row, asserts it never
   surfaces). Founder may optionally delete the stale prod row; the code fix already
   closes the user-facing exposure without a DB change.

## Conclusion
HR-1 holds. After the catalog fix, no user-reachable or client-bound surface
exposes a real underlying model name or the wholesale provider; the provider remains
only in the legal /privacy sub-processor list. Underlying names live server-side
(config/comments/tests) only.
