import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const html = fileURLToPath(new URL('../evidence/wave-i-insight/insight-dashboard.html', import.meta.url));
const out = fileURLToPath(new URL('../evidence/wave-i-insight/insight-dashboard-375px.png', import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 810, height: 1400 }, deviceScaleFactor: 2 });
await page.goto('file://' + html);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('wrote', out);
