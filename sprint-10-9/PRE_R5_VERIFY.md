# Pre-R5 Verification & Challenge

Date: 2026-06-04 · Mode: verification only (no features) · Budget ~1h
Method: challenge each prior claim with evidence; disproof = success.

Prod Supabase project reached by local admin creds: `ogrkollxnoawfdkzdmtn.supabase.co`
(confirmed identical in root `.env.local` and `apps/web/.env.local` → this IS prod).
Prod API: `https://goblinapi-production.up.railway.app`.

---

## CHECK 1 — Does prod still point at the dead LiteLLM proxy?

**VERDICT: VINCENT-MUST-CONFIRM** (the critical one — cannot prove from here).

### Routing branch (code, proven)
`apps/api/src/services/model-router.ts`:
- **Line 348–351** — `const litellmBase = process.env.LITELLM_BASE_URL; if (litellmBase) { … litellmStream(route.litellmModel, …) }` → when `LITELLM_BASE_URL` is **SET**, generation is routed through the proxy FIRST.
- **Line 385–394+** — "Direct SDK fallback — the real routing path (OPTION B)". When `LITELLM_BASE_URL` is **UNSET**, the proxy block is skipped entirely and generation goes direct to the provider SDK (Anthropic / OpenAI-compatible).
- **Failure shape if proxy is set but dead** (line 375–382): on proxy error, only `rate_limit` / `provider_down` soft-errors fall through to the direct path. A dead proxy returning 400/404/"model not found" is **not** classified soft → it `throw err` → the generation **hard-fails**. This is exactly the R5 risk.

### Railway value — COULD NOT ACCESS
- `railway` CLI not installed; no `RAILWAY_TOKEN` in env. No repo `railway.toml` carrying the value.
- Local evidence only (NOT prod): root `.env.local` line 84 — `# LITELLM_BASE_URL=litellm-production-6ba8.up.railway.app (wird aktuell nicht mehr verwendet)` → **commented out locally**. `apps/api/.env.example` line 60 also commented. So the *template/local* is unset. **The live Railway service is independently configured and was not inspectable.**
- Note: `LITELLM_MASTER_KEY` + `LITELLM_SALT_KEY` are still present locally, but those alone do **not** trigger proxy routing — only `LITELLM_BASE_URL` does (line 348).

### VINCENT MUST CHECK (2 min)
Railway → `goblinapi` service → Variables → confirm **`LITELLM_BASE_URL` is ABSENT (or empty)**.
- Absent/empty → prod routes **direct** → R5 generation safe. ✅
- Present & pointing at `litellm-production-6ba8…` → R5 generation will hit the **dead proxy** and hard-fail → **remove it before R5.** ❌

---

## CHECK 2 — Are the cron secrets actually set and read?

**VERDICT: FAIL** — the GitHub Actions secrets the cron needs are **NOT set**; the daily refresh + weekly digest have been **silently no-opping**. (Underlying mechanism is healthy — proven below.)

### Wiring match (workflow ↔ code) — CORRECT
`.github/workflows/catalog-cron.yml` posts:
- `POST $GOBLIN_API_URL/api/admin/catalog/refresh?source=cron` with header `x-admin-key: $ADMIN_API_KEY`
- `POST $GOBLIN_API_URL/api/admin/digest/send` with the same header

API side `apps/api/src/routes/admin.ts`:
- Line 9–10 reads `c.req.header('x-admin-key')` and compares to `process.env.ADMIN_API_KEY` ✅
- Line 442 `/catalog/refresh` exists; line 458 `/digest/send` exists ✅
Secret names + endpoint + header **all match**. No mismatch.

### Secret VALUES — ABSENT (disproves "set as far as he knows")
- `gh api repos/vinchafer/Goblin/actions/secrets` → 5 secrets total: `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TEST_ACCOUNT_EMAIL`, `TEST_ACCOUNT_PASSWORD`. **`GOBLIN_API_URL` and `ADMIN_API_KEY` are NOT present.**
- `vinchafer` is a user, not an org → no org-level secrets (404). The workflow uses no `environment:` key, so it reads repo secrets only.
- **Live proof:** the cron ran today (2026-06-04 08:22:33Z), "success" in 7s. Run log quotes verbatim:
  `Secrets GOBLIN_API_URL / ADMIN_API_KEY not set — skipping.` → the guard set `run=false`, both jobs no-op'd. The green check is a skip, not a run.

### Manual trigger — the mechanism itself WORKS (proven against prod)
The endpoint the cron *would* hit is healthy. Triggered once manually (non-destructive; keys are marked, never deleted — `catalog-refresh.ts:151–158`):
```
POST https://goblinapi-production.up.railway.app/api/admin/catalog/refresh?source=manual  → HTTP 200
{ keysChecked:5, keysValidated:3, keysInvalid:2, keysRateLimited:0,
  modelsAdded:48, modelsRemoved:0,
  perProvider:{ groq:{checked:3,added:48}, google:{checked:2,invalid:2} } }
```
`catalog_sync_log` row written (source=manual, added 48, updated 3, deactivated 2); `lastSyncAt` now populated.

