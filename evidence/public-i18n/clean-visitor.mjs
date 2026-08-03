// WAVE-KORREKTUR-1 · U2 — clean-visitor locale simulation.
//
// Drives the LOCALLY BUILT checkout (next start) with a fresh browser context per
// case: no stored preference, no cookies, and an explicit Accept-Language. For
// each public/pre-auth surface it reads the rendered text and classifies it as
// DE / EN / mixed using probe strings that exist in exactly one locale.
//
// This is checkout evidence, not production evidence — stated as such in the
// report. Run:
//   node evidence/public-i18n/clean-visitor.mjs            (writes SWEEP.md)
//   BASE=http://localhost:3100 node evidence/public-i18n/clean-visitor.mjs
import { chromium } from '@playwright/test';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://localhost:3100';
const candidates = [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
];
const executablePath = candidates.find(existsSync);

// Probe strings that exist in ONE locale only on that surface. A surface is
// "mixed" when both fire — the bug class this wave is about.
// `only: 'en'` / `only: 'de'` marks a surface that ships ONE language — the
// sweep then reports "EN-only" instead of pretending the locale resolved.
const SURFACES = [
  { path: '/',                        name: 'Landing (/)',            only: 'en', de: ['Goblin als App installieren', 'Home-Bildschirm'], en: ['Install Goblin as an app', 'Start building'] },
  { path: '/login',                   name: '/login',                 de: ['Willkommen zurück', 'Melde dich an'],             en: ['Welcome back', 'Sign in to continue building'] },
  { path: '/login?mode=signup',       name: '/login?mode=signup',     de: ['Erstelle dein Konto'],                            en: ['Create your account'] },
  { path: '/register',                name: '/register (→ signup)',   de: ['Erstelle dein Konto'],                            en: ['Create your account'] },
  { path: '/auth/reset-password',     name: '/auth/reset-password',   de: ['Neues Passwort setzen', 'Fordere einen neuen'],   en: ['Set new password', 'Request a new password reset'] },
  { path: '/auth/confirm',            name: '/auth/confirm',          de: ['Link unvollständig'],                             en: ['Incomplete link'] },
  { path: '/about',                   name: '/about',                 de: ['Über uns', '← Zurück'],                           en: ['About', '← Back'] },
  { path: '/help',                    name: '/help',                  de: ['Hilfe', 'Verständliche Anleitungen'],             en: ['Help', 'Clear guides'] },
  { path: '/help/erste-schritte',     name: '/help/[slug]',           de: ['← Alle Hilfe-Artikel'],                             en: ['← All help articles'] },
  { path: '/pricing',                 name: '/pricing',               only: 'en', de: ['Nutzungsbedingungen akzeptieren'],    en: ['Get started'] },
  { path: '/terms',                   name: '/terms (legal shell)',   only: 'en', de: ['Nutzungsbedingungen'],                en: ['Terms'] },
  { path: '/status',                  name: '/status',                only: 'en', de: ['Alle Systeme betriebsbereit'],        en: ['Report an incident'] },
  { path: '/badge',                   name: '/badge',                 only: 'en', de: ['Erstellt mit Goblin'],                en: ['Built with Goblin'] },
  { path: '/models',                  name: '/models',                only: 'de', de: ['Modelle, geordnet'],                  en: ['Models, ranked'] },
  { path: '/changelog',               name: '/changelog',             only: 'en', de: ['← Zurück'],                           en: ['← Back', 'Changelog'] },
  { path: '/manifesto',               name: '/manifesto',             only: 'en', de: ['← Zurück'],                           en: ['← Back', 'Manifesto'] },
  { path: '/help/no-such-article',    name: '404 (via public prefix)', only: 'en', de: ['Seite konnte nicht'],                en: ['This page ran away'] },
  { path: '/deletion-pending',        name: '/deletion-pending',      only: 'de', de: ['Dein Konto wird gelöscht'],           en: ['Your account is being deleted'] },
];

const hit = (text, probes) => probes.filter(p => text.includes(p));

function classify(text, s) {
  const de = hit(text, s.de);
  const en = hit(text, s.en);
  const suffix = s.only ? ` (${s.only.toUpperCase()}-only surface)` : '';
  if (de.length && en.length) return { verdict: 'MIXED' + suffix, de, en };
  if (de.length) return { verdict: 'DE' + suffix, de, en };
  if (en.length) return { verdict: 'EN' + suffix, de, en };
  return { verdict: 'no probe fired', de, en };
}

