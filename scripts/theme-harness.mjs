// FIX-WAVE 3 · U2/U3 visual evidence harness.
//
// Renders the theme-cluster surfaces (trial-gate, welcome/plan, settings sheet,
// sidebar-open, error/notice card, section heading) in LIGHT and DARK columns,
// using the REAL token CSS from styles/ so the screenshots exercise the actual
// token resolution the fixes produce. Screenshots + a WCAG contrast table are
// written to evidence/fw3-theme/.
//
// NOTE: this is an isolated render harness (not the full authenticated app),
// which the cloud rider explicitly allows when the live stack can't run headless.
// Markup mirrors each component's post-fix inline styles / token references.

import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDir = resolve(root, 'evidence/fw3-theme');
mkdirSync(outDir, { recursive: true });

const designTokens = readFileSync(resolve(root, 'apps/web/styles/design-tokens.css'), 'utf8');
const dashTokens = readFileSync(resolve(root, 'apps/web/styles/dashboard-tokens.css'), 'utf8');

// The Tailwind @theme surface literals (emitted at :root in the real build from
// globals.css). Inlined here so the harness has the LIGHT values; design-tokens.css
// supplies the dark overrides the fix added.
const themeColorLightVars = `
:root{
  --color-surface-0:#FFFFFF; --color-surface-1:#FBF7EC; --color-surface-2:#F4ECD8;
  --color-surface-3:#E8DEC2; --color-surface-4:#D8CBA8; --color-paper:#FBF7EC; --color-bone:#F4ECD8;
}`;

// The two globals.css classes the fix touched (so the harness reflects them).
const globalsClasses = `
.section-title{font-family:var(--font-sans);font-size:18px;font-weight:600;color:var(--brand-fg);letter-spacing:-0.3px;margin-bottom:var(--space-1);}
.page-hero-title{font-size:28px;color:var(--brand-fg);font-weight:700;letter-spacing:-1px;margin-bottom:var(--space-2);}
`;

