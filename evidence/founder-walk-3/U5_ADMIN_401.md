# U5 — Admin 401 chain: wiring verified, shared honest 401 state, Health copy calmed

## 1. Wiring verification (code-correct — the 401 is an ENV VALUE mismatch, not a code bug)
Confirmed firsthand, both sides use the SAME env var and the SAME header:

| Side | File:line | Env var | Header |
|---|---|---|---|
| Web admin proxy (injects key) | `apps/web/app/api/admin/[...path]/route.ts:6,48` | `ADMIN_API_KEY` | sends `x-admin-key` |
| API validation | `apps/api/src/routes/admin.ts:14,15,18` | `ADMIN_API_KEY` | reads `x-admin-key` → 401 on mismatch |

The header name and env var name match exactly on both sides — **no silent name drift**. A 401 therefore means the **value** of `ADMIN_API_KEY` on the web service (Vercel) ≠ the value on the API (Railway), or one is unset. The proxy already pre-empts an unset web key with a 500 `admin_key_unconfigured` (`route.ts:36-41`).

## 2. Shared, honest 401 state on EVERY admin page
An empty table / silent-empty list on an auth failure is a false state (Feeling invariant). The Insight 401 copy — which names the `ADMIN_API_KEY` cause — is now the single source (`lib/admin/admin-error.ts` → `adminErrorMessage`) rendered by one component (`components/admin/AdminErrorState.tsx`):

| Page | Before | After |
|---|---|---|
| Insight | rich 401 string (inline) | same string, now from the shared helper |
| Costs (server, direct API) | bare `Error: API 401` | `AdminErrorState` — names the key cause (missing server key → 401 too) |
| Users | silent empty list on load 401 | `loadError` state → `AdminErrorState` |
| Telemetry | generic `Could not load telemetry data.` | 401 → shared actionable copy; non-auth → honest German fallback |
| Models | silent empty table on load 401 | `loadError` state → `AdminErrorState` |

Test: `lib/admin/admin-error.test.ts` (4/4) locks that 401 names `ADMIN_API_KEY`, 403/500/network/unknown degrade distinctly.

## 3. Health "commits differ" — honest and calm
`app/admin/health/page.tsx:138-144` rendered differing short SHAs in **red (`--danger`)**, which read as an alarm for an EXPECTED state (a web-only wave ships a new web commit; the API binary is unchanged). Now: in-sync → calm `--success`; differing → neutral **`--meta`** info with a one-line reason ("unterschiedliche Commits sind bei einem reinen Web-Deploy normal (API-Binary unverändert)") — never red unless a real health signal is.

## Founder env checklist (align `ADMIN_API_KEY` on BOTH platforms)
The 401 is fixed by making the value identical on both services — a founder action (no code change needed):
1. **Railway (API):** Project → the API service → **Variables** → confirm `ADMIN_API_KEY` is set to a strong secret. This is the source of truth.
2. **Vercel (Web):** Project → **Settings → Environment Variables** → set `ADMIN_API_KEY` to the **exact same value** (Production, and Preview if you use admin on previews). It is read server-side only (the proxy + the costs server page) — never exposed to the browser, no `NEXT_PUBLIC_` prefix.
3. **Redeploy the web project** so the new env is picked up (Vercel env changes need a redeploy).
4. Verify: open `/admin/insight` on the test account — data loads, no 401. If it still 401s, the two values differ (check for trailing whitespace / a rotated key on one side only).

## Honest limitation
The shared 401 state and Health copy are verified in code + unit test. The live 401 disappearing is confirmable only once the founder aligns the two env values and redeploys — that's the action above, not something the code can assert.
