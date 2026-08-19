import { test, expect } from '@playwright/test';

/**
 * WAVE-KORREKTUR-1 · U2 GATE — the DE · EN switcher and locale propagation.
 *
 * The founder's report: starting on the English landing and clicking through to
 * Login produced a GERMAN login page, with nothing on screen explaining why.
 *
 * Two things had to be true for that to stop being a mystery, and both are
 * pinned here:
 *
 *   1. PROPAGATION — the language a visitor is currently getting must carry
 *      across landing → auth → public content → back, from ONE precedence
 *      (lib/locale.ts): explicit choice > stored preference > browser detection
 *      > surface default. The unit suite (apps/web/lib/locale.test.ts) pins the
 *      precedence itself; this suite pins that the shipped pages obey it.
 *   2. AN EXPLICIT CONTROL — a quiet DE · EN toggle that reports the current
 *      language and sets it, persistently, without a reload.
 *
 * Placement is viewport-dependent by design: the landing nav at ≤860px already
 * carries the lockup, the theme toggle and the primary CTA, so the switcher
 * moves to the footer there. Both @public projects run (Desktop Chrome 1280 and
 * Pixel 7 412), so each placement is exercised by one of them.
 */

const CHOICE_KEY = 'goblin:lang-choice';
const PREF_KEY = 'goblin:preferred-lang';

const isMobile = (width: number) => width <= 860;

