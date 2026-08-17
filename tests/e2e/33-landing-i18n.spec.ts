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
   * ── REVISED TWICE ON 2026-08-17 ────────────────────────────────────────────
   *
   * First revision (earlier today) split the rule: landing prose English, the
   * hand-built product mock in the product's own German labels. That mock is
   * now GONE — the founder replaced the whole section with the pitch repo's
   * iPhone mockup (components/landing/sections/PhoneMock.tsx), a replica of the
   * mobile DASHBOARD rather than the chat surface.
   *
   * That makes the split unnecessary, and the rule goes back to being simple:
   * every string on the landing is English, mock included. The difference is
   * not a change of principle but of fact — the dashboard is genuinely
   * localized (app/dashboard/page.tsx and chat/ChatInput.tsx run every string
   * through t()/useLang), so an English visitor really does see the English
   * labels the mock renders. The chat code-block, which does not localize, is
   * no longer depicted anywhere on this page.
   */
  test('the phone mock renders the app strings an English user really sees', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('goblin:preferred-lang', 'de'));
    await page.goto('/');
    const mock = page.locator('.pm-frame');
    await expect(mock).toBeVisible();

    // Chrome + hero, from layout/Header.tsx and app/dashboard/page.tsx (en).
    await expect(mock).toContainText('Chat');
    await expect(mock).toContainText('Tell Goblin what you want');
    await expect(mock).toContainText('A landing page with Stripe checkout in Next.js');
    await expect(mock).toContainText('⇧↵ new line');
    await expect(mock).toContainText('Goblin Swift');

    // Lists, from the same file.
    await expect(mock).toContainText('Your projects');
    await expect(mock).toContainText('+ New project');
    await expect(mock).toContainText("What's new");

    // The label the pitch mock had drifted on: the real one names /help and does
    // NOT promise a changelog (dashboard/page.tsx:561-564).
    await expect(mock).toContainText('Help & FAQ');
    await expect(mock).not.toContainText('All updates');
    await expect(mock).not.toContainText('Alle Updates');
  });

  test('the replaced hand-built mock is gone, invented affordances with it', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.pm-frame')).toBeVisible();

    // The section that was corrected twice and wrong twice.
    await expect(page.locator('.stc-illust')).toHaveCount(0);
    const body = await page.locator('body').innerText();
    // "Draft · 2 files" never existed in the product; neither did a landing
    // promise of a preview surface that is being removed.
    expect(body).not.toContain('Draft · 2 files');
    expect(body).not.toMatch(/\bPreview\b/);
  });

  test('no German survives anywhere on the rendered landing', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('goblin:preferred-lang', 'de'));
    await page.goto('/');
    await expect(page.getByTestId('install-app-block')).toBeVisible();
    await expect(page.locator('.pm-frame')).toBeVisible();

    // Whole-page again, no exclusions: umlauts/ß plus the words the historical
    // leaks contributed. A future section that forgets the landing is English
    // is caught here rather than by a founder on prod.
    const body = await page.locator('body').innerText();
    const german = body
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && /[äöüßÄÖÜ]|\b(Entwurf|Dateien|Zeilen|GEÄNDERT|INKLUSIVE|Kopieren|Bildschirm|installieren|hinzufügen)\b/.test(line));

    expect(german, `German strings on the English landing:\n${german.join('\n')}`).toEqual([]);
  });
});
