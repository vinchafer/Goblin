import { test, expect } from '@playwright/test';
import { loginAsRealTestUser, dismissTour } from './helpers/auth';

const GROQ_KEY_SET = !!process.env.GROQ_FREE_API_KEY;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Project creation + initial code generation', () => {
  let createdProjectId: string | null = null;

  test.afterAll(async ({ browser }) => {
    // Cleanup: delete the test project via API if possible
    if (!createdProjectId) return;
    const page = await browser.newPage();
    try {
      await loginAsRealTestUser(page);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://goblinapi-production.up.railway.app';
      // Best-effort deletion
      const token = await page.evaluate(() => {
        const keys = Object.keys(localStorage);
        for (const k of keys) {
          if (k.includes('supabase') || k.includes('auth')) {
            try {
              const val = JSON.parse(localStorage.getItem(k) || '{}');
              return val?.access_token || val?.session?.access_token || null;
            } catch { return null; }
          }
        }
        return null;
      });
      if (token) {
        await page.request.delete(`${apiBase}/api/projects/${createdProjectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    } finally {
      await page.close();
    }
  });

  test('new blank project can be created from dashboard', async ({ page }) => {
    await loginAsRealTestUser(page);
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    // Open new project modal
    const newProjectBtn = page.locator('button:has-text("New project")').first();
    await expect(newProjectBtn).toBeVisible({ timeout: 10000 });
    await newProjectBtn.click();

    // Fill project name with E2E-TEST prefix
    const nameInput = page.locator('input[placeholder*="Awesome"]').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('[E2E-TEST] Playwright Test Project');

    // Submit
    const createBtn = page.locator('button:has-text("Create project")').first();
    await createBtn.click();

    // Should redirect to project page
    await page.waitForURL(/\/dashboard\/project\//, { timeout: 20000 });

    const url = page.url();
    const match = url.match(/\/dashboard\/project\/([^/?]+)/);
    if (match) createdProjectId = match[1];

    expect(url).toMatch(/\/dashboard\/project\//);
  });

  test('new project has chat input ready', async ({ page }) => {
    await loginAsRealTestUser(page);
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    const newProjectBtn = page.locator('button:has-text("New project")').first();
    await newProjectBtn.click();

    const nameInput = page.locator('input[placeholder*="Awesome"]').first();
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.fill('[E2E-TEST] Chat Ready Test');

    const createBtn = page.locator('button:has-text("Create project")').first();
    await createBtn.click();
    await page.waitForURL(/\/dashboard\/project\//, { timeout: 20000 });
    await dismissTour(page);

    // Chat textarea should be available
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 15000 });
  });

  test('chat generates code response for "create hello world" prompt', async ({ page }) => {
    test.skip(!GROQ_KEY_SET, 'GROQ_FREE_API_KEY not set — skip code generation test');

    await loginAsRealTestUser(page);
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    const newProjectBtn = page.locator('button:has-text("New project")').first();
    await newProjectBtn.click();

    const nameInput = page.locator('input[placeholder*="Awesome"]').first();
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.fill('[E2E-TEST] Generation Test');

    await page.locator('button:has-text("Create project")').first().click();
    await page.waitForURL(/\/dashboard\/project\//, { timeout: 20000 });
    await dismissTour(page);

    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ state: 'visible', timeout: 15000 });
    await textarea.fill('Create a minimal HTML hello world page.');
    await textarea.press('Enter');

    // Wait for stream to complete
    await expect(textarea).toBeEnabled({ timeout: 60000 });

    // Should have code block
    const codeBlock = page.locator('pre code').first();
    await expect(codeBlock).toBeVisible({ timeout: 5000 });

    const code = await codeBlock.textContent();
    expect(code).toContain('html');
  });
});
