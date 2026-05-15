# Goblin E2E Tests

Playwright tests live here. Single root setup — `playwright.config.ts` in repo root, tests in `tests/e2e/`.

## Run locally

```bash
# All tests, both projects (chromium + mobile-chrome)
pnpm test

# UI mode for debugging
pnpm test:ui

# Production target (deployed)
pnpm test:prod

# Specific file
pnpm test tests/e2e/19-mobile-create-project.spec.ts

# Specific project (viewport)
pnpm test --project=mobile-chrome
pnpm test --project=chromium

# HTML report after run
pnpm test:report
```

`pnpm dev` should be running on `localhost:3000`, OR Playwright will auto-start it via `webServer` config (slower first run).

## Required ENV vars (`.env` in root)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...     # admin API for magic-link generation
TEST_ACCOUNT_EMAIL=...            # real seeded test account
TEST_ACCOUNT_PASSWORD=...         # for password-flow tests only
NEXT_PUBLIC_API_URL=...           # Hono API base (e.g. http://localhost:8787)
```

`SUPABASE_SERVICE_ROLE_KEY` is required for the magic-link helper (`loginAsRealTestUser`) to bypass email delivery in tests.

## Auth helpers (`helpers/auth.ts`)

| Helper | Use for |
|---|---|
| `loginAsRealTestUser(page)` | **Default.** Generates magic link via Supabase Admin API, navigates to `/auth/magic-callback`, lands on `/dashboard`. Works local + prod. |
| `loginViaPasswordUI(page)` | Only when testing the password-login UI itself. |
| `loginAsTestUser(page, opts)` | Disposable test users via `/api/test-auth` route (route may not exist — fallback to `loginAsRealTestUser`). |
| `dismissTour(page)` | Closes FirstRunTour modal if it appears. |
| `openFirstProject(page)` | Navigates `/dashboard`, clicks first `.project-row`, returns projectId. Auto-creates a project if none exist. |
| `cleanupTestProjects(page)` | Removes projects with `[E2E-TEST]` prefix via test-auth route. |

## Test naming convention

```
NN-descriptive-name.spec.ts
```

Existing range:
- `02-08` — original suite (auth, dashboard, project, onboarding, settings, errors, mobile-auth, hydration)
- `10-17` — streaming, send-to-code, multi-block, generate, byok, trial, github, magic-link
- `18-24` — **9C** — pricing, mobile-create-project, mobile-sidebar, recent-chats, workspace-tabs, help-cleanup, footer

Next free: `25+`.

## Adding a new test

1. Create `tests/e2e/NN-name.spec.ts`
2. Import helpers from `./helpers/auth`
3. Use `data-testid` selectors over text where possible (more stable across i18n / copy changes)
4. For mobile-only tests: `test.use({ ...devices['Pixel 7'] })` at file top
5. Run with `pnpm test tests/e2e/NN-name.spec.ts` until green
6. Commit alongside the production-code change it covers

## CI integration (TODO)

Not yet wired. When wiring:
- Skip `webServer` in CI (deploy-preview URL via `PLAYWRIGHT_BASE_URL`)
- `retries: 2` for flake-tolerance (already in config)
- Upload `playwright-report/` as artifact on failure
- Mask `SUPABASE_SERVICE_ROLE_KEY` + `TEST_ACCOUNT_PASSWORD` in CI secrets
