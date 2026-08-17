/**
 * TESTER-FEEDBACK WAVE — the screenshot harness, checked in so the evidence is
 * reproducible rather than re-improvised (the same reason konsole-shots.mts exists,
 * and this follows its shape rather than inventing a second one).
 *
 *   pnpm --filter @goblin/web exec tsx scripts/tester-wave-shots.mts <outDir>
 *
 * Renders the REAL Header / BottomTabBar and the REAL design tokens, at both widths
 * (1280 desktop, 375 phone) in both themes, in DE and EN.
 *
 * WHAT THESE PNGs PROVE: the markup and the colours. They are rendered from the
 * production components and the production token files.
 * WHAT THEY DO NOT PROVE: behaviour. No server, no session, no data — a live walk needs
 * credentials this session does not have.
 */

import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const OUT = resolve(process.argv[2] ?? join(WEB, '../../evidence/tester-wave-2026-08-17'));

const WIDTHS = { desktop: 1280, phone: 375 } as const;

async function bundle(): Promise<string> {
  const result = await build({
    entryPoints: [join(HERE, 'tester-wave-evidence/mount.tsx')],
    bundle: true,
    write: false,
    format: 'iife',
    jsx: 'automatic',
    target: 'es2022',
    // `process` does not exist in the page; React's dev/prod branch and every
    // NEXT_PUBLIC_* read must resolve at build time or the bundle throws on first
    // evaluation (which is how konsole-shots first produced a black PNG).
    define: { 'process.env.NODE_ENV': '"production"', process: '__process_shim' },
    banner: { js: 'var __process_shim = { env: {} };' },
    plugins: [
      {
        name: 'at-alias',
        setup(b) {
          b.onResolve({ filter: /^@\// }, (args) => {
            const base = join(WEB, args.path.slice(2));
            for (const cand of [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
              if (existsSync(cand) && statSync(cand).isFile()) return { path: cand };
            }
            return { path: base };
          });
        },
      },
      {
        // next/navigation has no meaning outside the Next runtime; the components only
        // reach for it on interactions this harness never performs.
        name: 'next-nav-stub',
        setup(b) {
          b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: join(HERE, 'tester-wave-evidence/next-nav-stub.ts') }));
        },
      },
    ],
    loader: { '.css': 'empty' },
  });
  return result.outputFiles[0]!.text;
}

/** The REAL token files — the whole point is that these are not restated here. */
function css(): string {
  return ['styles/design-tokens.css', 'styles/dashboard-tokens.css']
    .map((p) => {
      try {
        return readFileSync(join(WEB, p), 'utf8');
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

  const executablePath = process.env.PW_CHROMIUM_PATH;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});

  for (const view of ['tabs', 'contrast'] as const) {
    for (const [widthName, width] of Object.entries(WIDTHS) as Array<[keyof typeof WIDTHS, number]>) {
      for (const theme of ['light', 'dark'] as const) {
        for (const lang of ['de', 'en'] as const) {
          // The contrast board is a token proof, not a layout proof — one width and one
          // language is the honest amount of evidence for it.
          if (view === 'contrast' && (widthName === 'phone' || lang === 'en')) continue;

          const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
          // A harness that silently renders a blank page and writes it out as evidence
          // is the worst possible failure here, so page errors are surfaced loudly.
          page.on('pageerror', (err) => console.error('[pageerror]', err.message));
          page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });

          // data-theme is stamped in the SERVED HTML, not from an init script: an init
          // script runs before <html> exists, so setting it there threw and every "dark"
          // frame would have been written out light — evidence that says the opposite of
          // what it claims is worse than no evidence.
          const html = `<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8"><style>body{margin:0}${style}</style></head><body><div id="root"></div></body></html>`;
          await page.route('**/*', (route) => route.fulfill({ contentType: 'text/html', body: html }));
          await page.addInitScript(
            ([v, l]) => {
              localStorage.setItem('goblin:preferred-lang', l as string);
              (window as unknown as { __EVIDENCE_VIEW__: string }).__EVIDENCE_VIEW__ = v as string;
              (window as unknown as { __EVIDENCE_LANG__: string }).__EVIDENCE_LANG__ = l as string;
            },
            [view, lang],
          );
          // A real http origin: the language comes from localStorage exactly as it does
          // in the product, and about:blank has no origin to read one from.
          await page.goto('http://evidence.tester-wave.local/');
          await page.addScriptTag({ content: js });
          await page.waitForTimeout(500);

          const name = view === 'contrast'
            ? `contrast-${theme}.png`
            : `tabs-${widthName}-${theme}-${lang}.png`;
          await page.screenshot({ path: join(OUT, name), fullPage: true });

          // A DOM dump beside each PNG: a pixel diff says "something changed", the text
          // says what — and it is the artifact that can be grepped for "Preview".
          writeFileSync(
            join(OUT, name.replace('.png', '.txt')),
            await page.evaluate(() => document.getElementById('root')?.innerText ?? ''),
            'utf8',
          );

          await page.close();
          console.log(`wrote ${name}`);
        }
      }
    }
  }

  await browser.close();
}

await main();
