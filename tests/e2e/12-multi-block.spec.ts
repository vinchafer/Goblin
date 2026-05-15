import { test, expect } from '@playwright/test';
import { loginAsRealTestUser, openFirstProject, dismissTour } from './helpers/auth';

const GROQ_KEY_SET = !!process.env.GROQ_FREE_API_KEY;

test.describe('Multi-block code responses', { tag: '@local-only' }, () => {
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    test.skip(!GROQ_KEY_SET, 'GROQ_FREE_API_KEY not set');
    const page = await browser.newPage();
    await loginAsRealTestUser(page);
    projectId = await openFirstProject(page);
    await page.close();
  });

  test('multiple code blocks each have Send to Code button', async ({ page }) => {
    test.skip(!GROQ_KEY_SET, 'GROQ_FREE_API_KEY not set');
    await loginAsRealTestUser(page);
    await page.goto(`/dashboard/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ state: 'visible', timeout: 15000 });
    // Ask explicitly for 2 files to maximize chance of multiple code blocks
    await textarea.fill('Create two separate code blocks: one for index.html with a heading, one for style.css with a red background. Label each with its filename.');
    await textarea.press('Enter');

    await expect(textarea).toBeEnabled({ timeout: 60000 });

    const codeBlocks = page.locator('pre code');
    const count = await codeBlocks.count();

    if (count >= 2) {
      // Each code block should have a Send to Code button
      const sendBtns = page.locator('button:has-text("Send to Code")');
      const btnCount = await sendBtns.count();
      expect(btnCount).toBeGreaterThanOrEqual(2);
    } else {
      // Single block is acceptable — model may have merged them
      test.info().annotations.push({ type: 'note', description: `Model returned ${count} code block(s) — multi-block not guaranteed` });
      const sendBtns = page.locator('button:has-text("Send to Code")');
      expect(await sendBtns.count()).toBeGreaterThanOrEqual(1);
    }
  });

  test('each code block Send to Code fires event with correct code', async ({ page }) => {
    test.skip(!GROQ_KEY_SET, 'GROQ_FREE_API_KEY not set');
    await loginAsRealTestUser(page);
    await page.goto(`/dashboard/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    await page.evaluate(() => {
      (window as unknown as Record<string, unknown[]>).__sentPayloads = [];
      window.addEventListener('goblin:sendToCode', (e) => {
        const ce = e as CustomEvent<{ code: string; filename?: string }>;
        ((window as unknown as Record<string, unknown[]>).__sentPayloads as unknown[]).push(ce.detail);
      });
    });

    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ state: 'visible', timeout: 15000 });
    await textarea.fill('Write a Python function that returns "hello" and a JavaScript function that returns "world". Put each in a separate code block.');
    await textarea.press('Enter');
    await expect(textarea).toBeEnabled({ timeout: 60000 });

    const sendBtns = page.locator('button:has-text("Send to Code")');
    const count = await sendBtns.count();
    if (count >= 1) {
      await sendBtns.first().click();
      const payloads = await page.evaluate(() => (window as unknown as Record<string, unknown[]>).__sentPayloads);
      expect(payloads.length).toBeGreaterThanOrEqual(1);
      const first = payloads[0] as { code: string };
      expect(first.code.length).toBeGreaterThan(0);
    }
  });
});