async function sweep(browser, { locale, storage, label }) {
  const ctx = await browser.newContext({ locale, viewport: { width: 390, height: 844 } });
  if (storage) {
    await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), storage);
  }
  const page = await ctx.newPage();
  const rows = [];
  for (const s of SURFACES) {
    let text = '';
    try {
      await page.goto(BASE + s.path, { waitUntil: 'networkidle', timeout: 20000 });
      // The locale correction happens in an effect on mount; give it a frame.
      await page.waitForTimeout(350);
      text = await page.locator('body').innerText();
    } catch (e) {
      rows.push({ name: s.name, verdict: 'ERROR', note: String(e).slice(0, 80) });
      continue;
    }
    const c = classify(text, s);
    rows.push({ name: s.name, verdict: c.verdict, note: [...c.de.map(x => `DE:"${x}"`), ...c.en.map(x => `EN:"${x}"`)].join(' ') });
  }
  await ctx.close();
  return { label, rows };
}

// The founder's acceptance test, as a machine check: land on the landing, press
// DE in the switcher, walk to /login, and require German — then press EN there
// and require it to stick across a further navigation.
async function switcherWalk(browser) {
  const ctx = await browser.newContext({ locale: 'en-US', viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const steps = [];
  const record = async (step, expect) => {
    const text = await page.locator('body').innerText();
    const isDe = text.includes('Willkommen zurück') || text.includes('Melde dich an');
    const isEn = text.includes('Welcome back') || text.includes('Sign in to continue');
    const got = isDe && !isEn ? 'DE' : isEn && !isDe ? 'EN' : isDe && isEn ? 'MIXED' : '—';
    steps.push({ step, expect, got, ok: got === expect });
  };

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  // The landing shows the switcher in the footer at ≤860px.
  await page.locator('[data-testid="lang-toggle-de"]').last().click();
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
  await record('landing → press DE → /login', 'DE');

  await page.locator('[data-testid="lang-toggle-en"]').first().click();
  await page.waitForTimeout(350);
  await record('/login → press EN (instant, no reload)', 'EN');

  await page.goto(BASE + '/auth/reset-password', { waitUntil: 'networkidle' });
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
  await record('EN survives navigation away and back', 'EN');

  const stored = await page.evaluate(() => localStorage.getItem('goblin:lang-choice'));
  steps.push({ step: 'persisted key goblin:lang-choice', expect: 'en', got: String(stored), ok: stored === 'en' });

  await ctx.close();
  return steps;
}

const browser = await chromium.launch(executablePath ? { executablePath } : {});

const cases = [
  await sweep(browser, { locale: 'en-US', storage: null, label: 'A · clean visitor, Accept-Language en-US (no stored anything)' }),
  await sweep(browser, { locale: 'de-DE', storage: null, label: 'B · clean visitor, Accept-Language de-DE' }),
  await sweep(browser, { locale: 'en-US', storage: ['goblin:preferred-lang', 'de'], label: "C · the founder's device: onboarding preference 'de', EN browser" }),
  await sweep(browser, { locale: 'en-US', storage: ['goblin:lang-choice', 'de'], label: 'D · explicit switcher choice DE, EN browser' }),
  await sweep(browser, { locale: 'de-DE', storage: ['goblin:lang-choice', 'en'], label: 'E · explicit switcher choice EN, DE browser (choice must outrank detection)' }),
];
// The switcher does not exist in the BEFORE state — record that rather than crash.
let walk;
try {
  walk = await switcherWalk(browser);
} catch (e) {
  walk = [{ step: 'switcher walk', expect: 'DE/EN switcher present', got: `unavailable — ${String(e).split('\n')[0].slice(0, 90)}`, ok: false }];
}
await browser.close();

let md = `# Clean-visitor locale sweep — WAVE-KORREKTUR-1 · U2\n\n`;
md += `Target: \`${BASE}\` (LOCAL CHECKOUT, \`next build\` + \`next start\`) · viewport 390×844 · fresh context per case.\n\n`;
for (const c of cases) {
  md += `## ${c.label}\n\n| Surface | Rendered | Probes that fired |\n|---|---|---|\n`;
  for (const r of c.rows) md += `| ${r.name} | **${r.verdict}** | ${r.note || '—'} |\n`;
  md += '\n';
}
md += `## Switcher walk (the founder's acceptance test, automated)\n\n| Step | Expected | Got | |\n|---|---|---|---|\n`;
for (const s of walk) md += `| ${s.step} | ${s.expect} | ${s.got} | ${s.ok ? '✅' : '❌'} |\n`;

const out = fileURLToPath(new URL('./' + (process.env.OUT || 'SWEEP.md'), import.meta.url));
writeFileSync(out, md);
console.log(md);
console.log('wrote', out);
