// FIX-WAVE 3 · U3 (D-B Sage & Copper) old→new palette evidence.
//
// Renders representative accent surfaces with the OLD accents (gold/ochre +
// terracotta) vs the NEW D-B accents (sage primary + copper secondary), in LIGHT
// and DARK, on the U2-fixed token base. Proves the palette shift AND the founder's
// hard condition: dark stays unmistakably dark (surfaces are the green anchor,
// only the accent hue changes). Isolated render harness (cloud-rider allowed).

import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDir = resolve(root, 'evidence/fw3-palette');
mkdirSync(outDir, { recursive: true });
const designTokens = readFileSync(resolve(root, 'apps/web/styles/design-tokens.css'), 'utf8');

// OLD-palette override: reinstates the pre-D-B accents on the SAME U2-fixed base,
// so the only difference from NEW is the accent hue (gold/ochre/terracotta).
const oldOverride = `.old{
  --accent-primary: var(--brand-gold);
  --accent-primary-soft: rgba(212,169,74,0.12);
  --accent-primary-rule: rgba(212,169,74,0.20);
  --accent-secondary: #B0432A;              /* terracotta */
  --accent-secondary-soft: rgba(184,92,60,0.12);
  --copper-strong: #7A5A12;                 /* old ochre ink */
  --brand-fg: #87A998;                      /* U2 green-300 (pre-sage) */
}`;

const swatch = (name, varRef) => `<div style="text-align:center;">
  <div style="width:44px;height:44px;border-radius:10px;background:${varRef};margin:0 auto 4px;border:1px solid var(--border);"></div>
  <div style="font-size:10px;color:var(--meta);">${name}</div></div>`;

const components = `
  <div class="surf-label">accent swatches — anchor · primary · secondary · (logo kept)</div>
  <div style="display:flex;gap:12px;margin-bottom:18px;">
    ${swatch('Deep green', 'var(--brand-green)')}
    ${swatch('Sage', 'var(--accent-primary)')}
    ${swatch('Copper', 'var(--accent-secondary)')}
    ${swatch('Gold logo', 'var(--brand-gold)')}
  </div>

  <div class="surf-label">code view — tabs (active underline = primary)</div>
  <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:18px;">
    <div style="padding:8px 14px;font-size:13px;color:var(--text);position:relative;font-weight:600;">index.html
      <div style="position:absolute;left:50%;bottom:-1px;transform:translateX(-50%);width:60%;height:2px;background:var(--accent-primary);border-radius:1px;"></div></div>
    <div style="padding:8px 14px;font-size:13px;color:var(--meta);">styles.css</div>
  </div>

  <div class="surf-label">dashboard — active project (primary tint) + status</div>
  <div style="background:var(--panel);border:1px solid var(--div);border-radius:12px;padding:8px;margin-bottom:18px;">
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:var(--accent-primary-soft);border:1px solid var(--accent-primary-rule);">
      <span style="width:8px;height:8px;border-radius:50%;background:var(--accent-secondary);"></span>
      <span style="font-size:14px;font-weight:600;color:var(--text);flex:1;">Aktives Projekt</span>
      <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;background:var(--accent-secondary-soft);color:var(--copper-strong);">Beta</span>
    </div>
    <div style="height:6px;border-radius:999px;overflow:hidden;background:color-mix(in srgb, var(--text) 10%, transparent);margin:10px 6px 4px;"><div style="height:100%;width:58%;background:var(--accent-primary);border-radius:999px;"></div></div>
  </div>

  <div class="surf-label">chat — link + streaming cursor (primary)</div>
  <div style="background:var(--panel);border:1px solid var(--div);border-radius:12px;padding:14px;margin-bottom:18px;font-size:14px;color:var(--text);line-height:1.5;">
    Schau dir <a style="color:var(--accent-primary);text-decoration:underline;">die Vorschau</a> an<span style="display:inline-block;width:2px;height:1.05em;background:var(--accent-primary);vertical-align:text-bottom;margin-left:2px;"></span>
  </div>

  <div class="surf-label">settings — focus ring (primary) on a control</div>
  <div style="margin-bottom:18px;">
    <button style="padding:10px 16px;border-radius:10px;border:1.5px solid var(--border);background:var(--panel);color:var(--text);font-size:14px;outline:2px solid var(--accent-primary);outline-offset:2px;">Fokussiertes Feld</button>
  </div>

  <div class="surf-label">report card — primary accent edge + secondary badge</div>
  <div style="background:var(--panel);border:1px solid var(--div);border-left:3px solid var(--accent-primary);border-radius:12px;padding:14px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
      <span style="font-size:15px;font-weight:600;color:var(--brand-fg);">Wochenbericht</span>
      <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;background:var(--accent-secondary-soft);color:var(--copper-strong);">Neu</span>
    </div>
    <div style="font-size:13px;color:var(--meta);">12 Builds · 3 Deployments diese Woche</div>
  </div>`;