// ── Surface markup (faithful, post-fix) ──────────────────────────────────────
const surfaces = {
  'trial-gate-welcome': `
    <div style="min-height:auto;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--surface-page);border-radius:12px;">
      <div style="width:100%;max-width:340px;text-align:center;">
        <h1 style="font-size:24px;font-weight:700;color:var(--brand-fg);margin:0 0 8px;">Willkommen bei Goblin</h1>
        <p style="font-size:15px;color:var(--text-2);margin:0 0 28px;line-height:1.5;">Wähle, wie du loslegst — kostenlose Testphase oder direkt ein Abo.</p>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <button style="padding:14px 20px;background:var(--brand-green);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;">7 Tage kostenlos testen</button>
          <button style="padding:14px 20px;background:transparent;color:var(--brand-fg);border:1.5px solid var(--brand-fg);border-radius:10px;font-size:15px;font-weight:600;">Abo abschließen</button>
        </div>
      </div>
    </div>`,
  'trial-gate-expired': `
    <div style="display:flex;align-items:center;justify-content:center;padding:24px;background:var(--surface-page);border-radius:12px;">
      <div style="width:100%;max-width:340px;text-align:center;">
        <h1 style="font-size:24px;font-weight:700;color:var(--brand-fg);margin:0 0 8px;">Deine Testphase ist beendet</h1>
        <p style="font-size:15px;color:var(--text-2);margin:0 0 28px;line-height:1.5;">Schließe ein Abo ab, um Goblin Cloud weiter zu nutzen.</p>
        <p style="font-size:13px;color:var(--text-2);margin:-16px 0 28px;line-height:1.55;">Deine Projekte und bereits veröffentlichten Apps bleiben erhalten und online.</p>
        <button style="padding:14px 20px;background:var(--brand-green);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;width:100%;">Abo abschließen</button>
      </div>
    </div>`,
  'settings-sheet': `
    <div style="background:var(--panel);border-radius:20px;overflow:hidden;box-shadow:var(--shadow-sheet);">
      <div style="width:36px;height:4px;border-radius:2px;background:rgba(128,128,128,0.35);margin:8px auto 4px;"></div>
      <header style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px 16px;min-height:56px;">
        <span style="min-width:40px;"></span>
        <span style="font-size:17px;font-weight:600;color:var(--text);flex:1;text-align:center;">Einstellungen</span>
        <span style="min-width:40px;"></span>
      </header>
      <div style="padding:0 16px 20px;">
        <div style="background:var(--surface-0);border:1px solid var(--border);border-radius:14px;overflow:hidden;">
          <div style="display:flex;align-items:center;padding:14px 20px;min-height:56px;border-bottom:1px solid var(--border);"><span style="flex:1;font-size:16px;color:var(--text);">Profil</span><span style="color:var(--meta);">›</span></div>
          <div style="display:flex;align-items:center;padding:14px 20px;min-height:56px;border-bottom:1px solid var(--border);"><span style="flex:1;font-size:16px;color:var(--text);">Erscheinungsbild</span><span style="color:var(--meta);">Hell ›</span></div>
          <div style="display:flex;align-items:center;padding:14px 20px;min-height:56px;"><span style="flex:1;font-size:16px;color:var(--text);">Abrechnung</span><span style="color:var(--meta);">›</span></div>
        </div>
      </div>
    </div>`,
  'sidebar-open': `
    <div class="gobl-dash" style="width:260px;background:var(--subtle);border-right:1px solid var(--border);padding:12px 0;border-radius:12px;">
      <div style="padding:0 12px;margin-bottom:12px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--meta);">Projekte</div>
      <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;"><span style="width:8px;height:8px;border-radius:50%;background:var(--brand-gold);"></span><span style="font-size:14px;font-weight:600;color:var(--brand-fg);">Aktives Projekt</span></div>
      <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;"><span style="width:8px;height:8px;border-radius:50%;background:#4A7A7A;"></span><span style="font-size:14px;color:var(--text);">Anderes Projekt</span></div>
      <!-- quota card -->
      <div style="margin:8px 12px;padding:10px 12px;border-radius:8px;background:color-mix(in srgb, var(--text) 5%, transparent);border:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;margin-bottom:7px;"><span style="font-size:12px;font-weight:600;color:var(--ink-2);">Kontingent</span><span style="font-size:13px;font-weight:600;color:var(--ink-1);">42&nbsp;% verbraucht</span></div>
        <div style="height:6px;border-radius:999px;overflow:hidden;background:color-mix(in srgb, var(--text) 10%, transparent);"><div style="height:100%;width:42%;border-radius:999px;background:var(--brand-fg);"></div></div>
        <div style="display:flex;justify-content:space-between;margin-top:7px;font-size:12px;color:var(--ink-3);"><span>Build</span><span>Reset in 12 Tagen</span></div>
      </div>
      <!-- user pill -->
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;margin-top:8px;">
        <span style="width:32px;height:32px;border-radius:50%;background:var(--brand-green);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;">V</span>
        <span style="font-size:14px;font-weight:500;color:var(--text);flex:1;">Vincent</span>
        <span style="font-size:12px;font-weight:600;color:var(--text-2);background:var(--surface-3);border-radius:4px;padding:1px 6px;">Kein Abo</span>
      </div>
    </div>`,
  'error-notice-card': `
    <div class="gobl-dash" style="padding:16px;background:var(--d-surface-elev);border-radius:12px;">
      <div style="display:flex;align-items:center;gap:8px;background:var(--accent-bright);border:1px solid var(--accent-rule);border-radius:10px;padding:10px 12px;font-size:13px;color:var(--ink-deep);line-height:1.4;">
        <span aria-hidden style="color:var(--accent);">ⓘ</span>
        <span>Basierend auf deiner Karte gilt ein anderer Preis. Du bestätigst den Betrag vor dem Abschluss.</span>
      </div>
    </div>`,
  'section-heading': `
    <div style="padding:24px;background:var(--panel);border:1px solid var(--div);border-radius:12px;">
      <div class="section-title">Deine Projekte</div>
      <div style="font-size:13px;color:var(--meta);">Alles, woran du gerade baust.</div>
    </div>`,
};

