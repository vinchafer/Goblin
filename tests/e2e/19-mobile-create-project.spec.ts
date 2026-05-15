import { test, expect, devices } from '@playwright/test';
import { loginAsRealTestUser, dismissTour } from './helpers/auth';

test.use({ ...devices['Pixel 7'] });

test.describe('9C — Mobile Create Project (BUG-010)', () => {
  test('Mobile FAB → modal → submit → no "invalid project data"', async ({ page }) => {
    await loginAsRealTestUser(page);
    await dismissTour(page);

    // Open mobile sidebar via hamburger (aria-label exists pre-9C)
    await page.getByRole('button', { name: /open menu/i }).click();
    const sidebar = page.locator('.goblin-sidebar-mobile');
    await expect(sidebar).toBeVisible();

    // Click "+ New Project" inside sidebar
    await sidebar.getByRole('button', { name: /new project/i }).click();

    // Modal should open with name input
    const nameInput = page.getByPlaceholder('My Awesome Project');
    await expect(nameInput).toBeVisible({ timeout: 5000 });

    // Fill unique name
    const name = `[E2E-TEST] 9C-${Date.now()}`;
    await nameInput.fill(name);

    // Submit
    await page.getByRole('button', { name: /create project/i }).click();

    // CRITICAL: Should NOT see "invalid project data" error
    await expect(page.getByText(/invalid project data/i)).not.toBeVisible({ timeout: 3000 });

    // Should redirect to project page
    await page.waitForURL(/\/dashboard\/project\//, { timeout: 15000 });
  });
});
