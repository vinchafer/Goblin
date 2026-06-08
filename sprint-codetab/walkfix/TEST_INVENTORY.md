# TEST_INVENTORY — Phase 5 (recon only, no tests built this pass)

Date: 2026-06-08. Goal: confirm what coverage exists so the NEXT pass extends it to
the build loop.

## Playwright E2E — `tests/e2e/` (41 spec files)
Tag distribution (test-level `{ tag }`):
- `@public`  — 16  (no auth; landing, pricing, footer, static, hydration)
- `@auth`    —  7  (logged-in via test-auth magic link; dashboard, mobile)
- `@local-only` — 22 (need a provisioned project + live model/keys; the real flows)

`playwright.config` projects: `public-desktop`, `public-mobile` (grep `@public`),
`auth-desktop`, `auth-mobile` (grep `@auth`), `local-only` (grep `@local-only`),
plus generic `chromium` / `mobile-chrome`.

### Auth harness — `tests/e2e/helpers/auth.ts`
- `loginAsTestUser(page)` → `POST {BASE_URL}/api/test-auth` (token-guarded:
  `TEST_AUTH_TOKEN`, default `goblin-playwright-test-token-2026`). Returns
  `{ email, userId, projectId, magicLink }` — i.e. the test-auth route ALSO
  provisions a project id. Login completes via Supabase magic link →
  `/auth/magic-callback`. Device-aware (desktop/mobile shells).
- Cleanup: `DELETE /api/test-auth/projects`.

### vitest unit — `apps/api/src/__tests__/`
- `encryption.test.ts`, `pricing.test.ts`, `pricing-calculations.test.ts`,
  `dev-guard.test.ts` (+ model-router/usage where present).
- **Status now: GREEN — 5 files / 70 tests passed** (ran this pass).

### CI — `.github/workflows/`
- `ci.yml`, `e2e.yml`, `performance.yml`, `catalog-cron.yml`.

## Does ANYTHING cover the BUILD FLOW (chat → STC → edit → apply → save → deploy)?
**Closest:** `full-flow-sprint7.spec.ts` (`@local-only`):
- ✅ "prompt in Code Tab streams code into the editor as a draft"
- ✅ "Sichern promotes draft → Gesichert, then Veröffentlichen unlocks" — but this
  asserts only that the **confirm dialog appears** (`text=/Veröffentlichen\?/`). It
  does NOT trigger a real deploy and does NOT verify the deployed page reflects the
  edit.
- ✅ "second session parallel + Send-to-Code picker"
Other STC-adjacent: `11-send-to-code`, `12-multi-block`, `10-streaming` (drafts /
streaming surface), `16-github` (connect surface).

### THE GAP (what the next pass must build)
Nothing asserts the **lost-edit P0 path**:
> edit an existing file → Übernehmen → Sichern → Veröffentlichen → open the live URL
> → the edit IS live.

Specifically uncovered:
1. The parseCodeBlocks **language-default retarget** (WALKFIX-1) — no test feeds an
   unnamed code block against an open file and asserts the draft lands on
   `activePath`, not a sibling. (Unit-testable cheaply against
   `apps/api/src/lib/parse-code-blocks.ts` + the `/messages` retarget.)
2. `/save` actually uploads the applied draft to S3 (the path it deploys from).
3. `/deploy` ships the saved content (end-to-end, `@local-only`, needs the
   provisioned test project + a Vercel token on the test account).

The `@local-only` specs already have the provisioning primitive (`/api/test-auth`
returns a `projectId`), so the next pass can:
- add a **unit** test for the retarget (no infra), and
- extend `full-flow-sprint7` to drive a real Sichern→Veröffentlichen and assert the
  deployed/preview content contains the edit marker.

No tests were written this pass (recon only, per Phase 5).
