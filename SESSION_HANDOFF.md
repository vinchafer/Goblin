# Session Handoff — after Sprint 10.9 (2026-06-04)

## State
Sprint 10.9 complete: 8 items done (10.9-1 STRUCK as N/A), 8 atomic commits
(`134f114` → `40dcd6f`). typecheck (api+web+shared) green. Prod build green.
CDP-verified the auth-gated surfaces (login, ModelPicker, admin deny-path).

## The correction this sprint made
Phase 0 gate **disproved** the 10.8 assumption of a LiteLLM proxy. Reality
(`sprint-10-9/PHASE_0_GATE.md`): routing is **direct to provider SDKs**, there is
**no `litellm` npm dep**, and the proxy instance referenced in `.env.local`
(`litellm-production-6ba8.up.railway.app`) is an **empty/unconfigured shell**
(`/v1/models` empty even with master key, `/model/info` 500, every
`/chat/completions` → 400). → **OPTION B**: per-user provider-discovery is the
routing source-of-truth.

## What shipped
- **Catalog reality-check**: dead `/v1/models` sync retired (no-op); hard slug
  rule locked at the routing call site; `config/providers.ts` formalised as the
  DISPLAY-ONLY list.
- **Daily refresh** (10.9-2): per-user provider-discovery re-validation; invalid
  keys marked + surfaced in Settings (never deleted); rate-limit back-off.
- **Provider health + circuit breaker** (10.9-3): rolling-window error rate,
  auto-reroute to the user's fallback chain, "INSTABIL" ModelPicker badge,
  slug-failure flagging.
- **Weekly founder digest** (10.9-4): Discord (file fallback), branch-aware.
- **/admin/catalog dashboard** (10.9-5): ops view + manual triggers; session
  `is_admin` gate + `ADMIN_EMAIL` fallback.
- **Vercel zero-config** (10.9-6): disable SSO protection on the Goblin-created
  project via the user's token; graceful manual fallback; public/manual UX.

## Founder actions (priority order)
1. Apply migrations `0062` / `0063` / `0064` (idempotent, Supabase Studio).
2. Cron secrets `GOBLIN_API_URL` + `ADMIN_API_KEY` — `sprint-10-9/RAILWAY_CRON_SETUP.md`.
3. `DISCORD_OPS_WEBHOOK_URL` — `sprint-10-9/DISCORD_WEBHOOK_SETUP.md`.
4. `UPDATE users SET is_admin=TRUE WHERE email='vinc.hafner@gmail.com'` — `sprint-10-9/ADMIN_USER_SETUP.md`.
5. **Remove the dead `LITELLM_BASE_URL` line from `.env.local`** and decommission
   the empty Railway proxy (it would 400 every local generation if loaded).
6. iPhone Max-walk Round 5: confirm a real generation routes + a publish gives a
   public URL (Vercel 10.9-6 live PATCH was code/build-verified only — CORS/scope
   wall blocks a localhost live test).

## Verification done / deferred
- Done (CDP/build/probe): Phase-0 proxy probe, prod build, typecheck (all),
  ModelPicker catalog renders (Groq), /admin/catalog deny-path redirect,
  `/api/models/health` live (401).
- Deferred to founder (env/CORS/scope-bound): live generation no-regression
  (local confounded by dead-proxy env), live Vercel SSO-disable PATCH=200, live
  provider-degrade breaker test, Discord webhook delivery.
