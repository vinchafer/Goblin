# WH4 — External uptime monitor (founder-todo)

`GET /health` returns **200** (verified — `apps/api/src/routes/health.ts:9`, runtime-checked
in this sprint). It is a cheap liveness probe: no auth, no DB dependency on the root path
(the DB/storage/LiteLLM checks live on `/health/deep`, which can 503 — do NOT point the
uptime monitor at `/deep`, only at the root `/health`).

## Canonical health URLs (FW2 F-35 — verified 2026-07-13)
Health is now dual-mounted (`apps/api/src/index.ts` — `/health` **and** `/api/health`),
because the primary domain rewrites ONLY `/api/*` to the Railway API:

| URL | Reaches | Status |
| --- | --- | --- |
| `https://www.justgoblin.com/api/health` | Railway `/api/health` via the Vercel rewrite | **canonical public** — `{"status":"ok"}` after this deploy |
| `https://www.justgoblin.com/api/health/deep` | Railway `/api/health/deep` | deep check (can 503) — do NOT monitor |
| `https://goblinapi-production.up.railway.app/health` | Railway origin directly | already-live liveness probe |

Diagnosis evidence (pre-deploy, 2026-07-13): Railway origin `/health` → **200 ok**, but
Railway `/api/health` → **404** and `www.justgoblin.com/api/health` → **404** (the exact
path the rewrite forwards to). The dual-mount fixes the public path. `justgoblin.com`
307-redirects to `www.justgoblin.com` — monitor the **www** host.

Wiring an **external** monitor closes the ticket-#12 blind spot: "Railway down and nobody
knows". This cannot be self-created from CI (account creation needs the founder), so here
are the exact steps.

## UptimeRobot (free tier — 50 monitors, 5-min interval)

1. Sign in at https://uptimerobot.com (free account).
2. **+ Add New Monitor**
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** `Goblin API /health`
   - **URL (or IP):** `https://www.justgoblin.com/api/health` (canonical public path)
     - Or, to probe the origin directly (bypassing Vercel): the Railway API domain
       `https://goblinapi-production.up.railway.app/health`. Confirm either → expect
       `{"status":"ok",...}` 200. Do NOT monitor the Vercel web host root for API health.
   - **Monitoring Interval:** 5 minutes (free-tier minimum)
3. **Advanced / Assertion (optional but recommended):**
   - Keyword monitoring → Keyword type: **exists**, Keyword: `ok` → alerts if the body
     stops containing `"status":"ok"` even when TCP is up.
4. **Alert Contacts:** add the founder's email (and optionally a phone/Slack/Telegram
   integration). Attach it to this monitor.
5. Save. Confirm the first check goes green within ~5 min.

## Optional second monitor (recommended)
Add the same for the **web** host root (`https://justgoblin.com`) so a Vercel outage is
also caught. Same steps, HTTP(s), 5-min interval.

## Status
- `/health` 200 (Railway origin): **DONE** (in-repo, verified — curl 200 `{"status":"ok"}`).
- `/api/health` on the primary domain: **FIXED (FW2 F-35)** — dual-mount lands the public path;
  founder confirms with `curl https://www.justgoblin.com/api/health` after this deploy.
- External monitor: **FOUNDER-TODO** — no account was created by CC (credentials are the
  founder's). ~3 minutes following the steps above.
