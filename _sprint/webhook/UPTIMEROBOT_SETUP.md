# WH4 — External uptime monitor (founder-todo)

`GET /health` returns **200** (verified — `apps/api/src/routes/health.ts:9`, runtime-checked
in this sprint). It is a cheap liveness probe: no auth, no DB dependency on the root path
(the DB/storage/LiteLLM checks live on `/health/deep`, which can 503 — do NOT point the
uptime monitor at `/deep`, only at the root `/health`).

Wiring an **external** monitor closes the ticket-#12 blind spot: "Railway down and nobody
knows". This cannot be self-created from CI (account creation needs the founder), so here
are the exact steps.

## UptimeRobot (free tier — 50 monitors, 5-min interval)

1. Sign in at https://uptimerobot.com (free account).
2. **+ Add New Monitor**
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** `Goblin API /health`
   - **URL (or IP):** `https://<PROD-API-HOST>/health`
     - Production API host = the Railway API domain (the one `/api/version` answers on),
       NOT the Vercel web host. Confirm by hitting `https://<host>/health` → expect
       `{"status":"ok",...}` 200.
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
- `/health` 200: **DONE** (in-repo, verified).
- External monitor: **FOUNDER-TODO** — no account was created by CC (credentials are the
  founder's). ~3 minutes following the steps above.
