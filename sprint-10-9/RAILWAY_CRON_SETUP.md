# Sprint 10.9 — Cron Setup (Founder action)

Railway has no native cron, so scheduled ops run via **GitHub Actions**
(`.github/workflows/catalog-cron.yml` + the digest schedule added in 10.9-4).
Each scheduled job calls a Goblin API admin endpoint with the admin key.

## One-time setup

Add two **repository secrets** (GitHub → Settings → Secrets and variables →
Actions → New repository secret):

| Secret | Value |
|---|---|
| `GOBLIN_API_URL` | Production API base, no trailing slash — e.g. `https://api.goblin.app` (the Railway API domain) |
| `ADMIN_API_KEY` | Must equal the API's `ADMIN_API_KEY` env var (the same key the admin panel uses) |

That's it. The workflows guard on these secrets and **no-op** (green) if they
are unset, so nothing breaks before you configure them.

## Schedules

| When (UTC) | Job | Endpoint |
|---|---|---|
| Daily 04:00 | Per-user provider-discovery refresh | `POST /api/admin/catalog/refresh?source=cron` |
| Mon 09:00 | Founder weekly digest (10.9-4) | `POST /api/admin/digest/send` |

## Manual trigger

GitHub → Actions → "Catalog Ops Cron" → Run workflow. Or hit the endpoint
directly: `curl -X POST "$GOBLIN_API_URL/api/admin/catalog/refresh?source=manual" -H "x-admin-key: $ADMIN_API_KEY"`.

## Cadence note (Option B load)

The daily refresh re-validates every active LLM key against its provider's
`/models`. Requests are staggered (~150 ms) and a provider that returns 429 is
backed off for the rest of the cycle. At current scale (beta) this is light. If
it ever gets heavy, widen the cron to every-other-day (`0 4 */2 * *`) — the
refresh itself is idempotent.
