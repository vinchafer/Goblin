import { test, expect, type Page } from '@playwright/test';

/**
 * U2 GATE — the auth-link interstitial (/auth/confirm).
 *
 * Two properties decide whether the founder's reset chain is actually fixed,
 * and both are observable without a live mailbox:
 *
 *  1. A GET must NOT redeem. If merely loading the URL called verifyOtp, a mail
 *     scanner's preflight fetch would spend the single-use token before the
 *     user ever tapped — one of the three candidates for "expired or already
 *     used" on a fresh link. We assert zero calls to Supabase's verify endpoint
 *     until the button is pressed, and exactly one after.
 *
 *  2. Redemption must not depend on browser state. The old flow exchanged a
 *     PKCE `?code=`, which needs the code_verifier cookie written by the
 *     browser that REQUESTED the reset — so requesting in the installed PWA and
 *     opening in Safari could never work. The interstitial runs in a context
 *     with no cookies and no storage at all, which is the strongest available
 *     stand-in for "a different browser than the one that asked".
 */

const FAKE_TOKEN = 'e2e_not_a_real_token_hash';

/** Count calls to the Supabase OTP verify endpoint, whatever project host it lives on. */
async function countVerifyCalls(page: Page): Promise<() => number> {
  let calls = 0;
  await page.route('**/auth/v1/verify*', async (route) => {
    calls++;
    // Answer locally: a real 4xx from Supabase would do the same thing to the
    // UI, and this keeps the assertion about OUR call, not about their latency.
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'invalid_token', error_description: 'Token has expired or is invalid' }),
    });
  });
  return () => calls;
}

test.describe('@public U2 auth-confirm interstitial', () => {
  test('a GET renders the page and redeems nothing', async ({ page }) => {
    const verifyCalls = await countVerifyCalls(page);

    await page.goto(`/auth/confirm?token_hash=${FAKE_TOKEN}&type=recovery&next=/auth/reset-password`);
    await page.waitForLoadState('networkidle');

    // The page is up and waiting for a human.
    await expect(page.getByTestId('auth-confirm-submit')).toBeVisible();
    // Nothing was consumed just by opening the link.
    expect(verifyCalls()).toBe(0);
    // And it did not silently walk on to the reset form.
    expect(new URL(page.url()).pathname).toBe('/auth/confirm');
  });

  test('only the click redeems, and only once', async ({ page }) => {
    const verifyCalls = await countVerifyCalls(page);

    await page.goto(`/auth/confirm?token_hash=${FAKE_TOKEN}&type=recovery&next=/auth/reset-password`);
    await expect(page.getByTestId('auth-confirm-submit')).toBeVisible();
    expect(verifyCalls()).toBe(0);

    await page.getByTestId('auth-confirm-submit').click();

    // A rejected token gets honest copy, not a blank screen.
    await expect(page.getByTestId('auth-confirm-error')).toBeVisible({ timeout: 10000 });
    expect(verifyCalls()).toBe(1);
  });

  test('an incomplete link says so instead of showing a dead button', async ({ page }) => {
    const verifyCalls = await countVerifyCalls(page);

    await page.goto('/auth/confirm?type=recovery');
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('auth-confirm-submit')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Anmeldung|sign in/i })).toBeVisible();
    expect(verifyCalls()).toBe(0);
  });

  test('redemption works from a context that never requested the reset', async ({ browser }) => {
    // A brand-new context: no cookies, no localStorage, and in particular no
    // PKCE code_verifier. This is the shape of "opened in Gmail → Safari".
    const context = await browser.newContext();
    const page = await context.newPage();
    const verifyCalls = await countVerifyCalls(page);

    await page.goto(`/auth/confirm?token_hash=${FAKE_TOKEN}&type=recovery&next=/auth/reset-password`);
    await page.getByTestId('auth-confirm-submit').click();

    // The call goes out on token_hash alone — no verifier cookie was needed to
    // even attempt it, which is exactly what the old ?code= flow could not do.
    await expect(page.getByTestId('auth-confirm-error')).toBeVisible({ timeout: 10000 });
    expect(verifyCalls()).toBe(1);
    expect(await context.cookies()).toHaveLength(0);

    await context.close();
  });

  test('the reset page states the honest reason when it has nothing to redeem', async ({ page }) => {
    await page.goto('/auth/reset-password');
    await expect(page.getByTestId('reset-error')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('reset-error')).toContainText(/Bestätigungsdaten|confirmation data/);
  });
});
