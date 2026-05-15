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
        command: 'cd apps/web && pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
    ],
  }),
});
