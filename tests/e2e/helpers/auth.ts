import { type Page, type BrowserContext } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const TEST_TOKEN = process.env.TEST_AUTH_TOKEN || 'goblin-playwright-test-token-2026';

export interface TestSession {
  email: string;
  userId: string;
  projectId: string | null;
}

// Track created users for cleanup
const createdUsers: string[] = [];

export async function loginAsTestUser(
  page: Page,
  options: { email?: string; plan?: string; createProject?: boolean } = {}
): Promise<TestSession> {
  const res = await page.request.post(`${BASE_URL}/api/test-auth`, {
    headers: {
      'X-Test-Auth-Token': TEST_TOKEN,
      'Content-Type': 'application/json',
    },
    data: {
      email: options.email,
      plan: options.plan || 'seed',
      createProject: options.createProject !== false, // default true
      redirectTo: `${BASE_URL}/auth/test-callback`,
    },
  });

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Test auth failed (${res.status()}): ${body}`);
  }

  const { email, userId, projectId, magicLink } = await res.json();
  if (!createdUsers.includes(userId)) createdUsers.push(userId);

  // Navigate through magic link → sets auth cookies
  await page.goto(magicLink);

  // Wait for redirect to dashboard (or onboarding for new users)
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 20000 });

  return { email, userId, projectId };
}

// Dismiss FirstRunTour if present
export async function dismissTour(page: Page): Promise<void> {
  const skipBtn = page.locator('button:has-text("Skip tour"), button:has-text("Skip")').first();
  if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(300);
  }
}

export async function cleanupTestUsers(page: Page): Promise<void> {
  if (createdUsers.length === 0) return;

  await page.request.delete(`${BASE_URL}/api/test-auth`, {
    headers: {
      'X-Test-Auth-Token': TEST_TOKEN,
      'Content-Type': 'application/json',
    },
    data: { userIds: [...createdUsers] },
  });

  createdUsers.length = 0;
}

// Save auth state to file for reuse across tests in the same project
export async function saveAuthState(context: BrowserContext, path: string): Promise<void> {
  await context.storageState({ path });
}
