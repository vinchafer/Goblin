/**
 * browser.mjs — resolve Playwright's chromium without adding a dependency.
 *
 * Playwright is already available to this repo (`@playwright/test` is a
 * devDependency and drives the e2e suite). This helper accepts either that
 * package or a plain `playwright` install, so the content tooling never needs
 * an install of its own.
 */
import { createRequire } from 'node:module';

export async function loadChromium() {
  // CommonJS resolution is used deliberately: it walks node_modules *and*
  // honours NODE_PATH, so a repo install and a global install both work.
  const require = createRequire(import.meta.url);
  const tried = [];
  for (const spec of ['playwright', '@playwright/test', 'playwright-core']) {
    try {
      const mod = require(spec);
      const chromium = mod.chromium ?? mod.default?.chromium;
      if (chromium) return { chromium, from: spec };
      tried.push(`${spec}: no chromium export`);
    } catch (err) {
      tried.push(`${spec}: ${err.code ?? err.message}`);
    }
  }
  throw new Error(
    'Playwright not resolvable. Run `pnpm install` at the repo root, or set\n' +
    'NODE_PATH to a directory containing a playwright install.\n  ' + tried.join('\n  ')
  );
}

/** Relative luminance / contrast ratio per WCAG 2.1 — used by the §A2.5 gate. */
export function relativeLuminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`expected #rrggbb, got ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg, bg) {
  const a = relativeLuminance(fg), b = relativeLuminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}
