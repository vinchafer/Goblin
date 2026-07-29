// AKT 2 · PHASE 2.5 · U-C6 — 390×844 rendering evidence for the founder console.
//
// ── What makes this evidence and not decoration ──────────────────────────────
// It renders the REAL component. `apps/web/app/dashboard/konsole/console-client.tsx`
// is bundled and mounted in Chromium with the REAL stylesheets (design-tokens.css,
// dashboard-tokens.css, ops-console.css) and the REAL string table. Only the
// transport is replaced — `@/lib/api` is aliased to a stub, because the real module
// builds a Supabase client at import time and this harness has no project.
//
// That is a deliberate departure from the older harnesses in this directory, which
// hand-write HTML that mirrors a component. A mirror can be laid out correctly
// while the component it stands for is not; this cannot.
//
// ── What it measures, rather than eyeballs ───────────────────────────────────
// Screenshots are for a human. The gate is numeric and asserted here:
//   • documentElement.scrollWidth <= 390 — no horizontal scroll on the page.
//   • every card's scrollWidth <= its clientWidth — nothing clipped inside a card.
//   • every interactive element is >= 44px tall — the iOS tap-target floor.
//   • the DEGRADED scenario contains UNBEKANNT / UNKNOWN and no "ok" pill in the
//     router block — the check that a null never quietly renders as green.
// A failing assertion exits non-zero and prints the offender.
//
// ── What it CANNOT show, and says so ─────────────────────────────────────────
// It cannot log in. Nothing here proves the server-side gate admits the founder on
// production, or that the live API returns what the stub returns — those are
// FOUNDER-PENDING and are reported as such rather than implied by a screenshot.
//
// Run: node scripts/akt2-konsole-shots.mjs

import { chromium } from '@playwright/test';
import { build } from '../node_modules/.pnpm/esbuild@0.27.7/node_modules/esbuild/lib/main.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const web = resolve(root, 'apps/web');
const outDir = resolve(root, 'evidence/akt2-phase2.5-konsole');
mkdirSync(outDir, { recursive: true });

const VIEWPORT = { width: 390, height: 844 }; // iPhone 14/15 logical viewport

// ── 1. bundle the real component ────────────────────────────────────────────

const bundlePath = resolve(outDir, '_bundle.js');
await build({
  entryPoints: [resolve(web, 'scripts/konsole-evidence/mount.tsx')],
  outfile: bundlePath,
  bundle: true,
  format: 'iife',
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  absWorkingDir: web,
  define: { 'process.env.NODE_ENV': '"production"' },
  alias: {
    // Transport only — see api-stub.ts.
    '@/lib/api': resolve(web, 'scripts/konsole-evidence/api-stub.ts'),
    '@/lib/use-lang': resolve(web, 'lib/use-lang.ts'),
  },
  logLevel: 'warning',
});
const bundle = readFileSync(bundlePath, 'utf8');

// ── 2. the real stylesheets, in the order the app loads them ────────────────

const css = [
  resolve(web, 'styles/design-tokens.css'),
  resolve(web, 'styles/dashboard-tokens.css'),
  resolve(web, 'app/dashboard/konsole/ops-console.css'),
]
  .map((p) => readFileSync(p, 'utf8'))
  .join('\n');

