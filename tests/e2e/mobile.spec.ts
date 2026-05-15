import { test, expect } from '@playwright/test';

/**
 * Mobile viewport tests — run against an iPhone 13 (390 x 844 logical px).
 * All tests here use a forced viewport so they work regardless of which
 * Playwright project invokes them.
 */

const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.describe('Mobile layout — landing page', { tag: '@public' }, () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('/ loads on mobile without errors', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    // Basic smoke: the Goblin brand name is visible
    await expect(page.getByText(/goblin/i).first()).toBeVisible();
  });

  test('no horizontal scroll on landing page', async ({ page }) => {
    await page.goto('/');
    // Wait for any dynamic content to settle
    await page.waitForLoadState('networkidle');

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);

    // Allow 1 px tolerance for sub-pixel rendering differences
    expect(bodyScrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });

  test('CTA link is reachable without horizontal scroll', async ({ page }) => {
    await page.goto('/');
    // The mobile nav should show a hamburger; opening it reveals the CTA
    const hamburger = page.locator('button.nav-hamburger');
    if (await hamburger.isVisible()) {
      await hamburger.click();
      await expect(
        page.getByRole('link', { name: /start building/i }).last()
      ).toBeVisible();
    } else {
      // Desktop nav is visible even on narrow viewport (CSS hidden via class)
      await expect(
        page.getByRole('link', { name: /start building/i }).first()
      ).toBeVisible();
    }
  });
});

test.describe('Mobile layout — login page', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('/login loads on mobile', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response?.status()).toBe(200);
  });

  test('login page shows OAuth buttons on mobile', async ({ page }) => {
    await page.goto('/login');
    await expect(
      page.getByRole('button', { name: /continue with google/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /continue with github/i })
    ).toBeVisible();
  });

  test('OAuth buttons meet minimum 44 px touch-target height', async ({ page }) => {
    await page.goto('/login');

    const buttons = page.getByRole('button', { name: /continue with/i });
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box) {
        // WCAG 2.5.5 / Apple HIG recommend 44 px minimum touch target
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });
});

test.describe('Mobile touch targets — general', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('primary CTA buttons on landing page meet 44 px height', async ({ page }) => {
    await page.goto('/');

    // Collect all <a> and <button> elements that are visible in the viewport
    // and check that none is unreasonably small.
    const interactives = page.locator('button:visible, a[href]:visible');
    const total = await interactives.count();

    // We only spot-check the first 20 to keep the test fast
    const checkCount = Math.min(total, 20);
    const tooSmall: Array<{ tag: string; text: string; height: number }> = [];

    for (let i = 0; i < checkCount; i++) {
      const el = interactives.nth(i);
      const box = await el.boundingBox();
      if (!box) continue; // Not in viewport / display:none
      if (box.height < 44) {
        const tag = await el.evaluate(e => e.tagName);
        const text = (await el.textContent())?.trim().slice(0, 40) ?? '';
        // Only fail for buttons (not every tiny nav link matters for this check)
        if (tag === 'BUTTON') {
          tooSmall.push({ tag, text, height: box.height });
        }
      }
    }

    expect(tooSmall, `Buttons below 44px: ${JSON.stringify(tooSmall)}`).toHaveLength(0);
  });
});
