import { test, expect } from '@playwright/test';

/**
 * WAVE-ABOUT-MANIFESTO GATE — the two public prose pages.
 *
 * Both routes existed before this wave and both were placeholders: /about
 * carried unrelated "calm, not cluttered" copy, /manifesto carried "Simplicity
 * is the moat" and had no locale binding at all. This suite pins the things that
 * would be silently wrong if either page drifted back.
 *
 * Runs in both @public projects — Desktop Chrome 1280 and Pixel 7 412 — so every
 * assertion below is made at a phone width too, which is the width this product
 * claims as its first target.
 */

const LOAD_HOOKS = [
  // The sentences the copy is built around. If a rewrite drops the emphasis
  // markup, `<strong>` disappears and these fail — which is the point: they are
  // load-bearing lines, not decoration.
  { path: '/manifesto', text: "A tool you can't trust isn't a tool — it's a slot machine." },
  { path: '/manifesto', text: 'you can leave.' },
  { path: '/about', text: 'ship' },
];

test.describe('@public about + manifesto', () => {
  test('/about opens on the line the page is built on', async ({ page }) => {
    await page.goto('/about');
    await expect(
      page.getByRole('heading', { name: 'I started this in a hotel room in Argentina.', level: 1 }),
    ).toBeVisible();
    // The three section heads, in order — the page reads completely on its own.
    for (const head of ['The thing nobody says out loud', 'What it is', "Who's behind it"]) {
      await expect(page.getByRole('heading', { name: head, level: 2 })).toBeVisible();
    }
  });

  test('/about links to the manifesto at the marked spot', async ({ page }) => {
    await page.goto('/about');
    const link = page.getByTestId('about-manifesto-link');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/manifesto');
    await link.click();
    await expect(page).toHaveURL(/\/manifesto$/);
    await expect(page.getByRole('heading', { name: 'Seven things we believe', level: 1 })).toBeVisible();
  });

  test('/manifesto ships exactly seven beliefs, numbered', async ({ page }) => {
    await page.goto('/manifesto');
    const beliefs = page.getByTestId('manifesto-beliefs').locator('.lp-belief');
    await expect(beliefs).toHaveCount(7);

    const titles = [
      'Honest beats impressive.',
      'You own what you build.',
      'The phone is a real computer.',
      'No meter on your thinking.',
      'Generating is not shipping.',
      "Building shouldn't need permission.",
      "One price for the world isn't fair — it's lazy.",
    ];
    for (const [i, title] of titles.entries()) {
      await expect(beliefs.nth(i).getByRole('heading', { level: 3 })).toHaveText(title);
    }

    // The numbering is GENERATED from the items, not typed next to them, so it
    // cannot drift from the count asserted above. Chromium reports `content` for
    // a counter unresolved (`counter(belief, decimal-leading-zero)` rather than
    // "01"), so this asserts the mechanism rather than the rendered glyph — the
    // glyphs themselves are in the wave's screenshots. Every belief must carry
    // it, or one item would silently render without a number.
    const numbers = beliefs.locator('.lp-belief-num');
    await expect(numbers).toHaveCount(titles.length);
    for (let i = 0; i < titles.length; i++) {
      const content = await numbers.nth(i).evaluate(
        (el) => getComputedStyle(el, '::before').content,
      );
      expect(content).toContain('counter(belief');
    }
  });

  test('/manifesto ends on the CTA into signup', async ({ page }) => {
    await page.goto('/manifesto');
    await expect(page.getByText('Tell it what you want. It ships.')).toBeVisible();
    const cta = page.getByRole('link', { name: /Start building free/ });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/register');
    // The subline is a factual claim about the trial — it must keep matching the
    // one the landing and the help content make (7 days, no card at signup).
    await expect(page.getByText('7 days · no credit card')).toBeVisible();
  });

  for (const hook of LOAD_HOOKS) {
    test(`${hook.path} keeps "${hook.text.slice(0, 28)}…" bolded`, async ({ page }) => {
      await page.goto(hook.path);
      await expect(page.locator('.lp-prose strong', { hasText: hook.text }).first()).toBeVisible();
    });
  }

  // Both pages must be reachable from the footer of every page that has one —
  // that is the only navigation into them.
  test('the footer links to both pages, from both pages', async ({ page }) => {
    for (const from of ['/', '/about', '/manifesto']) {
      await page.goto(from);
      const footer = page.locator('footer.lp-footer');
      await expect(footer.getByRole('link', { name: 'About', exact: true })).toHaveAttribute('href', '/about');
      await expect(footer.getByRole('link', { name: 'Manifesto', exact: true })).toHaveAttribute('href', '/manifesto');
    }
  });

  // The nav is reused from the landing, where its links are in-page anchors.
  // On these pages they must navigate home instead of doing nothing.
  test('the reused nav has no dead anchor links', async ({ page }) => {
    await page.goto('/about');
    for (const [label, hash] of [['Pricing', '/#pricing'], ['FAQ', '/#faq']] as const) {
      const link = page.locator('nav.lp-nav').getByRole('link', { name: label, exact: true });
      // Hidden by CSS at ≤860px; the desktop project is the one that sees them.
      if (await link.isVisible()) await expect(link).toHaveAttribute('href', hash);
    }
  });

  // 320px is the floor the design targets. A page that scrolls sideways there is
  // broken regardless of how it looks in a screenshot.
  test('neither page scrolls horizontally at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    for (const path of ['/about', '/manifesto']) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} overflows by ${overflow}px at 320`).toBeLessThanOrEqual(0);
    }
  });

  test('both pages carry their own title and description', async ({ page }) => {
    for (const [path, title] of [['/about', 'About — Goblin'], ['/manifesto', 'Manifesto — Goblin']] as const) {
      await page.goto(path);
      await expect(page).toHaveTitle(title);
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      expect(description && description.length).toBeGreaterThan(50);
    }
  });
});
