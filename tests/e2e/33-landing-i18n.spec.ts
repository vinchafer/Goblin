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

  /**
   * ── REVISED 2026-08-17 (TESTER-FEEDBACK wave) ──────────────────────────────
   *
   * This test used to assert the opposite: that the Send-to-Code mock renders
   * in ENGLISH. That assertion was written on a premise that turned out to be
   * false — U4's note reads "the product itself is bilingual (useLang), so an
   * English visitor really does see these controls in English." Re-checked
   * against the components:
   *
   *   • components/workspace/CodeBlock.tsx imports no i18n. "Kopieren" (:83)
   *     and "An Code senden" (:102) are hardcoded German for every user.
   *   • components/app-shell/model-switcher.tsx:329 hardcodes 'INKLUSIVE'.
   *   • components/code/FileCardList.tsx DOES use useLang/t — "NEW",
   *     "CHANGED", "12 lines", "Filter files…" are real for an English user.
   *
   * So the English mock was a dressed-up screenshot: it showed a product that
   * does not exist. An expert tester's verdict on this section was "it looks
   * completely different from the real app."
   *
   * The rule is therefore split, and this suite now pins BOTH halves:
   *   • Landing PROSE and CHROME stay English (PR #81) — the install block,
   *     headings, leads, captions, everything the site says in its own voice.
   *   • The product MOCK shows the product's own labels, because a picture of
   *     a screen is a depiction, not prose — and a caption in the site's voice
   *     tells the English reader what they are looking at.
   */
  test('the Send-to-Code mock shows the product labels the product really renders', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('goblin:preferred-lang', 'de'));
    await page.goto('/');
    // Target the mock illustration itself (.stc-illust), not the surrounding
    // section — the section's English heading would otherwise satisfy a
    // hasText filter while the mock inside it went unchecked.
    const mock = page.locator('.stc-illust');
    await expect(mock).toBeVisible();

    // German where the product is German-only.
    await expect(mock).toContainText('An Code senden');
    await expect(mock).toContainText('Kopieren');
    await expect(mock).toContainText('INKLUSIVE');
    // English where the product genuinely localizes.
    await expect(mock).toContainText('Filter files…');
    await expect(mock).toContainText('CHANGED');
    await expect(mock).toContainText('NEW');
    await expect(mock).toContainText('lines');

    // The invented affordances are gone: the real code tab has a filter field,
    // not a "Draft · N files" pill.
    await expect(mock).not.toContainText('Draft · 2 files');
    await expect(mock).not.toContainText('Entwurf');

    // ... and the mixture is explained in the site's own voice, in English.
    await expect(page.locator('.stc-caption')).toContainText('still in German');
  });

  test('no German survives in the landing prose (the mock is the one exception)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('goblin:preferred-lang', 'de'));
    await page.goto('/');
    await expect(page.getByTestId('install-app-block')).toBeVisible();

    // Everything the SITE says must be English. The product screenshot is
    // excluded by removing it from the DOM before reading the text, so the
    // sweep still fails on a future section that forgets the landing is
    // English — which is the leak this test was written for.
    const body = await page.evaluate(() => {
      const clone = document.body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.stc-illust').forEach((el) => el.remove());
      return clone.innerText;
    });
    const german = body
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && /[äöüßÄÖÜ]|\b(Entwurf|Dateien|Zeilen|GEÄNDERT|INKLUSIVE|Kopieren|Bildschirm|installieren|hinzufügen)\b/.test(line));

    expect(german, `German strings in the English landing prose:\n${german.join('\n')}`).toEqual([]);
  });
});
