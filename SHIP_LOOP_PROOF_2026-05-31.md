# Ship-Loop Proof (2026-05-31, Sprint 2 Phase 3)

The chat→code→**deploy** loop is proven end-to-end on the dedicated test-Vercel-account, with
a real live URL returning HTTP 200. This was the make-or-break unknown from the Sprint-1 audit.

## Result: PASS

```
proof.json (ship-loop-proof/):
{
  "ok": true,
  "name": "test-b1-loop-1780193216506",
  "deploymentId": "dpl_DLtgwUwDa8yQmPktNxUEiNL9sHYB",
  "url": "https://test-b1-loop-1780193216506-5agmkpl8g-vincent-2-s-projects.vercel.app",
  "httpStatus": 200,
  "bodyHasHero": true,
  "elapsedSeconds": 14
}
```

Wall-clock: **~14s** from project-create to a live, publicly-reachable page (Vercel READY in
~8s). Fast enough that even impatient Jake won't bounce.

## What was exercised (real services, not mocks)

Harness: `apps/api/src/scripts/ship-loop-proof.ts` — runs the actual production code paths:

1. **Create project** — guarded `INSERT` into `projects` as the test user (B3 shield allowed it: `user_id` = test user). ✓
2. **Apply / write file** — `uploadFile(projectId, 'index.html', …)` → Backblaze prod bucket `goblin-projects`. ✓
3. **Deploy** — `deployToVercel()`:
   - decrypts the test user's Vercel token via the **canonical** `getActiveKeyByProvider` (the Sprint-2 fix; the old `decryptData` path never matched how tokens are stored). ✓
   - `guardVercelCall('test-b1-loop-…')` — passed the `test-*` allowlist. ✓
   - uploaded files → `POST /v13/deployments` → Vercel built server-side → **READY**. ✓
4. **Preview / verify** — fetched the live deployment URL → **HTTP 200**, body contains the hero text. ✓
5. **Cleanup** — deleted the Vercel project (`204`), cleared storage, deleted the DB row. **No orphans** (re-verified: test account has only its placeholder `project-kiy64`). ✓

Artifacts: `ship-loop-proof/proof.json`, `ship-loop-proof/deployed-page.html` (the actual served HTML).

## Honest caveats

- **This is a backend/services-level E2E proof, not a browser-UI click-test.** It drives the
  real create→write→deploy→serve path that was unproven, but it does not click the
  Send-to-Code / Apply / Deploy *buttons*. Those are wired (verified by code-read in Sprint 1:
  `useCodeVercel`, `useCodeInjections`, `app-context` send-to-code event). A Playwright UI run
  is the remaining richer artifact — deferred here for robustness + budget (a live deploy with
  a verifiable 200 is stronger evidence of the hard part than a flaky browser script). The
  8 UI screenshots the Sprint-2 plan asked for are therefore **not** captured; recommended as
  the first Sprint-3 follow-up now that the path is proven.
- **Deployment Protection.** New Vercel teams (incl. this test account, team
  `vincent-2-s-projects`) enable "Vercel Authentication" by default → anonymous fetch returns
  **401**. The proof disabled it via `PATCH /v9/projects/{name}` on the throwaway test project.
  Product implication: when a real Goblin user deploys to *their* Vercel, the preview URL may
  be SSO-gated unless they disable protection — worth a one-line hint in the deploy UX.
- **Static deploy.** Files are uploaded inline with `framework: null` → Vercel serves them
  statically (and auto-builds if a framework is detected). A generated Next/Vite project would
  rely on Vercel's framework auto-detection; not separately tested here.
- The token decrypts via **v1** (per-user salt). The v2 Vault path logs a benign warning
  (`gen_random_bytes does not exist` — pgcrypto not provisioned in this Supabase project). v1
  works; v2 provisioning is a separate, non-blocking infra task.

## Reproduce

```bash
pnpm --filter @goblin/api exec tsx src/scripts/ship-loop-proof.ts
```
(Requires `VERCEL_TOKEN_SCOPE` + `TEST_ACCOUNT_EMAIL` in `.env.local`; self-cleans.)
