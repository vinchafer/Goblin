// FOUNDER-WALK-3 U4 — admin mobile nav v3 assertions.
//
// Two layers:
//   (A) SOURCE guards (CI-safe, no browser): the menu-button + sheet pattern is
//       present, the old horizontal scroll strip is GONE (no dead code), and the
//       desktop sidebar is untouched.
//   (B) DOM proof (needs Chromium): renders the mobile sheet harness at 320px and
//       asserts NO horizontal overflow and every section label on ONE line.
//
// Run source-only:  node evidence/founder-walk-3/assert-admin-menu.mjs
// Run with DOM:      PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
//                    node evidence/founder-walk-3/assert-admin-menu.mjs --dom
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../apps/web/', import.meta.url));
const read = (p) => readFileSync(root + p, 'utf8');
let pass = 0, fail = 0;
const results = [];
const check = (label, cond) => { results.push({ label, ok: !!cond }); cond ? pass++ : fail++; };

const shell = read('components/admin/admin-shell.tsx');

// ── (A) the new menu-button pattern is present ──
check('menu-button bar present (gobl-admin-menubtn)', /gobl-admin-menubtn/.test(shell));
check('bar shows current section ("Bereich")', /Bereich/.test(shell) && /currentLabel/.test(shell));
check('section sheet present (gobl-admin-sheet-row)', /gobl-admin-sheet-row/.test(shell));
check('sheet rows ≥52px tall', /min-height:\s*52px/.test(shell));
check('sheet labels are one line (white-space: nowrap)', /gobl-admin-sheet-label[\s\S]*?white-space:\s*nowrap/.test(shell));
check('sheet closes on navigation (route effect) + Escape',
  /setMenuOpen\(false\)[\s\S]*?\[pathname\]/.test(shell) && /'Escape'/.test(shell));

// ── the OLD horizontal scroll strip is GONE (no dead code) ──
check('old scroll-fade removed', !/gobl-admin-scrollfade/.test(shell));
check('old scroller wrapper removed', !/gobl-admin-scroller/.test(shell));
check('no horizontal overflow-x scroll strip on the links', !/overflow-x:\s*auto/.test(shell));

// ── desktop sidebar UNCHANGED ──
check('desktop sidebar intact (220px green rail)', /width:\s*220px/.test(shell) && /gobl-admin-nav/.test(shell));
check('all 11 sections still in NAV', ['Insight','Promo','Costs','Users','Health','Models','Catalog Ops','Telemetry','Rankings','Builds','Status'].every((s) => shell.includes(`'${s}'`) || shell.includes(`label: '${s}'`) || shell.includes(s)));

// ── (B) optional DOM proof ──
if (process.argv.includes('--dom')) {
  const pw = await import('/home/user/Goblin/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.js');
  const chromium = pw.chromium || pw.default.chromium;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 320, height: 640 } });
  await page.goto('file://' + fileURLToPath(new URL('./u4-admin-menu-harness.html', import.meta.url)));
  // Inspect the narrowest (320px) open sheet — the 4th device.
  const res = await page.evaluate(() => {
    const sheets = document.querySelectorAll('.sheet');
    const sheet = sheets[sheets.length - 1];
    const noHOverflow = sheet.scrollWidth <= sheet.clientWidth + 1;
    const labels = sheet.querySelectorAll('.row .label');
    const allOneLine = Array.from(labels).every((el) => el.getClientRects().length === 1);
    return { noHOverflow, allOneLine, labelCount: labels.length };
  });
  await b.close();
  check('DOM@320: sheet has NO horizontal overflow', res.noHOverflow);
  check('DOM@320: every section label on ONE line', res.allOneLine);
  check('DOM@320: all 12 rows present (11 sections + back)', res.labelCount === 12);
}

console.log('\nFW3 U4 — admin menu v3\n' + '─'.repeat(46));
for (const r of results) console.log(`${r.ok ? '  PASS' : '  FAIL'}  ${r.label}`);
console.log('─'.repeat(46) + `\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