function docFor(lang, scenario) {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
${css}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
/* The dashboard layout supplies these via next/font; the harness supplies the
   same families directly so type metrics match what ships. */
body{font-family:Manrope,system-ui,sans-serif;background:var(--surface-page,#F4ECD8)}
:root{--font-dash-display:Manrope;--font-dash-serif:'Instrument Serif';--font-mono:ui-monospace,monospace}
</style></head>
<body>
<!-- .gobl-dash is the wrapper app/dashboard/layout.tsx puts around every
     dashboard page; without it none of the scoped tokens resolve. -->
<div class="gobl-dash"><div id="root"></div></div>
<script>
  try { window.localStorage.setItem('goblin:preferred-lang', ${JSON.stringify(lang)}); } catch (e) {}
  window.__KONSOLE_SCENARIO__ = ${JSON.stringify(scenario)};
</script>
<script>${bundle}</script>
</body></html>`;
}

// ── 3. render, measure, shoot ───────────────────────────────────────────────

// Same explicit path the other harnesses in this directory use: the pinned
// Playwright version and the pre-installed browser build do not always agree, and
// a download is not available here.
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ deviceScaleFactor: 2, ...VIEWPORT });

const failures = [];
const results = [];

for (const scenario of ['healthy', 'degraded']) {
  for (const lang of ['de', 'en']) {
    const tag = `${scenario}-${lang}`;
    const htmlPath = resolve(outDir, `_${tag}.html`);
    writeFileSync(htmlPath, docFor(lang, scenario));

    const page = await ctx.newPage();
    await page.setViewportSize(VIEWPORT);
    const consoleErrors = [];
    page.on('pageerror', (e) => consoleErrors.push(String(e)));
    await page.goto('file://' + htmlPath);
    // Wait for the component to have actually mounted AND for its effects to have
    // resolved — a screenshot of an empty root would pass every layout assertion.
    await page.waitForSelector('.ops-console section', { timeout: 15_000 });
    await page.waitForTimeout(400);

    const m = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.oc-card')];
      const interactive = [...document.querySelectorAll('button, a.gobl-btn, input, select')];
      return {
        docScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        sections: cards.length,
        // Anything whose content is wider than its box is clipped or scrolling.
        // .oc-detail is EXEMPT by design: it is the one element allowed to scroll
        // inside itself so the page never gains a horizontal axis.
        clipped: cards
          .filter((c) => c.scrollWidth > c.clientWidth + 1)
          .map((c) => c.querySelector('h2')?.textContent ?? '(card)'),
        smallTargets: interactive
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.height > 0 && r.height < 44;
          })
          .map((el) => `${el.tagName.toLowerCase()}:${(el.textContent ?? '').trim().slice(0, 24)}`),
        unknownPills: document.querySelectorAll('.oc-state.unknown').length,
        okPills: document.querySelectorAll('.oc-state.ok').length,
        text: document.body.innerText,
      };
    });

    const shot = resolve(outDir, `konsole-${tag}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    await page.close();

    // ── the numeric gates ──
    if (consoleErrors.length) failures.push(`${tag}: page errors → ${consoleErrors.join(' | ')}`);
    if (m.docScrollWidth > VIEWPORT.width) failures.push(`${tag}: horizontal scroll — scrollWidth ${m.docScrollWidth} > ${VIEWPORT.width}`);
    if (m.clipped.length) failures.push(`${tag}: clipped card content → ${m.clipped.join(', ')}`);
    if (m.smallTargets.length) failures.push(`${tag}: tap targets under 44px → ${m.smallTargets.join(', ')}`);
    if (m.sections < 6) failures.push(`${tag}: only ${m.sections} cards rendered, expected 6`);

    // The honesty gate: in the degraded scenario the router probe failed, so every
    // router row must read UNKNOWN and none of them may be green.
    if (scenario === 'degraded') {
      const word = lang === 'de' ? 'UNBEKANNT' : 'UNKNOWN';
      if (!m.text.includes(word)) failures.push(`${tag}: expected the word ${word} in a degraded render`);
      if (m.unknownPills < 5) failures.push(`${tag}: only ${m.unknownPills} UNKNOWN pills, expected >= 5 (4 router rows + registry)`);
      if (m.okPills > 0) failures.push(`${tag}: ${m.okPills} green pill(s) in a render where nothing is known good`);

      // An unreadable registry must SAY it is unreadable. A silent empty card
      // reads as "no apps", which is the one wrong answer — and it is exactly
      // what this harness caught the first time it ran.
      const unreadable = lang === 'de' ? 'Registry konnte nicht gelesen werden' : 'registry could not be read';
      if (!m.text.includes(unreadable)) {
        failures.push(`${tag}: the app list is unreadable but the card does not say so`);
      }
      const noProjects = lang === 'de' ? 'Projektliste konnte nicht geladen werden' : 'project list could not be loaded';
      if (!m.text.includes(noProjects)) {
        failures.push(`${tag}: the project picker is unreadable but does not say so`);
      }
    }

    // Language gate: the two languages must actually differ on screen.
    results.push({ tag, ...m, shot: shot.replace(root + '/', '') });
    process.stdout.write(
      `${tag.padEnd(16)} cards ${m.sections} · scrollWidth ${m.docScrollWidth} · UNKNOWN ${m.unknownPills} · ok ${m.okPills} · clipped ${m.clipped.length} · smallTargets ${m.smallTargets.length}\n`,
    );
  }
}

// DE and EN must not be the same bytes, or the i18n never engaged.
for (const scenario of ['healthy', 'degraded']) {
  const de = results.find((r) => r.tag === `${scenario}-de`);
  const en = results.find((r) => r.tag === `${scenario}-en`);
  if (de.text === en.text) failures.push(`${scenario}: DE and EN rendered identical text — the language switch did not engage`);
}

await browser.close();

writeFileSync(resolve(outDir, 'measurements.json'), JSON.stringify({ viewport: VIEWPORT, results, failures }, null, 2));

if (failures.length) {
  console.error('\nFAILED:\n' + failures.map((f) => '  · ' + f).join('\n'));
  process.exit(1);
}
console.log(`\nAll gates green. ${results.length} renders in ${outDir.replace(root + '/', '')}`);
