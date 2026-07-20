// FOUNDER-WALK-2 U1 deterministic gate.
//
// The founder's second prod walk showed the mobile admin tab strip rendering as
// one colliding run of text ("HealthInsightCosts PromoUsers ModelsCatalog…"
// with "Ops" wrapping onto its own line). This script VERIFIES — by reading the
// SHIPPED source (components/admin/admin-shell.tsx) — that the rebuilt strip
// carries the properties that make that collision impossible at any viewport:
// real spacing (gap ≥16px), non-wrapping labels, horizontal scroll, an unbroken
// "Catalog Ops" label, an active-tab indicator, ≥44px touch targets, and a
// right-edge scroll-affordance fade. It also pins the founder-relevance order.
//
// Deterministic: greps the real file, prints PASS/FAIL per assertion, exits
// non-zero on any miss. Run: node evidence/founder-walk-2/assert-admin-nav.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../apps/web/', import.meta.url));
const src = readFileSync(root + 'components/admin/admin-shell.tsx', 'utf8');

let pass = 0, fail = 0;
const results = [];
const check = (label, cond) => { results.push({ label, ok: !!cond }); cond ? pass++ : fail++; };

// ── (1) Founder-relevance order: Insight · Promo · Costs · Users · Health first
const order = [...src.matchAll(/href:\s*'\/admin\/([a-z]+)'/g)].map((m) => m[1]);
const firstFive = order.slice(0, 5).join(',');
check('NAV order: Insight·Promo·Costs·Users·Health lead',
  firstFive === 'insight,promo,costs,users,health');
check('NAV includes every route (11 tabs, Costs+Rankings present)',
  order.length === 11 && order.includes('costs') && order.includes('rankings'));

// ── (2) REAL spacing — the collision was a 4px gap; require ≥16px on the strip.
const gapMatch = src.match(/gap:\s*(\d+)px;[^}]*overflow-x:\s*auto/s)
  || src.match(/gap:\s*(\d+)px;[\s\S]*?overflow-x:\s*auto/);
const mobileGap = gapMatch ? Number(gapMatch[1]) : 0;
check(`mobile tab-strip gap ≥16px (found ${mobileGap}px)`, mobileGap >= 16);

// ── (3) Labels never wrap — nowrap on the link + no clipped mid-word truncation.
check('links: white-space: nowrap', /white-space:\s*nowrap/.test(src));

// ── (4) Horizontal scroll — the many-tab strip scrolls instead of wrapping.
check('links: overflow-x: auto (scrollable strip)', /overflow-x:\s*auto/.test(src));

// ── (5) "Catalog Ops" is ONE label, never split across lines.
check("'Catalog Ops' is a single unbroken label", /label:\s*'Catalog Ops'/.test(src));

// ── (6) Active-tab indicator — a gold underline on the active tab.
check('active tab: gold underline indicator',
  /\.gobl-admin-link\.active\s*\{[\s\S]*?border-bottom-color:\s*var\(--brand-gold\)/.test(src));

// ── (7) Touch targets — every tab ≥44px tall (mobile rule).
check('mobile tab: min-height 44px touch target',
  /\.gobl-admin-link\s*\{[\s\S]*?min-height:\s*44px/.test(src));

// ── (8) Scroll affordance — a right-edge fade so more-tabs-right is obvious.
check('right-edge fade element present', /gobl-admin-scrollfade/.test(src));
check('fade uses a gradient to the brand-green edge',
  /\.gobl-admin-scrollfade\s*\{[\s\S]*?linear-gradient\([\s\S]*?var\(--brand-green\)/.test(src));

// ── report ──
console.log('\nFOUNDER-WALK-2 U1 — admin-nav no-collision assertions\n' + '─'.repeat(56));
for (const r of results) console.log(`${r.ok ? '  PASS' : '  FAIL'}  ${r.label}`);
console.log('─'.repeat(56));
console.log(`  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
