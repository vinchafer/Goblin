# Vercel "Öffnen" 404 — Root Cause & Founder Action (10.8-9)

## Root cause (confirmed in code, not a guess)
Vincent's hypothesis ("Goblin sendet vielleicht Auth-Token mit") is **wrong** —
Goblin never appends a token to the URL. The real cause:

`deployToVercel` (apps/api/src/services/vercel-service.ts) returned the URL from
the **POST /v13/deployments** response. At that moment Vercel has only assigned
the **deployment hash URL**:

    https://<project>-<random-hash>-<scope>.vercel.app

That hash/preview URL is exactly what **Vercel Deployment Protection** (a.k.a.
"Vercel Authentication") gates behind SSO → the login wall, then a 404 for anyone
who isn't a member of Vincent's Vercel team. The B-S5 "prefer alias" fix never
fired because `data.alias` is **empty at POST time** — the public production alias
(`<project>.vercel.app`) is only assigned once the deployment reaches READY.

## Fix shipped this sprint
- `deployToVercel` now **polls** the deployment (up to ~24s) until the production
  alias appears, and returns that public alias instead of the protected hash URL.
- `pickProductionAlias()` chooses the short, public `<project>.vercel.app`
  (or a custom domain) and **never** a hash URL.
- `?debug=1` on the Code-Tab surfaces both URLs (alias vs deployment) so any
  future failure can be diagnosed by copying each candidate.

After this, "Öffnen" goes to the production alias, which is **public by default**
on Hobby/Pro (Standard Protection gates *preview* deployments only).

## Founder action — ONLY if it still 404s after this fix
Deployment Protection can be set to **"All Deployments"** (protects production too)
or **"Only Preview Deployments"** (default). If Vincent enabled "All Deployments"
on his Vercel account, even the production alias asks for SSO.

Check + fix on the Vercel account that owns the deploy token:
1. Vercel Dashboard → Project → **Settings → Deployment Protection**
2. **Vercel Authentication**: set to **"Only Preview Deployments"** (or Off)
   for the projects Goblin creates.
3. Production alias `<project>.vercel.app` is then public; "Öffnen" resolves.

Goblin cannot toggle this via API without an admin-scoped token + extra scopes,
so it's documented here rather than automated. The Vercel-Ownership onboarding
copy (10.7-11) is the place to mention it to end users too.

## To verify after next deploy
- Deploy a project, watch API logs for `[vercel] deployment created` →
  `returned` should be the short `<project>.vercel.app`, not the hash URL.
- Click "Öffnen" → live page, no SSO/404.
- If it still walls: open with `?debug=1`, copy both URLs, confirm which one
  walls → almost certainly Deployment Protection = All Deployments.
