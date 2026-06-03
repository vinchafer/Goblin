# GitHub OAuth — Founder Action (Sprint 10.5 A-S10)

**Symptom (Max-walk, PDF p.28):** connecting GitHub in onboarding Step 5 shows
> "Be careful! redirect_uri is not associated with this application."

## Root cause
Goblin uses a **GitHub OAuth App** (not a GitHub App). An OAuth App has exactly
**one** registered *Authorization callback URL*, and GitHub rejects any
`redirect_uri` that doesn't byte-for-byte match it.

The code sends `redirect_uri` from the Railway env var
`GITHUB_REDIRECT_URI_RAILWAY`. Today there's a mismatch between environments:

| Source | Value |
|--------|-------|
| `.env.local` (`GITHUB_REDIRECT_URI_RAILWAY`) | `https://goblinapi-production.up.railway.app/api/github/callback` |
| `apps/api/.env.example` (comment) | `https://api.justgoblin.com/api/github/callback` |

If the value Railway actually sends ≠ the URL registered on the GitHub OAuth
App, GitHub throws the error above. The callback lives on the **API** (Railway),
not the web app — `GET /api/github/callback` in `apps/api/src/routes/github.ts`.

## Code change already shipped (A-S10)
`apps/api/src/services/github-oauth.ts`:
- `getRedirectUri()` now prefers `GITHUB_REDIRECT_URI_RAILWAY` and **falls back**
  to `${NEXT_PUBLIC_API_URL}/api/github/callback` so a missing var can't send a
  blank/wrong URI.
- `redirect_uri` is URL-encoded in the authorize URL and now also sent on the
  token exchange (so both steps match).

This does NOT fix the registration mismatch — that's a console action below.

## What you must do (pick ONE canonical callback URL)

Recommended canonical (stable custom domain):
```
https://api.justgoblin.com/api/github/callback
```
(or, if you don't run api.justgoblin.com yet, use the Railway URL:
`https://goblinapi-production.up.railway.app/api/github/callback`)

1. **GitHub** → Settings → Developer settings → **OAuth Apps** → your Goblin app
   → set **Authorization callback URL** to the canonical URL above. Save.
2. **Railway** (API service) → Variables → set
   `GITHUB_REDIRECT_URI_RAILWAY` to the **exact same** string. Redeploy.
3. They must match character-for-character (scheme, host, path, no trailing slash).

## Verify
```
# Should 302 to github.com/login/oauth/authorize with redirect_uri = your canonical URL
curl -s -D - -o /dev/null \
  -X POST https://goblinapi-production.up.railway.app/api/github/connect \
  -H "Authorization: Bearer <test-user-jwt>" -H "Content-Type: application/json" \
  -d '{"returnTo":"/welcome/integrations"}'
# Inspect the returned authorize URL's redirect_uri param; open it — no
# "redirect_uri is not associated" banner means it's aligned.
```

Note: an OAuth App allows only one callback URL. If you need both
`api.justgoblin.com` and the Railway URL to work (e.g. preview deploys),
migrate to a **GitHub App** (multiple callback URLs) — out of scope for 10.5.
