# Sprint 10.9 — COMPLETE (2026-06-04)

**Catalog Reality-Check + Auto-Sync + Vercel Zero-Config.**
Branch (Phase 0 gate): **OPTION B** — no `litellm` npm dep; routing is direct to
provider SDKs; the deployed LiteLLM proxy is an empty/unconfigured shell.

8 atomic commits (`134f114` → `40dcd6f`). typecheck PASS (api + web + shared),
prod build PASS. No routing-logic regression (additive instrumentation only).

---

## Per-item — honest code-verified vs founder-verified split

### 10.9-0 — Architecture gate ✅ (code + live-probe verified)
Read model-router / litellm-client / catalog / provider-discovery / package.json.
Probed `litellm-production-6ba8.up.railway.app`: reachable but `/v1/models` empty
**even with the master key**, `/model/info` → 500 *"LLM Model List not loaded in"*,
every `/chat/completions` → 400 *"Invalid model name"*. Functionally dead → no
real proxy → stop-(d) does NOT fire. Branch = OPTION B. Evidence:
`sprint-10-9/PHASE_0_GATE.md`, `ARCHITECTURE_CORRECTION_2026-06-04.md`.

### 10.9-A1 — Retire dead `/v1/models` proxy path ✅ (code + CDP verified)
`syncFromLiteLLM` / `scheduleBootSync` reduced to documented no-ops. Hard slug
rule locked with a comment at the routing call site. `getCatalogForUser`
unchanged in shape — already returns discovered ids verbatim (bare id → display
slug `prefix/id` → routing strips prefix back to the same bare id). Slug-audit
grep: no new hardcoded routing slugs. **CDP:** logged in as vinc.hafner3,
ModelPicker shows **Llama 3.3 70B (Groq)** selected and the full catalog (BYOK +
Llama + Claude + Gemini) — no regression. `verify-modelpicker-open.png`.

### 10.9-A2 — Hand-maintained DISPLAY-ONLY list ✅ (code verified)
`config/providers.ts` model arrays formalised as the curated display list
(distinct from provider routing metadata); stale "fallback when LiteLLM
unreachable" header replaced.

### 10.9-1 — Weekly litellm dep auto-update 🚫 STRUCK (N/A under Option B)
No `litellm` library exists to update. Documented in the gate; no cron created.

### 10.9-2 — Daily per-user provider-discovery refresh ✅ (code verified; founder-verify cron)
`refreshAllUserDiscovery()` re-validates every active LLM key against its
provider's `/models`, refreshes `discovered_models` + `last_validated_at`,
records `last_validation_result`. Non-destructive: invalid key → marked + Settings
badge "Key ungültig — bitte prüfen", never deleted. Rate-limit → back off the
provider for the cycle (not marked invalid). `discoverModelsDetailed()` returns
provider HTTP outcome. admin `POST /catalog/refresh` + `/catalog/sync` alias. GH
Actions daily 04:00 UTC. migration 0062. **Founder:** apply 0062, set cron
secrets (`RAILWAY_CRON_SETUP.md`), run once + inspect `catalog_sync_log`.

### 10.9-3 — Provider health + circuit breaker ✅ (code + CDP plumbing verified)
`provider-health.ts`: rolling-window (5min, env-tunable) error rate; degrade
>10%@>10vol, recover <5%; transitions → `provider_health_events`. model-router
records every outcome (litellm + direct); a discovery slug the provider rejects
as model-not-found is a provider error AND a flagged suspect slug. Conservative
fallback reroute to a healthy provider in the user's chain (no-op when healthy).
`GET /api/models/health` (live: 401 unauth) → ModelSwitcher "INSTABIL" badge (no
false positive observed). migration 0063. **Founder:** apply 0063; live degrade
test (mock a provider error) on prod.

### 10.9-4 — Weekly founder digest ✅ (code verified; founder-verify Discord)
`digest.ts` composes week range, catalog source = per-user discovery (no
litellm-version line), catalog changes, per-provider incidents + minutes
degraded, slug-failures, action-required. Posts to `DISCORD_OPS_WEBHOOK_URL`;
unset/fail → writes `sprint-10-9/digest-<date>.md`. admin `POST /digest/send`
(`?test=1`). Monday 09:00 UTC job. **Founder:** create webhook
(`DISCORD_WEBHOOK_SETUP.md`), run test digest.

### 10.9-5 — `/admin/catalog` dashboard ✅ (code + CDP deny-path verified)
`GET /api/admin/catalog` aggregates source mode, last sync, model/provider
stats, recent sync log, live health + 24h events, suspect slugs. Web page +
nav link + manual triggers (Refresh now, Send test digest). Session `is_admin`
gating via existing layout + `/api/admin` proxy, plus `ADMIN_EMAIL` env fallback
(§7c) on both. **CDP:** vinc.hafner3 (non-admin) → `/admin/catalog` redirects to
`/dashboard` (deny path confirmed). migration 0064 + `ADMIN_USER_SETUP.md`.
**Founder:** apply 0064, `UPDATE users SET is_admin=TRUE`, verify the admin
render (or set `ADMIN_EMAIL` temporarily).

### 10.9-6 — Vercel zero-config publish ✅ (code + build verified; founder-verify live)
After deploy, `disableDeploymentProtection()` PATCHes `/v9/projects/{name}
{ssoProtection:null}` with the user's token; §7f scope handling (personal →
team). Never fails the deploy: `protection:'public'|'manual'`. Deploy SSE carries
it; UI shows "· öffentlich erreichbar" or the one-time "Only Preview Deployments"
instruction. Dev-shield guards the PATCH. Transparency line in Settings →
Konnektoren → Vercel. **Founder/me-deferred:** a real PATCH=200 + public-alias
check needs the `vinchafner2-1996` token and a live deploy (CORS/scope wall on
localhost) — not exercised here; verify on the iPhone Max-walk.

---

## Phase F — self-test

- typecheck: **PASS** (api via `tsc --noEmit`; web + shared via `pnpm typecheck`).
- prod build: **PASS** (`pnpm build`, exit 0; `/admin/catalog` page.js emitted).
- No routing regression: direct-SDK routing logic **unchanged**; only additive
  `recordOutcome()` + a fallback that no-ops when all providers healthy. A *local*
  generation is confounded by the dead `LITELLM_BASE_URL` in `.env.local` (the API
  loads root `.env.local`; the empty proxy 400s every model and the error
  re-throws) — this is a pre-existing local-env issue, documented as a founder
  follow-up, NOT introduced here. Prod (proxy unset) routes direct as before.
- CDP (localhost:3000, vinc.hafner3): ModelPicker catalog ✅, admin deny ✅,
  health endpoint live ✅. Screenshots in `sprint-10-9/`.

## Migrations (idempotent — founder applies in Supabase Studio)
- `0062_catalog_sync_log.sql` — catalog_sync_log + byok_keys.last_validation_result
- `0063_provider_health_events.sql`
- `0064_users_is_admin.sql`

## Founder action checklist
1. Apply migrations 0062 / 0063 / 0064.
2. Cron secrets `GOBLIN_API_URL` + `ADMIN_API_KEY` (`RAILWAY_CRON_SETUP.md`).
3. `DISCORD_OPS_WEBHOOK_URL` (`DISCORD_WEBHOOK_SETUP.md`).
4. `UPDATE users SET is_admin=TRUE WHERE email='vinc.hafner@gmail.com'`.
5. Remove the dead `LITELLM_BASE_URL` from `.env.local`; decommission the empty
   Railway proxy.
6. iPhone Max-walk Round 5 — confirm a real generation routes + a publish yields a
   public URL.
