import { test, expect } from '@playwright/test';
import { loginAsRealTestUser, openFirstProject, dismissTour } from './helpers/auth';

const GROQ_KEY_SET = !!process.env.GROQ_FREE_API_KEY;

test.describe('Send to Code — real end-to-end', { tag: '@local-only' }, () => {
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    test.skip(!GROQ_KEY_SET, 'GROQ_FREE_API_KEY not set');
    const page = await browser.newPage();
    await loginAsRealTestUser(page);
    projectId = await openFirstProject(page);
    await page.close();
  });

  test('Send to Code button click switches to code tab', async ({ page }) => {
    test.skip(!GROQ_KEY_SET, 'GROQ_FREE_API_KEY not set');
    await loginAsRealTestUser(page);
    await page.goto(`/dashboard/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ state: 'visible', timeout: 15000 });
    await textarea.fill('Write an HTML page with a red button. Keep it minimal.');
    await textarea.press('Enter');

    // Wait for response
    await expect(textarea).toBeEnabled({ timeout: 45000 });

    // Click Send to Code
    const sendBtn = page.locator('button:has-text("Send to Code")').first();
    await expect(sendBtn).toBeVisible({ timeout: 5000 });
    await sendBtn.click();

    // Should show toast or switch to code tab
    const codeEditor = page.locator('.cm-editor, [class*="CodeMirror"], [data-testid="code-editor"]').first();
    const toast = page.locator('text=/Sent to Code|code tab/i').first();
    const codeSwitched = await codeEditor.isVisible({ timeout: 8000 }).catch(() => false);
    const toastShown = await toast.isVisible({ timeout: 3000 }).catch(() => false);
    expect(codeSwitched || toastShown).toBe(true);
  });

  test('Send to Code dispatches goblin:sendToCode event', async ({ page }) => {
    test.skip(!GROQ_KEY_SET, 'GROQ_FREE_API_KEY not set');
    await loginAsRealTestUser(page);
    await page.goto(`/dashboard/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    // Listen for the custom event before sending
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__sendToCodeFired = false;
      window.addEventListener('goblin:sendToCode', () => {
        (window as unknown as Record<string, unknown>).__sendToCodeFired = true;
      });
    });

    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ state: 'visible', timeout: 15000 });
    await textarea.fill('Write a simple JavaScript function that adds two numbers.');
    await textarea.press('Enter');
    await expect(textarea).toBeEnabled({ timeout: 45000 });

    const sendBtn = page.locator('button:has-text("Send to Code")').first();
    await expect(sendBtn).toBeVisible({ timeout: 5000 });
    await sendBtn.click();

    const fired = await page.evaluate(() => (window as unknown as Record<string, unknown>).__sendToCodeFired);
    expect(fired).toBe(true);
  });

  test('code block has Copy button', async ({ page }) => {
    test.skip(!GROQ_KEY_SET, 'GROQ_FREE_API_KEY not set');
    await loginAsRealTestUser(page);
    await page.goto(`/dashboard/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ state: 'visible', timeout: 15000 });
    await textarea.fill('Show me a Python one-liner that prints numbers 1 to 5.');
    await textarea.press('Enter');
    await expect(textarea).toBeEnabled({ timeout: 45000 });

    const copyBtn = page.locator('button:has-text("Copy")').first();
    await expect(copyBtn).toBeVisible({ timeout: 5000 });
  });
});
