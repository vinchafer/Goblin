/**
 * FINAL-POLISH · U4 — evidence generator for the unified loading screen.
 *
 * Renders the REAL PageLoading component (not a mock-up of it) once per context, in both
 * themes, into a 375px-wide contact sheet, then Playwright screenshots it. Re-runnable, so
 * the evidence can be regenerated rather than trusted from a stale PNG.
 *
 *   pnpm --filter @goblin/web render:loading
 *
 * On the language: the component resolves DE·EN through useLang(), whose effect does not
 * run under renderToStaticMarkup — a static render is therefore always the German default.
 * The EN sheet takes the same rendered markup and substitutes the caption with the EN
 * string read from the component's own exported CONTEXT_COPY, so both sheets show real
 * copy from the one source of truth. What the images prove is the thing the founder
 * reported — one mark, one colour, one size, no jump — which is language-independent; the
 * DE/EN strings themselves are asserted in PageLoading.test.ts.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { PageLoading, CONTEXT_COPY, type PageLoadingContext } from '../components/ui/PageLoading';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const OUT = join(WEB, '..', '..', 'evidence', 'final-polish');

const CONTEXTS: PageLoadingContext[] = ['workspace', 'projects', 'chats', 'chat', 'code', 'files', 'none'];

const tokens = readFileSync(join(WEB, 'styles', 'design-tokens.css'), 'utf8');

function sheet(theme: 'light' | 'dark', lang: 'de' | 'en'): string {
  const panels = CONTEXTS.map((ctx) => {
    let html = renderToStaticMarkup(React.createElement(PageLoading, { context: ctx }));
    if (lang === 'en' && ctx !== 'none') {
      html = html.replace(CONTEXT_COPY[ctx].de, CONTEXT_COPY[ctx].en);
    }
    return `
      <section class="sheet-item">
        <div class="sheet-label">context="${ctx}"</div>
        <div class="sheet-frame">${html}</div>
      </section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="${lang}"${theme === 'dark' ? ' data-theme="dark"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=375, initial-scale=1">
<style>${tokens}</style>
<style>
  body { margin: 0; background: var(--surface-page); font-family: system-ui, sans-serif; }
  .sheet-head { padding: 12px 16px; font: 600 12px/1.4 ui-monospace, monospace;
                color: var(--ink-muted); border-bottom: 1px solid var(--div, rgba(0,0,0,.12)); }
  .sheet-item { border-bottom: 1px solid var(--div, rgba(0,0,0,.12)); }
  .sheet-label { padding: 6px 16px; font: 500 10px/1.4 ui-monospace, monospace;
                 color: var(--ink-muted); opacity: .75; }
  .sheet-frame { height: 200px; display: flex; }
  .sheet-frame > div { flex: 1; }
  /* The breath animation is paused so screenshots are deterministic. */
  .goblin-mark--breath { animation: none !important; opacity: 1 !important; }
</style>
</head>
<body>
  <div class="sheet-head">PageLoading — ${theme} · ${lang} · 375px</div>
  ${panels}
</body>
</html>`;
}

mkdirSync(OUT, { recursive: true });
const written: string[] = [];
for (const theme of ['light', 'dark'] as const) {
  for (const lang of ['de', 'en'] as const) {
    const file = join(OUT, `page-loading-${theme}-${lang}.html`);
    writeFileSync(file, sheet(theme, lang), 'utf8');
    written.push(file);
  }
}
console.log(written.join('\n'));
