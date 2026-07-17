// E4 runtime smoke — serve the BUILT dist/ and drive it in headless Chromium:
// the app renders, TaskItem components appear (checkbox + title), and toggling a task
// strikes it through — proving the parent-held state flows into the reusable component.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from '@playwright/test';

const dist = process.argv[2];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const server = createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = join(dist, p);
  if (!existsSync(file)) { res.statusCode = 404; res.end('nf'); return; }
  res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
  res.end(readFileSync(file));
});

await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const url = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const results = {};
try {
  const page = await browser.newPage();
  // Real app failures = uncaught JS exceptions (pageerror). External resource-load
  // failures (Google Fonts / favicon, which the sandboxed browser can't reach) are an
  // ENVIRONMENT artifact, not an app defect — tracked separately, never fail the smoke.
  const jsErrors = [];
  const resourceErrors = [];
  page.on('pageerror', (e) => jsErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') resourceErrors.push(m.text()); });

  await page.goto(url, { waitUntil: 'networkidle' });

  results.heading = await page.locator('h1').textContent();
  results.taskCount = await page.locator('.task').count();
  results.checkboxes = await page.locator('.task__checkbox').count();
  results.firstTaskTitle = await page.locator('.task__title').first().textContent();

  // toggle the first task → parent state flips → the row gets the --done class
  const doneBefore = await page.locator('.task--done').count();
  await page.locator('.task__checkbox').first().check();
  await page.waitForTimeout(100);
  const doneAfter = await page.locator('.task--done').count();
  results.toggleWorks = doneAfter === doneBefore + 1;

  // add a task via the parent-held form → new TaskItem appears
  await page.locator('.add__input').fill('Vom Smoke-Test hinzugefügt');
  await page.locator('.add__button').click();
  await page.waitForTimeout(100);
  results.taskCountAfterAdd = await page.locator('.task').count();

  results.jsErrors = jsErrors;
  results.externalResourceErrors = resourceErrors; // Google Fonts/favicon unreachable in sandbox — informational
  results.ok =
    (results.heading || '').includes('Meine Aufgaben') &&
    results.taskCount === 2 &&
    results.checkboxes === 2 &&
    results.toggleWorks === true &&
    results.taskCountAfterAdd === 3 &&
    jsErrors.length === 0;
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(results, null, 2));
process.exit(results.ok ? 0 : 1);
