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

  test('Pricing page shows 3 plans; geo region selector is an allowed product feature', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('domcontentloaded');

    const pricingSection = page.locator('#pricing');
    await pricingSection.scrollIntoViewIfNeeded();

    // Geo region selector (USA/EU/CH, Latam, India/Africa) is a SHIPPED product
    // feature for regional pricing — its presence is not a regression. The test
    // intentionally does NOT assert against it. Other consistency invariants
    // below still hold.

    // Exactly 3 plan headings for the currently selected region
    await expect(pricingSection.getByRole('heading', { name: /^Build$/ })).toHaveCount(1);
    await expect(pricingSection.getByRole('heading', { name: /^Pro$/ })).toHaveCount(1);
    await expect(pricingSection.getByRole('heading', { name: /^Power$/ })).toHaveCount(1);

    // No "MOST POPULAR" badge anywhere
    await expect(page.getByText(/most popular/i)).toHaveCount(0);
  });
});