### Fix for Vincent
Add two GitHub repo secrets (Settings → Secrets → Actions):
- `GOBLIN_API_URL = https://goblinapi-production.up.railway.app`
- `ADMIN_API_KEY = <same value as Railway's ADMIN_API_KEY>` (the value in root `.env.local` matches prod — confirmed, see Check 3).
Until then the daily catalog refresh never runs (does not block R5 generation, but the model catalog goes stale).

### Side finding (not a check, but R5-relevant)
The manual refresh marked **both google keys INVALID** while **groq validated**. Gemini is still failing provider validation in prod — consistent with the Sprint-9 finding. The default/recommended path should be Groq for R5.

---

## CHECK 3 — Does the admin dashboard actually RENDER for an admin?

**VERDICT: PARTIAL** — render gate PASSES and source mode = OPTION B (proven on live prod); but Vincent's `is_admin` SQL **hit 0 rows**, and data panels couldn't populate in local dev.

### is_admin read-back — SURPRISE: 0 rows affected
Read-only query against prod Supabase (`users`):
- `email=eq.vinc.hafner@gmail.com` → `[]` (**no such row**).
- `is_admin=eq.true` → `[]` (**no admins at all**).
- All `vinc.hafner%` rows: only `vinc.hafner2/3/4@gmail.com`, all `is_admin=false`. Total users in table: **6**.

→ `UPDATE users SET is_admin=TRUE WHERE email='vinc.hafner@gmail.com'` **matched 0 rows** on this prod DB, because **your personal account has no row in `public.users` here.** Either you signed up under a different email, or the row was never created. **R5 implication:** when you open `/admin/catalog` on prod, the `is_admin` gate will NOT let you in — you'll only get through via the `ADMIN_EMAIL` env fallback (`apps/web/app/admin/layout.tsx:21–24`). Set `ADMIN_EMAIL` on the Vercel web project to your login email, OR insert/fix your `users` row, before R5.

### Render — gate PASSES (screenshot: `sprint-10-9/PRE_R5_admin_catalog_render.png`)
Per §2(b) did NOT use your account. Ran web dev locally pointing at prod API, set `ADMIN_EMAIL=vinc.hafner3@gmail.com` (LOCAL only, since reverted), logged in as `vinc.hafner3` via the test-auth magic link, opened `/admin/catalog`:
- Page **did NOT redirect** (no `/dashboard`, no `/login`) — admin layout gate passed via `ADMIN_EMAIL` fallback.
- Admin shell renders: sidebar Health / Users / Models / **Catalog Ops** (active) / Builds / Status.

### Source mode = OPTION B — proven on LIVE prod
`GET https://goblinapi-production.up.railway.app/api/admin/catalog` (HTTP 200) returns:
```
"source":{"mode":"OPTION B","label":"per-user provider-discovery (no LiteLLM proxy)"}
"stats":{"models":14,"available":12,"providers":8}
```
NOT a litellm version. `apps/web/app/admin/catalog/page.tsx:117` renders `data.source.mode` verbatim → the Quelle card will read **OPTION B** for Vincent on prod.

### Panel that couldn't populate locally
In local dev the page showed "Konnte Katalog-Daten nicht laden." The Next.js route-handler proxy (`/api/admin/[...path]`) returned the API's `401 Unauthorized` even though the `ADMIN_API_KEY` I supplied is byte-identical to the one that returns **HTTP 200** via direct `curl` to the same prod endpoint. → a **local turbopack route-handler env quirk** (the handler didn't receive `ADMIN_API_KEY` although the sibling layout received `ADMIN_EMAIL` from the same file). **Not a prod problem** — Railway accepts the key (curl 200). The Sync-Log / Provider-Health / stats panels will populate on prod.
- **Prod-config item:** ensure the **Vercel web project has `ADMIN_API_KEY` set = Railway's**, else the same 401 would surface on prod and the dashboard panels stay empty.

---

## FINAL LINE

**AMBER — R5 can run, but do two things first:**

1. **(CRITICAL, Check 1)** Confirm Railway `goblinapi` has **`LITELLM_BASE_URL` absent/empty**. If present → **RED, do not run R5 until removed** (generation would hit the dead proxy and hard-fail). I could not read the Railway value; this is the one make-or-break I cannot prove for you.
2. **(Check 3)** Set `ADMIN_EMAIL` on the Vercel web project to your real login email (your `users` row / `is_admin` grant did not take — 0 rows), and confirm Vercel web has `ADMIN_API_KEY` = Railway's, so `/admin/catalog` both admits you and populates.

Non-blocking for R5 generation but fix soon (Check 2): add GitHub repo secrets `GOBLIN_API_URL` + `ADMIN_API_KEY` — the daily catalog refresh has never run.

**Answer to the one question — "Will a real R5 generation route to a live provider or the dead proxy?":**
Direct-provider routing (OPTION B) is correct in code and discovery runs direct against prod (proven). Whether *generation* goes direct depends entirely on the **Railway `LITELLM_BASE_URL`** value, which I could not inspect. **Verify that var is unset and the answer is "live provider, safe." That is the single gate left before R5.**
