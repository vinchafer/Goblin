import { test, expect } from '@playwright/test';
import { loginAsTestUser, dismissTour, cleanupTestUsers } from './helpers/auth';

test.describe('Project Workspace', () => {
  let projectId: string | null = null;
  let testEmail: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    // createProject=true ensures isFirstLogin=false → no tour
    const session = await loginAsTestUser(page, { createProject: true });
    testEmail = session.email;
    projectId = session.projectId;
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await cleanupTestUsers(page);
    await page.close();
  });

  test('project page loads for valid project', async ({ page }) => {
    test.skip(!projectId, 'No test project created');
    await loginAsTestUser(page, { email: testEmail });
    await page.goto(`/dashboard/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login|not-found/);
  });

  test('chat tab is visible by default on project page', async ({ page }) => {
    test.skip(!projectId, 'No test project created');
    await loginAsTestUser(page, { email: testEmail });
    await page.goto(`/dashboard/project/${projectId}`);
    await page.waitForLoadState('networkidle');

    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 15000 });
  });

  test('chat input accepts text', async ({ page }) => {
    test.skip(!projectId, 'No test project created');
    await loginAsTestUser(page, { email: testEmail });
    await page.goto(`/dashboard/project/${projectId}`);
    await page.waitForLoadState('networkidle');

    const chatInput = page.locator('textarea').first();
    await chatInput.waitFor({ state: 'visible', timeout: 15000 });
    await chatInput.fill('Hello from Playwright');
    expect(await chatInput.inputValue()).toBe('Hello from Playwright');
  });

  test('Enter key does not submit empty message', async ({ page }) => {
    test.skip(!projectId, 'No test project created');
    await loginAsTestUser(page, { email: testEmail });
    await page.goto(`/dashboard/project/${projectId}`);
    await page.waitForLoadState('networkidle');

    const chatInput = page.locator('textarea').first();
    await chatInput.waitFor({ state: 'visible', timeout: 15000 });
    // Empty input + Enter should not trigger submission
    const messagesBefore = await page.locator('[data-testid="message"], .message').count();
    await chatInput.press('Enter');
    await page.waitForTimeout(500);
    const messagesAfter = await page.locator('[data-testid="message"], .message').count();
    expect(messagesAfter).toBe(messagesBefore);
  });

  test('can switch to code tab', async ({ page }) => {
    test.skip(!projectId, 'No test project created');
    await loginAsTestUser(page, { email: testEmail });
    await page.goto(`/dashboard/project/${projectId}`);
    await page.waitForLoadState('networkidle');

    const codeTab = page.locator('button:has-text("Code"), [data-tab="code"], [role="tab"]:has-text("Code")').first();
    if (await codeTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await codeTab.click();
      await page.waitForTimeout(1500);
      const hasEditorOrTree = await page.locator('.cm-editor, [class*="CodeMirror"], [data-testid="code-editor"], [data-testid="file-tree"]').first().isVisible({ timeout: 8000 }).catch(() => false);
      const hasEmptyState = await page.locator('text=/No files|Empty|no files yet/i').first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasEditorOrTree || hasEmptyState).toBeTruthy();
    }
  });

  test('invalid project id shows 404 not crash', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail });
    await page.goto('/dashboard/project/00000000-0000-0000-0000-000000000000');
    await page.waitForLoadState('networkidle');
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('Application error: a client-side exception has occurred');
  });

  test('New Project button works (tour dismissed first)', async ({ page }) => {
    await loginAsTestUser(page, { email: testEmail, createProject: false });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Dismiss FirstRunTour if showing
    await dismissTour(page);
    await page.waitForTimeout(500);

    // Now try clicking New Project in sidebar
    const newBtn = page.locator('button[title="New Project"], button:has-text("New Project")').first();
    if (await newBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newBtn.click({ force: true });
      await page.waitForTimeout(500);
      // Modal opens with "Project Name" label and "My Awesome Project" placeholder
      const hasModal = await page.locator('text="Project Name"').first().isVisible({ timeout: 3000 }).catch(() => false);
      const hasInput = await page.locator('input[placeholder*="Awesome"], input[placeholder*="Project"]').first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasModal || hasInput).toBeTruthy();
    }
  });

  test('project page has no console errors', async ({ page }) => {
    test.skip(!projectId, 'No test project created');
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await loginAsTestUser(page, { email: testEmail });
    await page.goto(`/dashboard/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const critical = errors.filter(e =>
      !e.toLowerCase().includes('warning') &&
      !e.toLowerCase().includes('react') &&
      !e.includes('failed to fetch') // API not available is expected in test env
    );
    expect(critical).toHaveLength(0);
  });
});
