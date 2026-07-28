import { test, expect } from '@playwright/test';
import { loginAsRealTestUser, dismissTour, openAvatarMenu, originOf } from './helpers/auth';

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
 * ASSERTED BY LABEL, NOT BY TEST-ID, ON PURPOSE. The @auth suite drives the
 * DEPLOYED app (see originOf() in helpers/auth.ts), which does not yet carry the
 * testids added alongside this test. Labels exist in both the old and the new
 * build, so this test states the BEHAVIOUR — a German tour must really be gone
 * after dismissTour, and the header must be reachable afterwards — which is
 * exactly what regressed, and which fails on the pre-fix helper.
 */
test.describe('@auth SCRIM-U1 First-run tour must not swallow header clicks', () => {
  test('German tour is really dismissed and the avatar stays clickable', async ({ page }) => {
    await loginAsRealTestUser(page);
    const origin = originOf(page);

    // Raise the tour deterministically instead of depending on how many
    // projects the shared test account happens to own (isFirstLogin). ?tour=1
    // is the same entry point the onboarding hand-off uses (DashboardShell).
    await page.evaluate(() => localStorage.removeItem('goblin_tour_done'));
    await page.goto(`${origin}/dashboard?tour=1`);
    await page.waitForLoadState('networkidle');

    // The regression itself: a fresh context has no goblin:preferred-lang, so
    // the tour renders GERMAN. The old helper matched only 'Skip tour'/'Skip'.
    const skip = page.getByRole('button', { name: 'Tour überspringen' });
    await expect(skip).toBeVisible({ timeout: 15000 });

    await dismissTour(page);

    // The behavioural assertion. Pre-fix, dismissTour() no-ops on a German tour
    // and this still resolves to a visible button.
    await expect(skip).toHaveCount(0);

    // Where all 15 failures died (helpers/auth.ts openAvatarMenu).
    const menu = await openAvatarMenu(page);
    await expect(menu).toBeVisible();
    await expect(page.getByTestId('avatar-menu-settings')).toBeVisible();
  });

  test('the tour stays dismissed across a navigation', async ({ page }) => {
    await loginAsRealTestUser(page);
    const origin = originOf(page);

    await page.evaluate(() => localStorage.removeItem('goblin_tour_done'));
    await page.goto(`${origin}/dashboard?tour=1`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: 'Tour überspringen' })).toBeVisible({ timeout: 15000 });
    await dismissTour(page);

    await page.goto(`${origin}/dashboard`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: 'Tour überspringen' })).toHaveCount(0);

    const menu = await openAvatarMenu(page);
    await expect(menu).toBeVisible();
  });
});
