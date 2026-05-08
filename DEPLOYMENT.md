# Goblin Deployment Checklist

## Vercel Environment Variables (Required)

```
NEXT_PUBLIC_API_URL=https://[your-railway-url]
NEXT_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon key]
NEXT_PUBLIC_APP_URL=https://justgoblin.com
```

> **"Failed to fetch" on project create?** → `NEXT_PUBLIC_API_URL` is missing or wrong in Vercel.
> The app will now show a clear error instead of silently failing.

## Railway Environment Variables (Required)

```
SUPABASE_URL=https://[your-project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[service role key]
ENCRYPTION_KEY=[32-char random key]
STRIPE_PRICE_SEED=[price id]
STRIPE_PRICE_CRAFT=[price id]
STRIPE_PRICE_FORGE=[price id]
ALLOWED_ORIGINS=https://justgoblin.com,https://www.justgoblin.com
PORT=3001
```

Optional:
```
ADMIN_API_KEY=[key]          # enables /api/admin/* routes
GOOGLE_FREE_API_KEY=         # Gemini 2.0 Flash (Layer 2 routing)
GROQ_FREE_API_KEY=           # Llama 3.3 70B
NEXT_PUBLIC_APP_URL=https://justgoblin.com   # included in CORS allowlist
```

## CORS — How It Works

The API (`apps/api/src/index.ts`) allows these origins:
- `http://localhost:3000`
- `https://justgoblin.com` / `https://www.justgoblin.com`
- Any `*.vercel.app` subdomain (covers all Vercel preview deploys)
- Anything in `ALLOWED_ORIGINS` env var (comma-separated)

If you get a CORS error: add the blocked origin to `ALLOWED_ORIGINS` in Railway.

## After Every Deploy

1. Open `justgoblin.com/status` — verify web and API git commits match.
2. Run: `npx tsx scripts/test-project-create.ts` (requires env vars in `.env`).
3. Manual test: log in, create a project, verify redirect to project page.

## Diagnosing "Failed to fetch"

Open browser DevTools → Console when creating a project. You will see:

```
API URL: https://[your-railway-url]   ← should NOT be empty
Has token: true                        ← false = session expired, re-login
```

If `API URL` is empty: set `NEXT_PUBLIC_API_URL` in Vercel → redeploy.
If `Has token: false`: the user session expired — clear cookies and log in again.
If the URL is correct but still fails: check Railway logs for the actual error.
