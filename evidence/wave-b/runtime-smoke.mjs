// WAVE-B B3 runtime smoke — drives the PUBLISHED proof app in headless Chromium against its
// LIVE provisioned backend: log in as a test user, add a task, confirm it appears, and assert
// ZERO uncaught JS errors. This needs a real backend + a published URL, so it is part of the
// FOUNDER's live gate (see PROOF.md) — it is NOT run in the build session and no result is
// fabricated. External resource-load errors are environment artifacts, never a failure (as in
// the Wave-E smoke); only uncaught pageerror exceptions fail it.
//
// Usage:  node evidence/wave-b/runtime-smoke.mjs <published-url>
//   env:  SMOKE_EMAIL + SMOKE_PASSWORD  (an app-level test login in the provisioned project)
// Exit:   0 = app renders + login + add-task work + no JS errors   1 = failure   2 = skipped.

import { chromium } from '@playwright/test';

const url = process.argv[2];
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;

if (!url || !email || !password) {
  console.log('⏭️  SKIPPED — provide <published-url> + SMOKE_EMAIL + SMOKE_PASSWORD (live gate).');
  process.exit(2);
}

const browser = await chromium.launch();
const results = {};
try {
  const page = await browser.newPage();
  const jsErrors = [];
  const resourceErrors = [];
  page.on('pageerror', (e) => jsErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') resourceErrors.push(m.text()); });

  await page.goto(url, { waitUntil: 'networkidle' });
  results.heading = await page.locator('h1').textContent();

  // Log in, then add a task and confirm it renders (per-user, via RLS).
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#login').click();
  await page.waitForSelector('#app:not(.hidden)', { timeout: 15_000 });

  const title = `Smoke ${Date.now()}`;
  await page.locator('#new-task').fill(title);
  await page.locator('#add').click();
  await page.waitForTimeout(500);
  results.taskVisible = (await page.locator('#tasks li', { hasText: title }).count()) >= 1;

  results.jsErrors = jsErrors;
  results.externalResourceErrors = resourceErrors; // informational only
  results.ok = (results.heading || '').includes('Aufgaben') && results.taskVisible === true && jsErrors.length === 0;
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
process.exit(results.ok ? 0 : 1);
