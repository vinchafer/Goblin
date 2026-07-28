import { test, expect } from '@playwright/test';
import { loginAsRealTestUser, dismissTour, openAvatarMenu } from './helpers/auth';

/**
 * SCRIM-U1 regression — the mechanism behind the 15-failure E2E wave on master
 * (run 30330975482, HEAD 5eeaa958). Every one of those failures was a click
 * intercepted by an anonymous "<div></div>"; all 25 failure snapshots in that
 * run's playwright-report show the FirstRunTour still mounted, in German.
 *
 * Root cause: dismissTour() matched the skip button by English label only, but
 * a fresh Playwright context has no localStorage('goblin:preferred-lang'), so
 * useOnbLang() falls back to 'de' and the button reads 'Tour überspringen'.
 * The helper matched nothing, returned silently, and the tour's full-screen
 * backdrop (z-index 1000) swallowed every subsequent click.
 *
 * This test pins BOTH halves: the tour really does render German by default,
 * and dismissTour() must leave the header clickable afterwards. It fails on the
 * pre-fix helper — the German tour survives the dismiss and openAvatarMenu()
 * cannot reach the avatar.
 */
test.describe('@auth SCRIM-U1 First-run tour must not swallow header clicks', () => {
  test('German tour is really dismissed and the avatar stays clickable', async ({ page }) => {
    await loginAsRealTestUser(page);

    // Raise the tour deterministically instead of depending on how many
    // projects the shared test account happens to own (isFirstLogin). ?tour=1
    // is the same entry point the onboarding hand-off uses (DashboardShell).
    await page.evaluate(() => localStorage.removeItem('goblin_tour_done'));
    await page.goto('/dashboard?tour=1');
    await page.waitForLoadState('networkidle');

    // Asserted by ROLE + German name, not by test-id: this half must be true on
    // the pre-fix code too, otherwise the test would only be proving that a new
    // attribute exists rather than that the behaviour regressed.
    const skip = page.getByRole('button', { name: 'Tour überspringen' });
    await expect(skip).toBeVisible();

    // The scrim that reported as "<div></div>" is now self-identifying.
    await expect(page.getByTestId('first-run-tour-backdrop')).toBeVisible();

    await dismissTour(page);

    // The behavioural assertion. Pre-fix, dismissTour() no-ops on a German tour
    // and this still resolves to a visible button.
    await expect(skip).toHaveCount(0);
    await expect(page.getByTestId('first-run-tour-backdrop')).toHaveCount(0);

    // Where all 15 failures died (helpers/auth.ts:361).
    const menu = await openAvatarMenu(page);
    await expect(menu).toBeVisible();
    await expect(page.getByTestId('avatar-menu-settings')).toBeVisible();
  });

  test('the tour stays dismissed across a navigation', async ({ page }) => {
    await loginAsRealTestUser(page);
    await page.evaluate(() => localStorage.removeItem('goblin_tour_done'));
    await page.goto('/dashboard?tour=1');
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('first-run-tour')).toHaveCount(0);

    const menu = await openAvatarMenu(page);
    await expect(menu).toBeVisible();
  });
});