// data-theme MUST live on <html> (=:root), exactly as in production, so the
// :root semantic aliases (--panel: var(--surface-0), etc.) compute against the
// flipped primitives. One document per theme.
function docFor(theme) {
  const blocks = Object.entries(surfaces)
    .map(([id, html]) => `<div class="surf"><div class="surf-label">${id}</div>${html}</div>`)
    .join('');
  return `<!doctype html><html lang="de" data-theme="${theme}"><head><meta charset="utf-8"><style>
${designTokens}
${dashTokens}
${themeColorLightVars}
${globalsClasses}
*{box-sizing:border-box;}
body{margin:0;font-family:Manrope,system-ui,sans-serif;background:var(--surface-page);}
.col{width:390px;padding:16px;margin:0 auto;background:var(--surface-page);}
.col-head{font-size:12px;font-weight:700;letter-spacing:.14em;color:var(--meta);margin-bottom:14px;}
.surf{margin-bottom:20px;}
.surf-label{font-family:monospace;font-size:10px;color:var(--meta);opacity:.7;margin-bottom:6px;}
</style></head><body><div class="col ${theme}"><div class="col-head">${theme.toUpperCase()} — data-theme on &lt;html&gt; (production-faithful)</div>${blocks}</div></body></html>`;
}

// ── WCAG contrast (computed from the resolved token values the fix produces) ──
function lum(hex) {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); }

const pairs = [
  ['brand-fg on surface-page', 'light', '#1A3A2A', '#FBF7EC'],
  ['brand-fg on surface-page', 'dark', '#87A998', '#133224'],
  ['text-2 body on surface-page', 'light', '#3F3A2C', '#FBF7EC'],
  ['text-2 body on surface-page', 'dark', '#D8CBA8', '#133224'],
  ['text on panel (settings sheet)', 'light', '#0F2B1E', '#FFFFFF'],
  ['text on panel (settings sheet)', 'dark', '#FBF7EC', '#08170F'],
  ['brand-fg active label on subtle (sidebar)', 'light', '#1A3A2A', '#E8DEC2'],
  ['brand-fg active label on subtle (sidebar)', 'dark', '#87A998', '#1A3A2A'],
  ['ink-1 quota % on card (mixed)', 'dark', '#FBF7EC', '#182b21'],
  ['text-2 pill on surface-3', 'dark', '#D8CBA8', '#1A3A2A'],
  ['ink-deep on gold notice card', 'light', '#0F2B1E', '#D4A737'],
  ['ink-deep on gold notice card', 'dark', '#0F2B1E', '#D4A737'],
];
const AA = 4.5, AA_LARGE = 3.0;
const table = pairs.map(([name, mode, fg, bg]) => {
  const r = ratio(fg, bg);
  return { name, mode, fg, bg, ratio: r.toFixed(2), AA: r >= AA ? 'PASS' : (r >= AA_LARGE ? 'PASS(large)' : 'FAIL') };
});

// ── Render + shoot (one document per theme, data-theme on <html>) ────────────
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ deviceScaleFactor: 2 });
for (const theme of ['light', 'dark']) {
  const htmlPath = resolve(outDir, `_harness-${theme}.html`);
  writeFileSync(htmlPath, docFor(theme));
  const p = await ctx.newPage();
  await p.setViewportSize({ width: 422, height: 400 });
  await p.goto('file://' + htmlPath);
  await p.waitForTimeout(200);
  await p.screenshot({ path: resolve(outDir, `all-surfaces-${theme}.png`), fullPage: true });
  await p.close();
}

writeFileSync(resolve(outDir, 'contrast-table.json'), JSON.stringify(table, null, 2));
const md = ['| Pairing | Mode | fg | bg | ratio | WCAG AA |', '|---|---|---|---|---|---|',
  ...table.map(t => `| ${t.name} | ${t.mode} | \`${t.fg}\` | \`${t.bg}\` | ${t.ratio} | ${t.AA} |`)].join('\n');
writeFileSync(resolve(outDir, 'contrast-table.md'), md + '\n');
console.log(md);
console.log('\nAny FAIL:', table.some(t => t.AA === 'FAIL'));

await browser.close();
console.log('\nWrote screenshots + contrast table to', outDir);
