# Vercel deploy URL 404 — note (Sprint 10.5 B-S5)

**Symptom (Max-walk, PDF p.10):** deploy succeeds (project visible in Vercel
dashboard) but "Öffnen" and "Kopieren" both 404 on `*.vercel.app`.

## Code fix shipped
`apps/api/src/services/vercel-service.ts` now prefers the deployment's
**production alias** (`<project>.vercel.app`) over the deployment-unique hash
URL for both `createDeployment` and `getDeployStatus`, and logs what Vercel
returns (`[vercel] deployment created/status …`). Both "Öffnen" and "Kopieren"
read the same stored `projects.preview_url`, so they now point at the canonical
alias.

## Likely remaining cause — verify in Vercel
A production deployment whose clean URL still 404s / bounces to a Vercel login
is almost always **Deployment Protection** (Vercel Authentication / Password)
being ON. With it on, every `*.vercel.app` URL requires a logged-in Vercel
session → an anonymous visitor (or Max on his phone) sees 404 / SSO.

Founder check, per Vercel project (or team default):
- Vercel → Project → **Settings → Deployment Protection** → set **Vercel
  Authentication = Disabled** for Production (and Preview if you want preview
  URLs public).
- Re-deploy a test project from Goblin, then open the logged URL anonymously
  (incognito). It should load without a Vercel login.

After the next live deploy, check Railway logs for the `[vercel] deployment
created` line to confirm `canonical` is the clean alias.
