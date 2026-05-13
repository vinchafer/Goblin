import { test, expect } from '@playwright/test';
import { loginAsRealTestUser, openFirstProject, dismissTour } from './helpers/auth';

const GROQ_KEY_SET = !!process.env.GROQ_FREE_API_KEY;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Project workspace — existing project', () => {
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsRealTestUser(page);
    projectId = await openFirstProject(page);
    await page.close();
  });

  test('dashboard shows projects list', async ({ page }) => {
    await loginAsRealTestUser(page);
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    // Should have at least one project row
    const row = page.locator('.project-row').first();
    await expect(row).toBeVisible({ timeout: 10000 });
  });

  test('project page loads with chat textarea', async ({ page }) => {
    await loginAsRealTestUser(page);
    await page.goto(`${BASE_URL}/dashboard/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 15000 });
  });

  test('new project modal opens from dashboard', async ({ page }) => {
    await loginAsRealTestUser(page);
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    const newProjectBtn = page.locator('button').filter({ hasText: 'New project' }).first();
    await expect(newProjectBtn).toBeVisible({ timeout: 10000 });
    await newProjectBtn.click({ force: true });

    // Modal should appear with name input
    const nameInput = page.locator('input[placeholder*="Awesome"], input[placeholder*="Project Name"]').first();
    await expect(nameInput).toBeVisible({ timeout: 8000 });
  });

  test('AI responds to hello world request (streaming works)', async ({ page }) => {
    test.skip(!GROQ_KEY_SET, 'GROQ_FREE_API_KEY not set');

    await loginAsRealTestUser(page);
    await page.goto(`${BASE_URL}/dashboard/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ state: 'visible', timeout: 15000 });
    await textarea.fill('Say "hello world" and nothing else.');
    await textarea.press('Enter');

    // Wait for stream to complete
    await expect(textarea).toBeEnabled({ timeout: 60000 });

    // Either a code block OR text response should be visible
    const aiText = page.locator('.goblin-ai-text').first();
    const codeBlock = page.locator('pre code').first();
    const hasText = await aiText.isVisible({ timeout: 5000 }).catch(() => false);
    const hasCode = await codeBlock.isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasText || hasCode).toBe(true);
    if (hasText) {
      const content = await aiText.textContent();
      expect(content && content.length > 2).toBe(true);
    }
  });
});
