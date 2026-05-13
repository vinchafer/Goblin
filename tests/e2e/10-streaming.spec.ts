import { test, expect } from '@playwright/test';
import { loginAsRealTestUser, openFirstProject, dismissTour } from './helpers/auth';

const GROQ_KEY_SET = !!process.env.GROQ_FREE_API_KEY;
const TEST_MESSAGE = 'Write a hello world function in Python. Keep it short.';

test.describe('Streaming — real test account + Free Pool', () => {
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    test.skip(!GROQ_KEY_SET, 'GROQ_FREE_API_KEY not set — skipping streaming tests');
    const page = await browser.newPage();
    await loginAsRealTestUser(page);
    projectId = await openFirstProject(page);
    await page.close();
  });

  test('chat tab visible after login', async ({ page }) => {
    test.skip(!GROQ_KEY_SET, 'GROQ_FREE_API_KEY not set');
    await loginAsRealTestUser(page);
    await page.goto(`/dashboard/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 15000 });
  });

  test('message appears in chat immediately after send', async ({ page }) => {
    test.skip(!GROQ_KEY_SET, 'GROQ_FREE_API_KEY not set');
    await loginAsRealTestUser(page);
    await page.goto(`/dashboard/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ state: 'visible', timeout: 15000 });
    await textarea.fill(TEST_MESSAGE);
    await textarea.press('Enter');

    // User message should appear instantly
    await expect(page.locator(`text="${TEST_MESSAGE}"`).first()).toBeVisible({ timeout: 5000 });
  });

  test('AI thinking indicator appears while streaming', async ({ page }) => {
    test.skip(!GROQ_KEY_SET, 'GROQ_FREE_API_KEY not set');
    await loginAsRealTestUser(page);
    await page.goto(`/dashboard/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ state: 'visible', timeout: 15000 });
    await textarea.fill('Say just the word "hello"');
    await textarea.press('Enter');

    // Thinking indicator OR streaming content should appear
    const thinking = page.locator('text=/thinking|Cooking|Consulting|Connecting|Spinning/i').first();
    const hasThinking = await thinking.isVisible({ timeout: 6000 }).catch(() => false);
    // Either thinking appeared, or stream already started with content
    const goblinAvatar = page.locator('text=👺').nth(1); // second avatar = AI reply
    const hasAvatar = await goblinAvatar.isVisible({ timeout: 8000 }).catch(() => false);
    expect(hasThinking || hasAvatar).toBe(true);
  });

  test('AI response arrives and contains content (<45s)', async ({ page }) => {
    test.skip(!GROQ_KEY_SET, 'GROQ_FREE_API_KEY not set');
    await loginAsRealTestUser(page);
    await page.goto(`/dashboard/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ state: 'visible', timeout: 15000 });
    await textarea.fill(TEST_MESSAGE);
    await textarea.press('Enter');

    // Wait for streaming to finish — textarea re-enables
    await expect(textarea).toBeEnabled({ timeout: 45000 });

    // Response should contain something meaningful
    const aiText = page.locator('.goblin-ai-text').first();
    await expect(aiText).toBeVisible({ timeout: 5000 });
    const content = await aiText.textContent();
    expect(content && content.length > 10).toBe(true);
  });

  test('response contains a code block for coding request', async ({ page }) => {
    test.skip(!GROQ_KEY_SET, 'GROQ_FREE_API_KEY not set');
    await loginAsRealTestUser(page);
    await page.goto(`/dashboard/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ state: 'visible', timeout: 15000 });
    await textarea.fill(TEST_MESSAGE);
    await textarea.press('Enter');

    await expect(textarea).toBeEnabled({ timeout: 45000 });

    // Code block should be present
    const codeBlock = page.locator('pre code').first();
    await expect(codeBlock).toBeVisible({ timeout: 5000 });
  });

  test('Send to Code button visible after code response', async ({ page }) => {
    test.skip(!GROQ_KEY_SET, 'GROQ_FREE_API_KEY not set');
    await loginAsRealTestUser(page);
    await page.goto(`/dashboard/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ state: 'visible', timeout: 15000 });
    await textarea.fill(TEST_MESSAGE);
    await textarea.press('Enter');

    await expect(textarea).toBeEnabled({ timeout: 45000 });

    const sendToCode = page.locator('button:has-text("Send to Code")').first();
    await expect(sendToCode).toBeVisible({ timeout: 5000 });
  });

  test('no error banner shown during successful stream', async ({ page }) => {
    test.skip(!GROQ_KEY_SET, 'GROQ_FREE_API_KEY not set');
    await loginAsRealTestUser(page);
    await page.goto(`/dashboard/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ state: 'visible', timeout: 15000 });
    await textarea.fill(TEST_MESSAGE);
    await textarea.press('Enter');

    await expect(textarea).toBeEnabled({ timeout: 45000 });

    // No error banner
    const errorBanner = page.locator('text=/Something went wrong|Could not reach/i').first();
    const hasError = await errorBanner.isVisible({ timeout: 1000 }).catch(() => false);
    expect(hasError).toBe(false);
  });

  test('second message uses conversation context', async ({ page }) => {
    test.skip(!GROQ_KEY_SET, 'GROQ_FREE_API_KEY not set');
    await loginAsRealTestUser(page);
    await page.goto(`/dashboard/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ state: 'visible', timeout: 15000 });

    // First message
    await textarea.fill('Remember the number 42');
    await textarea.press('Enter');
    await expect(textarea).toBeEnabled({ timeout: 45000 });

    // Second message referencing the first
    await textarea.fill('What number did I just ask you to remember?');
    await textarea.press('Enter');
    await expect(textarea).toBeEnabled({ timeout: 45000 });

    // Response should mention 42
    const aiTexts = page.locator('.goblin-ai-text');
    const lastAiText = aiTexts.last();
    const content = await lastAiText.textContent();
    expect(content).toContain('42');
  });
});
