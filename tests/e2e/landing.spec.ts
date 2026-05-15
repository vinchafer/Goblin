import { test, expect } from '@playwright/test';

test.describe('Landing page', { tag: '@public' }, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads with HTTP 200', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
  });

  test('"Goblin" appears in page', async ({ page }) => {
    await expect(page.getByText(/goblin/i).first()).toBeVisible();
  });

  test('page title contains "Goblin"', async ({ page }) => {
    await expect(page).toHaveTitle(/Goblin/i);
  });

  test('pricing section has price text', async ({ page }) => {
    // Scroll to find pricing content anywhere on the page
    const pricingText = page.getByText(/\$9|\$19|\$39/).first();
    await pricingText.scrollIntoViewIfNeeded();
    await expect(pricingText).toBeVisible();
  });

  test('footer has Privacy link', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByRole('link', { name: /privacy/i }).last()).toBeVisible();
  });

  test('footer has Terms link', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByRole('link', { name: /terms/i }).last()).toBeVisible();
  });

  test('footer has copyright text', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByText(/© 2026/i)).toBeVisible();
  });
});
