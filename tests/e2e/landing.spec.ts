import { test, expect } from '@playwright/test';

/**
 * Landing page (/) tests — structural checks that pass with placeholder env
 * vars and no real backend connection.
 */

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads with HTTP 200', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
  });

  test('"Goblin" appears in a heading or prominent text', async ({ page }) => {
    // The Nav renders "Goblin." as the brand word-mark, the hero also has it
    await expect(page.getByText(/goblin/i).first()).toBeVisible();
  });

  test('page title contains "Goblin"', async ({ page }) => {
    await expect(page).toHaveTitle(/Goblin/i);
  });

  test('pricing section is visible with $9 plan', async ({ page }) => {
    // PricingSection renders "Seed" plan at $9
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await expect(page.locator('#pricing')).toBeVisible();
    await expect(page.getByText('$')).toHaveCount({ minimum: 1 } as Parameters<typeof expect>[0]);
    // At least one price should contain "9" (Seed plan = $9)
    await expect(page.getByText(/\$9|\$19|\$39/)).toHaveCount({ minimum: 1 } as Parameters<typeof expect>[0]);
  });

  test('nav has "Start building" CTA link pointing to /login', async ({ page }) => {
    const ctaLink = page.getByRole('link', { name: /start building/i }).first();
    await expect(ctaLink).toBeVisible();
    await expect(ctaLink).toHaveAttribute('href', /\/login/);
  });

  test('footer has Privacy link', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(
      page.getByRole('link', { name: /privacy/i }).last()
    ).toBeVisible();
  });

  test('footer has Terms link', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(
      page.getByRole('link', { name: /terms/i }).last()
    ).toBeVisible();
  });

  test('footer copyright text is present', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByText(/© 2026 Goblin/i)).toBeVisible();
  });
});
