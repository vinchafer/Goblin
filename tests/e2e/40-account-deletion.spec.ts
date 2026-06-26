import { test, expect } from '@playwright/test';

test.describe('@public Cancel-Deletion Page', () => {
  test('renders error state when token is missing', async ({ page }) => {
    await page.goto('/cancel-deletion');
    await expect(page.getByRole('heading', { name: 'Fehler' })).toBeVisible();
    await expect(page.getByText('Kein Token im Link gefunden.')).toBeVisible();
  });

  test('renders error state for invalid token', async ({ page }) => {
    await page.goto('/cancel-deletion?token=invalid-token-' + 'x'.repeat(40));
    // Either an API-error response or token-not-found
    await expect(page.getByRole('heading', { name: 'Fehler' })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('@public Deletion-Pending Page', () => {
  test('renders headline + CTA copy', async ({ page }) => {
    await page.goto('/deletion-pending');
    await expect(page.getByRole('heading', { name: 'Dein Konto wird gelöscht' })).toBeVisible();
    await expect(page.getByText(/10 Tagen unwiderruflich/i)).toBeVisible();
  });
});
