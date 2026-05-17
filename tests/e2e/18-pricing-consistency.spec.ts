import { test, expect } from '@playwright/test';

test.describe('9C — Pricing Consistency Landing↔Billing', { tag: '@public' }, () => {
  test('Landing page shows 3 plan cards with prices', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const pricingSection = page.locator('#pricing');
    await pricingSection.scrollIntoViewIfNeeded();

    await expect(page.getByText(/\$9/).first()).toBeVisible();
    await expect(page.getByText(/\$19/).first()).toBeVisible();
    await expect(page.getByText(/\$39/).first()).toBeVisible();
  });

  test('Landing has 3 plan headings: Build, Pro, Power', async ({ page }) => {
    await page.goto('/');
    const pricingSection = page.locator('#pricing');
    await pricingSection.scrollIntoViewIfNeeded();

    await expect(pricingSection.getByRole('heading', { name: /^Build$/ })).toBeVisible();
    await expect(pricingSection.getByRole('heading', { name: /^Pro$/ })).toBeVisible();
    await expect(pricingSection.getByRole('heading', { name: /^Power$/ })).toBeVisible();
  });

  test('Pricing page shows exactly one tier, no region selector visible', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('domcontentloaded');

    const pricingSection = page.locator('#pricing');
    await pricingSection.scrollIntoViewIfNeeded();

    // No region selector / geo tablist
    await expect(page.locator('[role="tablist"]')).toHaveCount(0);
    await expect(page.locator('[data-testid*="region"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /USA \/ EU \/ CH/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Latam/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /India \/ Africa/i })).toHaveCount(0);

    // Exactly 3 plan headings
    await expect(pricingSection.getByRole('heading', { name: /^Build$/ })).toHaveCount(1);
    await expect(pricingSection.getByRole('heading', { name: /^Pro$/ })).toHaveCount(1);
    await expect(pricingSection.getByRole('heading', { name: /^Power$/ })).toHaveCount(1);

    // No "MOST POPULAR" badge anywhere
    await expect(page.getByText(/most popular/i)).toHaveCount(0);
  });
});
