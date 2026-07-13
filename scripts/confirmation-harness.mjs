// FIX-WAVE 3 · F-32 purchase-confirmation visual evidence.
// Renders the moment for a MOCKED verified 'pro' upgrade (planState==='paid') with
// the real single-sourced numbers, in LIGHT and DARK. Isolated render harness.

import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDir = resolve(root, 'evidence/fw3-purchase');
mkdirSync(outDir, { recursive: true });
const designTokens = readFileSync(resolve(root, 'apps/web/styles/design-tokens.css'), 'utf8');

// Real values for the 'pro' plan (mirrors lib/plan-builds.ts PLAN_BUILDS.pro=200,
// lib/plan-storage.ts STORAGE_GB.pro=40) — what unlockedFeatures('pro','de') emits.
const feats = [
  '≈ 200 Builds / Monat — je nach Komplexität',
  '40 GB Cloud-Speicher',
  'Unbegrenzte Projekte',
  'BYOK — alle Provider, kein Goblin-Limit',
];
const check = (c) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px;"><polyline points="20 6 9 17 4 12"/></svg>`;

const modal = `
  <div style="position:relative;width:100%;max-width:420px;background:var(--panel);border:1px solid var(--border);border-radius:20px;box-shadow:var(--shadow-3);padding:32px 28px;text-align:center;">
    <div style="width:56px;height:56px;border-radius:50%;background:var(--accent-primary-soft);border:1px solid var(--accent-primary-rule);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    </div>
    <h2 style="font-size:24px;font-weight:700;color:var(--brand-fg);margin:0 0 8px;">Willkommen im Pro-Plan</h2>
    <p style="font-size:15px;color:var(--text-2);margin:0 0 22px;line-height:1.5;">Dein Abo ist aktiv. Kein Countdown mehr — bau einfach weiter.</p>
    <div style="text-align:left;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:24px;">
      <div style="font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--meta);margin-bottom:10px;">Jetzt freigeschaltet</div>
      ${feats.map(f => `<div style="display:flex;align-items:flex-start;gap:8px;margin:6px 0;font-size:14px;color:var(--text);">${check('var(--accent-primary)')}<span>${f}</span></div>`).join('')}
    </div>
    <button style="width:100%;padding:14px 20px;background:var(--brand-green);color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:600;">Los geht's</button>
  </div>`;

function docFor(theme) {
  return `<!doctype html><html lang="de" data-theme="${theme}"><head><meta charset="utf-8"><style>
${designTokens}
*{box-sizing:border-box;} body{margin:0;font-family:Manrope,system-ui,sans-serif;}
.bg{min-height:100vh;background:var(--surface-page);display:flex;align-items:center;justify-content:center;padding:40px 24px;}
.scrim{position:relative;}
</style></head><body><div class="bg">${modal}</div></body></html>`;
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ deviceScaleFactor: 2 });
for (const theme of ['light', 'dark']) {
  const htmlPath = resolve(outDir, `_confirm-${theme}.html`);
  writeFileSync(htmlPath, docFor(theme));
  const p = await ctx.newPage();
  await p.setViewportSize({ width: 468, height: 620 });
  await p.goto('file://' + htmlPath);
  await p.waitForTimeout(150);
  await p.screenshot({ path: resolve(outDir, `purchase-confirmation-${theme}.png`) });
  await p.close();
}
await browser.close();
console.log('Wrote purchase-confirmation screenshots to', outDir);