function docFor(theme) {
  const col = (cls, label) => `<div class="${cls}" style="width:360px;padding:16px;background:var(--surface-page);border-radius:14px;">
    <div style="font-size:12px;font-weight:700;letter-spacing:.14em;color:var(--meta);margin-bottom:14px;">${label}</div>${components}</div>`;
  return `<!doctype html><html lang="de" data-theme="${theme}"><head><meta charset="utf-8"><style>
${designTokens}
${oldOverride}
*{box-sizing:border-box;} body{margin:0;font-family:Manrope,system-ui,sans-serif;background:#4a4a4a;}
.wrap{display:flex;gap:20px;padding:20px;align-items:flex-start;}
.surf-label{font-family:monospace;font-size:10px;color:var(--meta);opacity:.75;margin:0 0 6px;}
</style></head><body><div class="wrap">${col('old', theme.toUpperCase()+' · OLD (gold / ochre / terracotta)')}${col('new', theme.toUpperCase()+' · NEW (sage + copper)')}</div></body></html>`;
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ deviceScaleFactor: 2 });
for (const theme of ['light', 'dark']) {
  const htmlPath = resolve(outDir, `_palette-${theme}.html`);
  writeFileSync(htmlPath, docFor(theme));
  const p = await ctx.newPage();
  await p.setViewportSize({ width: 780, height: 400 });
  await p.goto('file://' + htmlPath);
  await p.waitForTimeout(200);
  await p.screenshot({ path: resolve(outDir, `palette-old-vs-new-${theme}.png`), fullPage: true });
  await p.close();
}
await browser.close();

// Contrast table for the NEW accents as they RESOLVE per mode (light uses the
// deeper sage-strong; dark uses base sage). UI elements need ≥3:1, text ≥4.5:1.
function lum(hex){const c=hex.replace('#','');const v=[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)/255).map(x=>x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4));return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2];}
function ratio(a,b){const[x,y]=[lum(a),lum(b)].sort((m,n)=>n-m);return (x+0.05)/(y+0.05);}
const rows = [
  ['sage primary — focus ring / underline / progress (UI ≥3)', 'light', '#5E8973', '#FBF7EC', 3.0],
  ['sage primary — focus ring / underline / progress (UI ≥3)', 'dark', '#7FA98A', '#133224', 3.0],
  ['brand-fg heading (text ≥4.5)', 'light', '#1A3A2A', '#FBF7EC', 4.5],
  ['brand-fg heading (text ≥4.5)', 'dark', '#7FA98A', '#133224', 4.5],
  ['copper secondary — status dot (UI ≥3)', 'light', '#C56B4A', '#FBF7EC', 3.0],
  ['copper secondary — status dot (UI ≥3)', 'dark', '#C56B4A', '#133224', 3.0],
  ['copper-strong badge text on pale copper tint (text ≥4.5)', 'light', '#9C4E34', '#F3E4DD', 4.5],
  ['copper-strong badge text on pale copper tint (text ≥4.5)', 'dark', '#DDA085', '#2a201b', 4.5],
];
const table = rows.map(([name,mode,fg,bg,min]) => { const r = ratio(fg,bg); return { name, mode, fg, bg, ratio:r.toFixed(2), min, pass: r>=min ? 'PASS' : 'FAIL' }; });
const md = ['| Accent pairing | Mode | fg | bg | ratio | threshold | verdict |','|---|---|---|---|---|---|---|',
  ...table.map(t=>`| ${t.name} | ${t.mode} | \`${t.fg}\` | \`${t.bg}\` | ${t.ratio} | ${t.min} | ${t.pass} |`)].join('\n');
writeFileSync(resolve(outDir,'contrast-table.md'), md+'\n');
console.log(md);
console.log('\nAny FAIL:', table.some(t=>t.pass==='FAIL'));
console.log('Wrote palette old→new screenshots + contrast table to', outDir);
