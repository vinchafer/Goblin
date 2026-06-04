import { test, expect, devices } from '@playwright/test';
import { loginAsRealTestUser, dismissTour } from './helpers/auth';

test.use({ ...devices['Pixel 7'] });

test.describe('9C — Mobile Create Project (BUG-010)', { tag: '@auth' }, () => {
  test('Mobile FAB → modal → submit → no "invalid project data"', async ({ page }) => {
    await loginAsRealTestUser(page);
    await dismissTour(page);

    // Open mobile sidebar via hamburger (aria-label "Open menu")
    await page.getByRole('button', { name: /open menu/i }).click();
    const sidebar = page.locator('.goblin-sidebar-mobile');
    await expect(sidebar).toBeVisible();

    // New-project affordance in the mobile sidebar (aria-label "Neues Projekt"
    // since the 9C/9D sidebar restructure — was English "New Project").
    await sidebar.getByRole('button', { name: /neues projekt/i }).click();

    // Modal opens — target stable test-ids, not the (translatable) placeholder/label.
    const nameInput = page.getByTestId('project-name-input');
    await expect(nameInput).toBeVisible({ timeout: 5000 });

    // Fill unique name
    const name = `[E2E-TEST] 9C-${Date.now()}`;
    await nameInput.fill(name);

    // Submit
    await page.getByTestId('project-create-submit').click();

    // CRITICAL: Should NOT see "invalid project data" error
    await expect(page.getByText(/invalid project data/i)).not.toBeVisible({ timeout: 3000 });

    // Should redirect to project page
    await page.waitForURL(/\/dashboard\/project\//, { timeout: 15000 });
  });
});
