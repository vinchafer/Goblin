# Sprint 10.6-3 — Vercel Canonical URL Trace

Date: 2026-06-03

## What Vercel returns
`POST https://api.vercel.com/v13/deployments` (`vercel-service.ts:deployToVercel`)
responds with `{ id, url, alias?: string[] }`:
- `url` — the build-unique host `<name>-<hash>.vercel.app`.
- `alias[0]` — the stable production alias `<project>.vercel.app`, assigned
  **asynchronously after the deployment reaches READY**. At creation time `alias`
  is almost always **empty**.

We deploy with `target: 'production'` (`vercel-service.ts:86`), so a production
alias *will* be assigned — just not by the time the create call returns.

## URL selection (B-S5, already in code)
Both `deployToVercel` and `getDeployStatus` compute:
```
canonical = (alias?.length > 0) ? alias[0] : url
return `https://${canonical}`
```
Correct preference order. Server logs every choice:
`[vercel] deployment created {id,url,alias,canonical}` and
`[vercel] deployment status {id,state,url,alias,canonical}` → visible in Railway
logs (this is the deploy-debug surface the founder can read for the next months;
no extra UI toggle was added to keep the user-facing surface clean).

## The gap 10.6-3 fixes
`deployToVercel` returns at **creation** time → `alias` empty → it returned the
**hash URL**. `getDeployStatus` (which *does* resolve the alias) was only exposed on
a separate `GET …/status` endpoint that the frontend (`useCodeVercel`) never polled.
Net effect:
- The canonical alias logic in `getDeployStatus` was effectively dead for the main
  deploy path.
- A fresh hash URL can return 404 while the deployment is still BUILDING.

### Fix (`routes/deploy.ts`)
After `deployToVercel`, poll `getDeployStatus` every 3 s (max 90 s) inside the SSE
stream until `state === 'READY'`, surfacing `Status: …` progress. Use the final
status URL (canonical alias once assigned) as the persisted `preview_url`, the push
notification body, and the `success` event URL. Falls back to the hash URL on
timeout; throws on ERROR/CANCELED.

Result: "Öffnen"/"Kopieren" now point at the canonical, READY, 200-answering URL.

## Relationship to the original 404
Vincent's "Öffnen → 404" was **primarily** the broken file structure (no valid
index.html at root) — fixed in 10.6-2. 10.6-3 removes the second-order risk: a
still-building or non-canonical URL. With both, a Send-to-Code → deploy now lands on
a live page.

## Founder live-verify (Max-walk)
- [ ] Deploy a multi-file project (post-10.6-2). Watch Railway logs for the
      `[vercel] deployment status` lines climbing to `state: READY` with a non-null
      `alias`.
- [ ] The "LIVE/Öffnen" URL shown is `<project>.vercel.app` (alias), returns 200,
      renders the landing page with CSS applied.