test.describe('@public U2 DE/EN switcher', () => {
  test('the switcher is present exactly once per viewport, in the right place', async ({ page }) => {
    await page.goto('/');
    const width = page.viewportSize()!.width;

    const nav = page.locator('nav.lp-nav [data-testid="lang-toggle"]');
    const footer = page.locator('footer.lp-footer [data-testid="lang-toggle"]');

    // Both instances exist in the DOM; CSS decides which one is shown, so assert
    // visibility rather than presence — that is what the user experiences.
    if (isMobile(width)) {
      await expect(nav).toBeHidden();
      await expect(footer).toBeVisible();
    } else {
      await expect(nav).toBeVisible();
      await expect(footer).toBeHidden();
    }
  });

  test('it is a text toggle — no flags, no dropdown chrome', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('[data-testid="lang-toggle"]').first();
    await expect(toggle.getByTestId('lang-toggle-de')).toHaveText('DE');
    await expect(toggle.getByTestId('lang-toggle-en')).toHaveText('EN');
    // No <select>, no flag <img>, and it is named in both languages.
    await expect(toggle.locator('select')).toHaveCount(0);
    await expect(toggle.locator('img')).toHaveCount(0);
    await expect(toggle).toHaveAttribute('aria-label', 'Sprache · Language');
  });

  test('it REPORTS the language currently resolved, which is the whole mystery', async ({ page }) => {
    // A founder whose onboarding answer was German, standing on the English
    // landing: the control must show DE, because that is what /login will give
    // him. Before this wave nothing on the page said so.
    //
    // LANDING-MESSAGING v2 · U6 changed HOW the landing says it, not whether.
    // Now that /de exists the landing's control is a real link (see
    // components/i18n/LangToggle.tsx `landingHrefs`), and a link is not a
    // toggle — aria-pressed is invalid on an anchor, so the active side is
    // marked aria-current="page" instead. The app's control is still a button
    // and still uses aria-pressed; both contracts are pinned, one per surface,
    // so neither can drift into the other.
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [PREF_KEY, 'de']);

    await page.goto('/');
    const landing = page.locator('[data-testid="lang-toggle"]').first();
    await expect(landing).toHaveAttribute('data-lang', 'de');
    await expect(landing.getByTestId('lang-toggle-de')).toHaveAttribute('aria-current', 'page');
    await expect(landing.getByTestId('lang-toggle-en')).not.toHaveAttribute('aria-current', 'page');

    await page.goto('/login');
    const app = page.getByTestId('lang-toggle').first();
    await expect(app).toHaveAttribute('data-lang', 'de');
    await expect(app.getByTestId('lang-toggle-de')).toHaveAttribute('aria-pressed', 'true');
    await expect(app.getByTestId('lang-toggle-en')).toHaveAttribute('aria-pressed', 'false');
  });

  test('on the landing it NAVIGATES: DE goes to /de, EN comes back to /', async ({ page }) => {
    // U6 gave the control a page to switch to. Before /de existed it set a
    // language the page under it could not honour — a German visitor pressed DE
    // and watched nothing change. Clicked for real here, both directions,
    // because the U6 gate only read the href attributes.
    const width = page.viewportSize()!.width;
    const scope = isMobile(width) ? 'footer.lp-footer' : 'nav.lp-nav';

    await page.goto('/');
    await page.locator(`${scope} [data-testid="lang-toggle-de"]`).click();
    await expect(page).toHaveURL(/\/de$/);
    await expect(page.getByRole('heading', { name: /Dein Gerät macht nichts/ })).toBeVisible();

    await page.locator(`${scope} [data-testid="lang-toggle-en"]`).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /Your device does nothing/ })).toBeVisible();
  });

  test("the founder's acceptance test: press DE on the landing → /login is German", async ({ page }) => {
    await page.goto('/');
    const width = page.viewportSize()!.width;
    const scope = isMobile(width) ? 'footer.lp-footer' : 'nav.lp-nav';
    await page.locator(`${scope} [data-testid="lang-toggle-de"]`).click();

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Willkommen zurück' })).toBeVisible();
    await expect(page.getByText('Welcome back')).toHaveCount(0);
  });

  test('…and pressing EN on /login applies instantly, with no reload', async ({ page }) => {
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [CHOICE_KEY, 'de']);
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Willkommen zurück' })).toBeVisible();

    // Mark the document so a full navigation would be detectable.
    await page.evaluate(() => { (window as unknown as { __noReload: boolean }).__noReload = true; });
    await page.getByTestId('lang-toggle-en').click();

    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
  });

  test('the choice persists across navigation and page loads', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('lang-toggle-de').click();
    await expect(page.getByRole('heading', { name: 'Willkommen zurück' })).toBeVisible();

    expect(await page.evaluate(k => localStorage.getItem(k), CHOICE_KEY)).toBe('de');

    // This step used to hop through /about. It cannot any more: /about and
    // /manifesto are served in English to everyone until real German prose
    // exists (founder decision — see the English-only block at the end of this
    // file), so they would prove nothing about persistence. /help is the
    // equivalent public content page that DOES still follow the switcher.
    await page.goto('/help');
    await expect(page.getByRole('heading', { name: 'Hilfe', exact: true })).toBeVisible();

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Willkommen zurück' })).toBeVisible();
  });

  test('an explicit choice outranks a stored onboarding preference', async ({ page }) => {
    await page.addInitScript(
      ([ck, pk]) => { localStorage.setItem(ck, 'en'); localStorage.setItem(pk, 'de'); },
      [CHOICE_KEY, PREF_KEY],
    );
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByText('Willkommen zurück')).toHaveCount(0);
  });

  test('the switcher never writes the onboarding key — the two meanings stay separate', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('lang-toggle-de').click();
    expect(await page.evaluate(k => localStorage.getItem(k), PREF_KEY)).toBeNull();
  });
});

