/**
 * Mic-contrast evidence — the defect and the fix, measured from the real token
 * files and rendered as the icon a user actually looks at.
 *
 *   pnpm --filter @goblin/web exec tsx scripts/mic-contrast-evidence.ts <outDir>
 *
 * Same method as the dark-contrast wave (PR #104): values are READ out of
 * styles/design-tokens.css rather than restated here, so this cannot drift from
 * what ships. The swatch is the composer's real surface — a 5% bone wash over
 * --ink-deep — with the real 18px mic path from ChatInput.tsx.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { contrastRatio, compositeOver, parseColor, AA_BODY, AA_NON_TEXT } from '../lib/contrast';

const OUT = process.argv[2] ?? 'evidence/mic-contrast-2026-08-18';
mkdirSync(OUT, { recursive: true });

const css = readFileSync(join(__dirname, '../styles/design-tokens.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Scope-aware, deliberately. A first-match regex over the file is exactly the trap
 * that produced a wrong drift report elsewhere in this strand: `--rust` is declared
 * BOTH at :root and inside `.gobl-composer-row-oncard`, and a scope-blind read
 * returns the fixed value while claiming to report the broken one.
 */
function declarations(match: (selector: string) => boolean): Record<string, string> {
  const out: Record<string, string> = {};
  const blocks = /([^{}]+)\{([^{}]*)\}/g;
  let block: RegExpExecArray | null;
  while ((block = blocks.exec(css))) {
    if (!match(block[1]!.trim())) continue;
    const decls = /(--[\w-]+)\s*:\s*([^;]+);/g;
    let d: RegExpExecArray | null;
    while ((d = decls.exec(block[2]!))) out[d[1]!] = d[2]!.trim();
  }
  return out;
}

const ROOT = declarations((sel) => sel === ':root');
const ONCARD = { ...ROOT, ...declarations((sel) => sel === '.gobl-composer-row-oncard') };

const litIn = (map: Record<string, string>, name: string, depth = 0): string => {
  if (depth > 12) throw new Error(`var() loop at ${name}`);
  const v = map[name];
  if (v === undefined) throw new Error(`token ${name} not found`);
  const ref = /^var\((--[\w-]+)\)$/.exec(v);
  return ref ? litIn(map, ref[1]!, depth + 1) : v;
};
const lit = (name: string) => litIn(ROOT, name);

const hex = (c: number[]) => `#${c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const composer = hex(compositeOver(parseColor('rgba(244,236,216,0.05)')!, parseColor(lit('--ink-deep'))!));

const ROWS = [
  // before = the token as the LIGHT page resolves it; after = the same token name
  // as the scoped block resolves it. Both read from CSS, never restated.
  { what: 'idle mic', token: '--text-2', min: AA_NON_TEXT, kind: 'icon (1.4.11)' },
  { what: 'recording mic', token: '--rust', min: AA_NON_TEXT, kind: 'icon (1.4.11)' },
  { what: 'dictation label', token: '--meta', min: AA_BODY, kind: 'text (AA body)' },
];

const measured = ROWS.map((r) => {
  const before = litIn(ROOT, r.token);
  const after = litIn(ONCARD, r.token);
  return { ...r, before, after, rBefore: contrastRatio(before, composer)!, rAfter: contrastRatio(after, composer)! };
});

writeFileSync(join(OUT, 'contrast-table.md'), [
  '# Mic contrast on the dashboard hero composer',
  '',
  `Surface: \`rgba(244,236,216,.05)\` over \`--ink-deep\` ${lit('--ink-deep')} = **${composer}**.`,
  'Values read from `apps/web/styles/design-tokens.css`, ratios by `lib/contrast.ts` (WCAG 2.1).',
  '',
  '| Element | Token | Threshold | Before | Ratio | After | Ratio | Verdict |',
  '|---|---|---|---|---|---|---|---|',
  ...measured.map((m) =>
    `| ${m.what} | \`${m.token}\` | ${m.kind} ≥ ${m.min}:1 | \`${m.before}\` | **${m.rBefore.toFixed(2)}:1** | \`${m.after}\` | **${m.rAfter.toFixed(2)}:1** | ${m.rBefore < m.min ? 'was FAILING' : 'ok'} → ${m.rAfter >= m.min ? 'passes' : 'STILL FAILING'} |`),
  '',
  'Guarded by `styles/dark-contrast.test.ts` § "dark islands in the light cascade",',
  'which goes red if the scoped block is removed.',
  '',
].join('\n'), 'utf8');

const MIC = '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>';
const cell = (label: string, color: string, ratio: number, min: number) => `
  <div style="flex:1;padding:18px 20px;border-radius:12px;background:${composer};border:1px solid rgba(244,236,216,.16)">
    <div style="font:600 12px/1.4 system-ui;letter-spacing:.12em;text-transform:uppercase;color:#D8CBA8;margin-bottom:12px">${label}</div>
    <div style="display:flex;align-items:center;gap:10px">
      <span style="width:32px;height:32px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:${color}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${MIC}</svg>
      </span>
      <span style="font:400 13px/1.4 ui-monospace,monospace;color:#D8CBA8">${color} · ${ratio.toFixed(2)}:1 ${ratio >= min ? '✓' : '✗ under ' + min + ':1'}</span>
    </div>
  </div>`;

const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;padding:28px;background:#F4ECD8;font-family:system-ui">
<div style="max-width:900px;margin:0 auto">
  <div style="font:700 16px/1.4 system-ui;color:#0F2B1E;margin-bottom:4px">Composer mic on the dashboard hero card (light theme)</div>
  <div style="font:400 13px/1.5 system-ui;color:#3F3A2C;margin-bottom:18px">Surface ${composer} — the 5% bone wash over --ink-deep that the hero composer really paints.</div>
  ${measured.map((m) => `<div style="display:flex;gap:14px;margin-bottom:14px">${cell(`${m.what} — before`, m.before, m.rBefore, m.min)}${cell(`${m.what} — after`, m.after, m.rAfter, m.min)}</div>`).join('')}
</div></body>`;

async function shoot() {
  const browser = await chromium.launch(process.env.SHOT_CHROMIUM ? { executablePath: process.env.SHOT_CHROMIUM } : {});
  const page = await browser.newPage({ viewport: { width: 960, height: 620 }, deviceScaleFactor: 2 });
  await page.route('**/*', (r) => r.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('http://mic-contrast.local/');
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, 'mic-before-after.png'), fullPage: true });
  await browser.close();
}

shoot().then(() => {
  for (const m of measured) console.log(`${m.what.padEnd(16)} ${m.rBefore.toFixed(2)}:1 → ${m.rAfter.toFixed(2)}:1 (min ${m.min})`);
  console.log(`\nwritten to ${OUT}`);
});

