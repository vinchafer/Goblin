# Sprint 10.9 — Phase 0 Architecture Gate

**Date:** 2026-06-04
**Decision:** **OPTION B** (no `litellm` npm dep; per-user provider-discovery is the routing source-of-truth)
**Stop-condition (d) — REAL reachable proxy found?** NO. A proxy instance is reachable but is an empty/unconfigured shell that cannot route. Premise of the 10.9 revision **holds**. Proceed with Option B.

---

## CHECK 1 — Routing path: DIRECT (via provider SDKs)

`apps/api/src/services/model-router.ts`:

- `resolveModel()` (`:189`) picks a BYOK key + provider baseURL from
  `config/providers.ts`. No proxy involved in resolution.
- `streamCompletion()` (`:272`) has **two** paths:
  - **Proxy path** (`:308-342`): only runs `if (process.env.LITELLM_BASE_URL)`.
    Calls `litellmStream()` → `POST {base}/chat/completions`.
  - **Direct SDK path** (`:344-373`): the default. Anthropic via
    `@anthropic-ai/sdk` (`new Anthropic({ apiKey })`, `:347`), everything
    else via `openai` SDK with the **provider's own baseURL**
    (`new OpenAI({ apiKey, baseURL: route.baseURL })`, `:361`).

**Finding:** routing is DIRECT to provider APIs. The proxy path is
env-gated and, even when the env var is set, points at a dead proxy
(see below) that 400s every model — a `code:'unknown'` GoblinError
that `:336` *re-throws* rather than falling through. Production must
therefore run with `LITELLM_BASE_URL` **unset** (Groq routing works in
prod per Sprint-9/10 memory; an empty proxy would reject it). Confirmed
DIRECT.

## CHECK 2 — LiteLLM dependency: NOT FOUND → OPTION B

`apps/api/package.json` dependencies + devDependencies (`:15-51`):
no `litellm` package. Present instead: `@anthropic-ai/sdk ^0.27.0`
(`:16`), `openai ^4.52.0` (`:30`). The file `services/litellm-client.ts`
is a hand-written *optional proxy client*, **not** the litellm library;
there is no `node_modules/litellm`, no `model_prices_and_context_window.json`.

**Finding:** no litellm library to update (10.9-1 N/A) and no
`model_cost` map to import (Option C not viable). → **OPTION B**.

## Proxy reachability probe (the decisive stop-(d) test)

`LITELLM_BASE_URL=litellm-production-6ba8.up.railway.app` appears only
in `.env.local` (not `.env.example` as an active value). Probed it:

| Request | Result |
|---|---|
| `GET /` | HTTP 200 (proxy process is up) |
| `GET /health` | HTTP 500 |
| `GET /v1/models` (no auth) | HTTP 200 `{"data":[],"object":"list"}` |
| `GET /v1/models` (master key) | HTTP 200 `{"data":[],"object":"list"}` |
| `GET /model/info` (master key) | HTTP 500 `"LLM Model List not loaded in. Make sure you passed models in your config.yaml"` |
| `POST /chat/completions {model:"groq/llama-3.3-70b-versatile"}` | HTTP 400 `"Invalid model name ... Call /v1/models to view available models for your key."` |

**Conclusion:** a LiteLLM proxy is *deployed* but has **no `model_list`
loaded** — even authenticated with the master key it serves zero models
and cannot route any completion. It is functionally dead. This is NOT a
"real reachable proxy" in the sense of stop-condition (d): no inference
can flow through it. It corroborates the revision premise — the dynamic
`/v1/models` catalog path has never produced anything (empty response →
`syncFromLiteLLM` returns `error: "empty LiteLLM response"` → static
fallback), and routing is direct.

## Branch consequences for the remaining items

- **10.9-A1**: retire the dead `/v1/models` sync in `catalog.ts`
  (no-op it with a clear comment). provider-discovery = routing source.
- **10.9-A2**: `config/providers.ts` static lists become explicitly
  DISPLAY-ONLY (hand-maintained), never a routing source.
- **10.9-1**: **STRIKE** — no litellm dep to auto-update. N/A under Option B.
- **10.9-2**: "Daily Per-User Provider-Discovery Refresh" (re-validate
  keys, refresh `discovered_models`, mark dead keys, don't delete).
- **10.9-3 / -4 / -5 / -6**: unchanged scope; digest/admin content
  reflects "catalog source: per-user discovery" (no litellm-version line).

## Founder follow-up (recommended, not blocking)

- Remove the dead `LITELLM_BASE_URL` line from `.env.local` (it would
  break local chat if the API loads it: every completion would 400/throw).
- Decommission the empty `litellm-production-6ba8.up.railway.app`
  Railway service — it is unhealthy and serves nothing.
