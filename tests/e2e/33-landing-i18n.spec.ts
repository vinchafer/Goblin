import { test, expect } from '@playwright/test';

/**
 * U4 GATE — the i18n leak on the English landing.
 *
 * The founder saw the four-tab PWA install block rendered in GERMAN on the
 * English landing page. The cause was never a missing locale key — both locales
 * were always in InstallAppBlock.tsx. The cause was the SOURCE of the locale:
 * the block took its language from useLang(), which reads the APP's stored
 * preference (localStorage 'goblin:preferred-lang', written during onboarding)
 * and falls back to 'de' when the key is absent. A first-time visitor on the
 * marketing landing has never been through onboarding, so the key is absent and
 * the block spoke German inside a page that is English everywhere else.
 *
 * The landing now DECLARES its language (`<InstallAppBlock lang="en" />`) instead
 * of inheriting an app-scoped preference. These tests pin that: the landing must
 * render English whatever the stored preference says — including 'de', which is
 * the exact state that produced the bug and which fails on the pre-fix code.
 */
test.describe('@public U4 landing i18n', () => {
  test('the install block is English for a first-time visitor', async ({ page }) => {
    await page.goto('/');
    const block = page.getByTestId('install-app-block');
    await expect(block).toBeVisible();

    await expect(block).toContainText('Install Goblin as an app');
    await expect(block).toContainText('On your home screen or dock. No store, no detour.');
    await expect(block).not.toContainText('Goblin als App installieren');
  });

  test('the install block stays English even with a German app preference', async ({ page }) => {
    // The pre-fix code read exactly this key and rendered German here.
    await page.addInitScript(() => localStorage.setItem('goblin:preferred-lang', 'de'));
    await page.goto('/');

    const block = page.getByTestId('install-app-block');
    await expect(block).toBeVisible();
    await expect(block).toContainText('Install Goblin as an app');
    await expect(block).not.toContainText('Goblin als App installieren');
    await expect(block).not.toContainText('Home-Bildschirm');
  });

  test('every platform tab reads from the EN locale keys, not hardcoded copy', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('goblin:preferred-lang', 'de'));
    await page.goto('/');
    await expect(page.getByTestId('install-app-block')).toBeVisible();

    // Each tab's steps are separate locale entries — checking all four proves the
    // whole map resolves through t(), not just whichever tab detection landed on.
    const expected: Record<string, RegExp> = {
      ios: /Tap Share at the bottom[\s\S]*Add to Home Screen/,
      android: /Open the browser menu[\s\S]*Install app/,
      mac: /Open Goblin in Safari[\s\S]*Add to Dock/,
      windows: /Open Goblin in Chrome or Edge[\s\S]*install icon in the address bar/,
    };

    for (const [tab, pattern] of Object.entries(expected)) {
      await page.getByTestId(`install-tab-${tab}`).click();
      const steps = page.getByTestId(`install-steps-${tab}`);
      await expect(steps).toBeVisible();
      await expect(steps).toHaveText(pattern);
    }
  });

  test('the Send-to-Code mock is English too (the second leak the sweep found)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('goblin:preferred-lang', 'de'));
    await page.goto('/');
    // Target the mock illustration itself (.stc-illust), not the surrounding
    // section — the section's English heading would otherwise satisfy a
    // hasText filter while the German mock inside it went unchecked.
    const mock = page.locator('.stc-illust');
    await expect(mock).toBeVisible();

    await expect(mock).toContainText('Send to Code');
    await expect(mock).toContainText('Draft · 2 files');
    await expect(mock).not.toContainText('An Code senden');
    await expect(mock).not.toContainText('Entwurf');
    await expect(mock).not.toContainText('INKLUSIVE');
    await expect(mock).not.toContainText('Kopieren');
  });

  test('no German survives anywhere on the rendered landing', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('goblin:preferred-lang', 'de'));
    await page.goto('/');
    await expect(page.getByTestId('install-app-block')).toBeVisible();

    // Umlauts/ß plus the specific words the two leaks contributed. A whole-page
    // assertion, so a future section that forgets the landing is English is
    // caught here rather than by a founder on prod.
    const body = await page.locator('body').innerText();
    const german = body
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && /[äöüßÄÖÜ]|\b(Entwurf|Dateien|Zeilen|GEÄNDERT|INKLUSIVE|Kopieren|Bildschirm|installieren|hinzufügen)\b/.test(line));

    expect(german, `German strings on the English landing:\n${german.join('\n')}`).toEqual([]);
  });
});
