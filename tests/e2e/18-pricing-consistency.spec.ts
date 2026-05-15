import { test, expect } from '@playwright/test';

test.describe('9C — Pricing Consistency Landing↔Billing', () => {
  test('Landing page shows 3 plan cards with prices', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Scroll to pricing section
    const pricingSection = page.locator('#pricing');
    await pricingSection.scrollIntoViewIfNeeded();

    // Tier-1 default prices: $9 / $19 / $39
    await expect(page.getByText(/\$9/).first()).toBeVisible();
    await expect(page.getByText(/\$19/).first()).toBeVisible();
    await expect(page.getByText(/\$39/).first()).toBeVisible();
  });

  test('Landing has 3 plan headings: Build, Pro, Power', async ({ page }) => {
    await page.goto('/');
    const pricingSection = page.locator('#pricing');
    await pricingSection.scrollIntoViewIfNeeded();

    // Headings inside pricing section
    await expect(pricingSection.getByRole('heading', { name: /^Build$/ })).toBeVisible();
    await expect(pricingSection.getByRole('heading', { name: /^Pro$/ })).toBeVisible();
    await expect(pricingSection.getByRole('heading', { name: /^Power$/ })).toBeVisible();
  });

  test('Geo-tier toggle changes prices', async ({ page }) => {
    await page.goto('/');
    const pricingSection = page.locator('#pricing');
    await pricingSection.scrollIntoViewIfNeeded();

    // Tap Tier-3 (India / Africa)
    const tier3 = page.getByRole('button', { name: /India \/ Africa/ });
    await tier3.click();

    // Tier-3 prices: $3 / $6 / $12
    await expect(page.getByText(/\$3(?!\d)/).first()).toBeVisible();
    await expect(page.getByText(/\$12/).first()).toBeVisible();
  });
});
