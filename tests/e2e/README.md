# E2E Tests

Playwright tests live here. Single root setup — `playwright.config.ts` in repo root, tests in `tests/e2e/`.

## Tag system

Tests are organized in three categories via Playwright tags:

### @public
Public routes, no authentication. Always runs (CI + local).
- Landing, Pricing, /help, /status, footer, login-page renders

### @auth
Authenticated routes, no BYOK touchpoint. Runs in CI + local.
- Mobile sidebar, mobile create-project, help-cleanup, avatar-menu

### @local-only
Tests requiring BYOK, real Stripe, email delivery, or external APIs. **NOT in CI.**
- BYOK decrypt + usage
- Stripe Checkout / Webhook
- Real AI streaming, Send-to-Code, multi-block
- GitHub OAuth integration
- Email delivery (Resend)
- Push notifications
- Synthetic test-user creation (`/api/test-auth` route)

## Commands

| Command | Scope |
|---|---|
| `pnpm test:e2e:public` | Only @public |
| `pnpm test:e2e:auth` | Only @auth (real test user login) |
| `pnpm test:e2e:local` | Only @local-only (run locally before push) |
| `pnpm test:e2e:ci` | @public + @auth (what CI runs) |
| `pnpm test` | All tests |

## CI behavior

GitHub Actions runs `pnpm test:e2e:ci`. @local-only is owner responsibility before significant pushes.

## Test-auth route security

`/api/test-auth` has 4 guard layers:

1. `NODE_ENV !== 'production'` (hardblock)
2. `ENABLE_TEST_AUTH === 'true'` (explicit enable)
3. Origin = localhost OR `CI === 'true'` (origin check)
4. `SUPABASE_SERVICE_ROLE_KEY` set (config check)

In production: always returns 403. **Never set `ENABLE_TEST_AUTH` in production env.**

## Before significant pushes

```bash
pnpm test:e2e:ci      # public + auth
pnpm test:e2e:local   # BYOK, Stripe, real AI
git push
```

## Adding a new test

1. Create file in `tests/e2e/`
2. Pick a tag:
   - No login → `@public`
   - Login required, no BYOK → `@auth`
   - BYOK / Stripe / email / push → `@local-only`
3. Tag at describe level:

```typescript
import { test, expect } from '@playwright/test';
import { loginAsRealTestUser } from './helpers/auth';

test.describe('Feature name', { tag: '@auth' }, () => {
  test('does the thing', async ({ page }) => {
    await loginAsRealTestUser(page);
    // ...
  });
});
```
