import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const isProd = baseURL !== 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1, // serial to avoid dev server ECONNRESET under parallel auth load
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'public-desktop',
      grep: /@public/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'public-mobile',
      grep: /@public/,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'auth-desktop',
      grep: /@auth/,
      grepInvert: /@local-only/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'auth-mobile',
      grep: /@auth/,
      grepInvert: /@local-only/,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'local-only',
      grep: /@local-only/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Legacy aliases — preserved for existing tooling that targets these names
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
  // Only start dev servers for local runs
  ...(!isProd && {
    webServer: [
      {
        command: 'pnpm --filter @goblin/api dev',
        url: 'http://localhost:3001/health',
        reuseExistingServer: !process.env.CI,
        timeout: 60000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
      {
        // CI runs the PRODUCTION server (next start over the pre-built .next) instead
        // of `next dev`. Root cause of the weekly E2E flake: `next dev` lazy-COMPILES
        // each route on its first request, so the first test to hit a heavy dynamic
        // route (e.g. /dashboard/project/[id] in 19-mobile-create-project) raced the
        // compile against waitForURL's 15s and timed out — passing on re-run only
        // because the route was already compiled. The prod server serves precompiled
        // routes, so first-hit latency is gone and the wait is deterministic. Local
        // dev still uses `next dev` for hot-reload. (CI builds web before this — see
        // .github/workflows/e2e.yml.)
        command: process.env.CI ? 'pnpm --filter @goblin/web start' : 'cd apps/web && pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
    ],
  }),
});
