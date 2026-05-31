// B12 — diagnose mobile hero at narrow widths. CDP to running Chrome.
import { chromium } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.cwd(); const BASE = 'http://localhost:3000';
const phase = process.argv[2] || 'before';
const OUT = path.join(ROOT, 'sprint-4', 'b12-hero'); fs.mkdirSync(OUT, { recursive: true });
const WIDTHS = [320, 360, 375, 390, 414];
(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = b.contexts()[0]; const page = await ctx.newPage();
  const report = {};
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 844 });
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(600);
    const info = await page.evaluate(() => {
      const h1 = document.querySelector('.hero-h1');
      const lead = document.querySelector('.hero-lead');
      const cs = (el) => el ? getComputedStyle(el) : null;
      const r = (el) => el ? el.getBoundingClientRect() : null;
      const docW = document.documentElement.scrollWidth, winW = window.innerWidth;
      const h1cs = cs(h1), leadcs = cs(lead);
      const h1r = r(h1), leadr = r(lead);
      return {
        horizScroll: docW > winW + 1, docW, winW,
        h1: h1cs && { fontSize: h1cs.fontSize, letterSpacing: h1cs.letterSpacing, lineHeight: h1cs.lineHeight, wordSpacing: h1cs.wordSpacing, textWrap: h1cs.textWrap, width: Math.round(h1r.width), right: Math.round(h1r.right), text: (h1.innerText || '').replace(/\n/g, '⏎') },
        lead: leadcs && { fontSize: leadcs.fontSize, letterSpacing: leadcs.letterSpacing, wordSpacing: leadcs.wordSpacing, textWrap: leadcs.textWrap, width: Math.round(leadr.width), right: Math.round(leadr.right), overflowRight: Math.round(leadr.right) > winW, text: (lead.innerText || '').replace(/\n/g, '⏎') },
      };
    });
    report[w] = info;
    await page.locator('.hero').screenshot({ path: path.join(OUT, `${phase}-${w}.png`) }).catch(async () => { await page.screenshot({ path: path.join(OUT, `${phase}-${w}.png`) }); });
    console.log(`w=${w} horizScroll=${info.horizScroll} h1fs=${info.h1?.fontSize} h1right=${info.h1?.right}/${w} leadOverflow=${info.lead?.overflowRight}`);
  }
  fs.writeFileSync(path.join(OUT, `${phase}-report.json`), JSON.stringify(report, null, 2));
  await page.close(); await b.close();
  console.log('HERO_PROBE_DONE ' + phase);
})();