test.describe('@public U2 locale propagation across the public surfaces', () => {
  // Each entry: the surface, plus a string that exists in exactly one locale.
  //
  // WAVE-ABOUT-MANIFESTO added the `role` field. Most of these surfaces are
  // forms whose H1 IS a translated label, so a heading is the natural probe. The
  // two prose pages are not: their H1 is the copy's opening line, and that copy
  // is English in both locales while the German prose is outstanding (the
  // `@needs-german` keys in apps/web/lib/copy/{about,manifesto}.ts). Their
  // localised element is the back link — so those two assert on a link.
  // /about and /manifesto are deliberately NOT in this matrix — see the
  // English-only describe block at the end of this file. They are the two
  // surfaces that intentionally do not follow the switcher right now.
  const SURFACES = [
    { path: '/login', role: 'heading' as const, de: 'Willkommen zurück', en: 'Welcome back' },
    { path: '/login?mode=signup', role: 'heading' as const, de: 'Erstelle dein Konto', en: 'Create your account' },
    { path: '/help', role: 'heading' as const, de: 'Hilfe', en: 'Help' },
    { path: '/auth/reset-password', role: 'heading' as const, de: 'Neues Passwort setzen', en: 'Set new password' },
  ];

  for (const s of SURFACES) {
    test(`${s.path} follows an explicit DE choice`, async ({ page }) => {
      await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [CHOICE_KEY, 'de']);
      await page.goto(s.path);
      await expect(page.getByRole(s.role, { name: s.de, exact: true })).toBeVisible();
    });

    test(`${s.path} follows an explicit EN choice`, async ({ page }) => {
      await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [CHOICE_KEY, 'en']);
      await page.goto(s.path);
      await expect(page.getByRole(s.role, { name: s.en, exact: true })).toBeVisible();
    });
  }

  test('a clean English visitor gets ENGLISH public content — the leak U2 closed', async ({ page }) => {
    // Before this wave /about and /help were bound to the APP locale hook, whose
    // surface default is German, so this exact visitor — one click from the
    // English landing footer — got a German page.
    await page.goto('/about');
    await expect(page.getByRole('link', { name: '← Back', exact: true })).toBeVisible();
    await page.goto('/help');
    await expect(page.getByRole('heading', { name: 'Help', exact: true })).toBeVisible();
  });
});

/**
 * FOLLOW-UP (founder decision 2026-08-10) — /about and /manifesto are served in
 * English to EVERYONE until real German prose exists.
 *
 * The first cut translated the chrome ("Über uns", "← Zurück") while the
 * long-form copy stayed English behind `@needs-german`, which read as a broken
 * translation rather than a declared gap. These tests pin the decision, and —
 * more importantly — pin that the two halves cannot drift apart: an English
 * document must never announce itself as `lang="de"`.
 *
 * This is the one place in the suite where NOT following the switcher is the
 * correct behaviour, so it is asserted explicitly rather than left to the
 * absence of a test.
 */
test.describe('@public prose pages are English-only until the German lands', () => {
  // The two strings that were German before this decision, per page. Asserting
  // the eyebrow EXACTLY rather than by substring is deliberate: /manifesto's
  // English eyebrow is "Manifesto", which contains the German "Manifest", so a
  // substring check cannot tell the two apart.
  const PAGES = [
    { path: '/about', eyebrow: 'About', wasGerman: 'Über uns' },
    { path: '/manifesto', eyebrow: 'Manifesto', wasGerman: 'Manifest' },
  ];

  for (const { path, eyebrow, wasGerman } of PAGES) {
    test(`${path} stays English under an explicit DE choice`, async ({ page }) => {
      await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [CHOICE_KEY, 'de']);
      await page.goto(path);

      await expect(page.getByRole('link', { name: '← Back', exact: true })).toBeVisible();
      await expect(page.getByText('← Zurück')).toHaveCount(0);
      // The eyebrow is the other string that used to be translated. Exact text,
      // so "Manifesto" cannot be mistaken for the German "Manifest".
      await expect(page.locator('.lp-prose .eyebrow')).toHaveText(eyebrow);
      await expect(page.locator('.lp-prose .eyebrow')).not.toHaveText(wasGerman);
    });

    test(`${path} declares lang="en" even for a DE visitor`, async ({ page }) => {
      await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [CHOICE_KEY, 'de']);
      await page.goto(path);
      // An English page announced as German is read aloud with the wrong
      // pronunciation rules — the same defect class PR #68 raised, inverted.
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });
  }

  // The decision must not leak into the rest of the site: the switcher still
  // works, and the surfaces that DO have German still get it.
  test('the DE choice still applies everywhere else', async ({ page }) => {
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [CHOICE_KEY, 'de']);
    await page.goto('/about');
    await expect(page.getByRole('link', { name: '← Back', exact: true })).toBeVisible();
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Willkommen zurück' })).toBeVisible();
  });
});
