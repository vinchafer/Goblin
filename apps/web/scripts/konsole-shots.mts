/**
 * AKT 2 · PHASE 3 · U3.3 — the founder console's screenshot harness, checked in.
 *
 * Phase 2.5 produced its console screenshots from a one-off script that was never
 * committed, so the PNGs in evidence/akt2-phase2.5-konsole/ cannot be regenerated
 * from the repo. This is that script, written down, so the next phase's evidence
 * is reproducible rather than re-improvised.
 *
 * It renders the REAL component (scripts/konsole-evidence/mount.tsx) with only the
 * transport replaced, at the phone width the gate names — 390px — in both
 * languages and both scenarios.
 *
 *   pnpm --filter @goblin/web exec tsx scripts/konsole-shots.mts <outDir>
 */

import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const OUT = resolve(process.argv[2] ?? join(WEB, '../../evidence/akt2-phase3-konsole'));

/** 390px is the iPhone width the founder actually tests on. */
const VIEWPORT = { width: 390, height: 900 };

async function bundle(): Promise<string> {
  const result = await build({
    entryPoints: [join(HERE, 'konsole-evidence/mount.tsx')],
    bundle: true,
    write: false,
    format: 'iife',
    jsx: 'automatic',
    target: 'es2022',
    // `process` does not exist in the page. React's dev/prod branch and any
    // NEXT_PUBLIC_* read must be resolved at build time or the bundle throws on
    // first evaluation — which is how this harness first produced a black PNG.
    define: { 'process.env.NODE_ENV': '"production"', process: '__process_shim' },
    banner: { js: 'var __process_shim = { env: {} };' },
    // The console imports from `@/...`; map the alias the way tsconfig does.
    plugins: [
      {
        name: 'at-alias',
        setup(b) {
          b.onResolve({ filter: /^@\// }, (args) => {
            // The transport stub FIRST. A plugin resolver outranks esbuild's
            // `alias` option, so putting it only in `alias` silently loaded the
            // real lib/api — which is how the first run rendered a console whose
            // every card said "die API war nicht erreichbar".
            if (args.path === '@/lib/api') return { path: join(HERE, 'konsole-evidence/api-stub.ts') };
            const base = join(WEB, args.path.slice(2));
            for (const cand of [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
              if (existsSync(cand) && statSync(cand).isFile()) return { path: cand };
            }
            return { path: base };
          });
        },
      },
    ],
    loader: { '.css': 'empty' },
  });
  return result.outputFiles[0]!.text;
}

function css(): string {
  return [
    join(WEB, 'styles/dashboard-tokens.css'),
    join(WEB, 'app/dashboard/konsole/ops-console.css'),
  ]
    .map((p) => {
      try {
        return readFileSync(p, 'utf8');
      } catch {
        return '';
      }
    })
    .join('\n');
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const js = await bundle();
  const style = css();

  // The browser: whatever Playwright resolves by default, unless the environment
  // pins one. A CI image whose bundled Chromium does not match the installed
  // @playwright/test revision is common enough that failing on it would make this
  // harness unrunnable exactly where evidence matters most.
  const executablePath = process.env.PW_CHROMIUM_PATH;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  for (const scenario of ['healthy', 'degraded'] as const) {
    for (const lang of ['de', 'en'] as const) {
      const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 });
      // A harness that renders a blank page and writes it out as evidence would be
      // the worst possible failure mode here, so page errors are surfaced loudly.
      page.on('pageerror', (err) => console.error('[pageerror]', err.message));
      page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
      const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#0f1512}${style}</style><div id="root"></div>`;
      // Served from a real http origin rather than set as content: the console
      // reads its language from localStorage exactly as the product does, and
      // about:blank has no origin to read one from.
      await page.route('**/*', (route) => route.fulfill({ contentType: 'text/html', body: html }));
      await page.addInitScript(
        ([s, l]) => {
          // The product's own key (lib/use-lang.ts) — not an override, so DE and
          // EN come out of the same code path a real user goes through.
          localStorage.setItem('goblin:preferred-lang', l as string);
          (window as unknown as { __KONSOLE_SCENARIO__: string }).__KONSOLE_SCENARIO__ = s as string;
        },
        [scenario, lang],
      );
      await page.goto('http://konsole.evidence.local/');
      await page.addScriptTag({ content: js });
      await page.waitForTimeout(600);

      // Open the first review item's preview and its decision panel, so the
      // screenshot shows the thing the gate is actually about: candidate source
      // rendered as inert text, and a reason field that gates the reject button.
      if (scenario === 'healthy') {
        const previewBtn = page.locator('.oc-card', { hasText: lang === 'de' ? 'Prüfliste' : 'Review queue' }).locator('button').first();
        await previewBtn.click().catch(() => {});
        await page.waitForTimeout(400);
        const decideBtn = page
          .locator('.oc-card', { hasText: lang === 'de' ? 'Prüfliste' : 'Review queue' })
          .locator('button', { hasText: lang === 'de' ? 'Freigeben / Ablehnen' : 'Approve / Reject' })
          .first();
        await decideBtn.click().catch(() => {});
        await page.waitForTimeout(300);
      }

      // Nothing may overflow the phone. A card that is 12px too wide is invisible
      // in a screenshot and very visible on the device, so it is measured rather
      // than eyeballed.
      const overflow = await page.evaluate(
        (w) => Array.from(document.querySelectorAll<HTMLElement>('.oc-card, .oc-card *'))
          .filter((el) => el.getBoundingClientRect().right > w + 1)
          .map((el) => `${el.className || el.tagName}:${Math.round(el.getBoundingClientRect().right)}px`),
        VIEWPORT.width,
      );
      if (overflow.length) console.error(`[overflow ${scenario}/${lang}]`, overflow.slice(0, 8).join(' · '));

      const file = join(OUT, `konsole-390-${scenario}-${lang}.png`);
      await page.screenshot({ path: file, fullPage: true });

      // The full page is ~14,000px tall and unreadable as a review artifact, so
      // the card the phase is actually about gets its own frame.
      await page
        .locator('.oc-card', { hasText: lang === 'de' ? 'Prüfliste' : 'Review queue' })
        .first()
        .screenshot({ path: join(OUT, `reviewcard-390-${scenario}-${lang}.png`) })
        .catch(() => {});

      // A DOM dump beside each PNG: a pixel diff says "something changed", the
      // text says what. Both are cheap; only one is readable in a review.
      writeFileSync(
        join(OUT, `konsole-390-${scenario}-${lang}.txt`),
        await page.evaluate(() => document.getElementById('root')?.innerText ?? ''),
        'utf8',
      );
      await page.close();
      // eslint-disable-next-line no-console
      console.log(`wrote ${file}`);
    }
  }
  await browser.close();
}

await main();
