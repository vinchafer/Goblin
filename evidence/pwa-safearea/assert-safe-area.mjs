// SAFEAREA-U1 deterministic gate.
//
// Verifies — by reading the SHIPPED source — that (a) the viewport carries
// viewport-fit=cover on both the marketing root and the dashboard app, and
// (b) every top/bottom-anchored edge surface swept in this wave carries the
// matching env(safe-area-inset-*) rule. This is deterministic verification:
// it greps the real files, prints PASS/FAIL per assertion, and exits non-zero
// on any miss. Run: node evidence/pwa-safearea/assert-safe-area.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../apps/web/', import.meta.url));
const read = (p) => readFileSync(root + p, 'utf8');

let pass = 0, fail = 0;
const results = [];
function check(label, cond) {
  results.push({ label, ok: !!cond });
  if (cond) pass++; else fail++;
}

// ── (a) viewport-fit=cover — the precondition for env() to be non-zero ──
const rootLayout = read('app/layout.tsx');
const dashLayout = read('app/dashboard/layout.tsx');
check('root layout: viewportFit cover', /viewportFit:\s*['"]cover['"]/.test(rootLayout));
check('dashboard layout: viewportFit cover', /viewportFit:\s*['"]cover['"]/.test(dashLayout));
check('root layout: deep-green theme-color (#1A3A2A)', /themeColor:\s*['"]#1A3A2A['"]/i.test(rootLayout));
check('dashboard layout: deep-green theme-color (#1A3A2A)', /themeColor:\s*['"]#1A3A2A['"]/i.test(dashLayout));

// ── (b) swept edge surfaces — each MUST carry the inset it needs ──

// TOP — the header (P0: the founder's status-bar overlap) ------------------
const header = read('components/layout/Header.tsx');
check('Header: padding-top = safe-area-inset-top', /paddingTop:\s*['"]env\(safe-area-inset-top/.test(header));
check('Header: height reserves the top inset', /height:\s*calc\(56px \+ env\(safe-area-inset-top/.test(header));
check('Header: left inset (landscape notch)', /paddingLeft:\s*['"]max\(12px, env\(safe-area-inset-left/.test(header));
check('Header: right inset (landscape notch)', /paddingRight:\s*['"]max\(12px, env\(safe-area-inset-right/.test(header));

// TOP — the offline banner (fixed top:0) -----------------------------------
const offline = read('components/mobile/offline-banner.tsx');
const offlineHits = (offline.match(/paddingTop:\s*['"]calc\(8px \+ env\(safe-area-inset-top/g) || []).length;
check('OfflineBanner: both variants pad the top inset (2)', offlineHits === 2);

// BOTTOM / drawer surfaces — already carried the inset before this wave; we
// assert they STILL do (regression guard for the composer/home-indicator zone).
const already = [
  ['Sidebar mobile drawer: top+bottom inset', 'components/layout/Sidebar.tsx', /paddingTop:\s*['"]env\(safe-area-inset-top/],
  // Composer inset moved into ChatInput's non-hero root in SAFEAREA-U-BOTTOM
  // (single source of truth for every bottom-anchored use); guard it there now.
  ['Chat composer: bottom inset', 'components/chat/ChatInput.tsx', /env\(safe-area-inset-bottom/],
  ['Code session composer: bottom inset', 'components/code/SessionPromptInput.tsx', /env\(safe-area-inset-bottom/],
  ['Code session tab sheet: bottom inset', 'components/code/SessionTabs.tsx', /env\(safe-area-inset-bottom/],
  ['BottomSheet: bottom inset', 'components/ui/BottomSheet.tsx', /paddingBottom:\s*['"]env\(safe-area-inset-bottom/],
  ['bottom-tab-bar: bottom inset', 'components/app-shell/bottom-tab-bar.tsx', /paddingBottom:\s*['"]env\(safe-area-inset-bottom/],
  ['globals .safe-top/.safe-bottom helpers', 'app/globals.css', /\.safe-top\s*\{\s*padding-top:\s*env\(safe-area-inset-top/],
];
for (const [label, path, re] of already) check(label, re.test(read(path)));

// ── FOUNDER-WALK-2 U4 — the /welcome onboarding chrome header. This flow was
//    NEVER covered by #41/#44 (they treated the app shell), so the GOBLIN logo
//    overlapped the iOS clock and "HILFE" collided with the battery. TOP insets: ─
const onbChrome = read('app/welcome/_components/chrome.tsx');
check('Onboarding header: padding-top adds the top inset',
  /padding-top:\s*calc\(22px \+ env\(safe-area-inset-top/.test(onbChrome));
check('Onboarding header: left inset (landscape notch)',
  /padding-left:\s*max\(32px, env\(safe-area-inset-left/.test(onbChrome));
check('Onboarding header: right inset (landscape notch)',
  /padding-right:\s*max\(32px, env\(safe-area-inset-right/.test(onbChrome));
check('Onboarding header (≤480px): top inset',
  /padding-top:\s*calc\(16px \+ env\(safe-area-inset-top/.test(onbChrome));

// ── FOUNDER-WALK-3 U2 — the LAST safe-area wave. The founder hit the mobile
//    Settings sheet's back button ON the iOS clock; and the full route inventory
//    turned up two never-treated full-screen surfaces (legal + pricing). Treat
//    them and lock the whole inventory so no page can regress silently. ──────────
const bottomSheet = read('components/ui/BottomSheet.tsx');
check('BottomSheet full: top clears the notch (max(48px, inset-top+12))',
  /full:\s*['"]calc\(100dvh - max\(48px, calc\(env\(safe-area-inset-top\) \+ 12px\)\)\)['"]/.test(bottomSheet));

const legal = read('app/(legal)/layout.tsx');
check('Legal header: top inset (height grows by the inset)',
  /paddingTop:\s*['"]env\(safe-area-inset-top/.test(legal) && /height:\s*['"]calc\(52px \+ env\(safe-area-inset-top/.test(legal));
check('Legal header: landscape L/R insets',
  /paddingLeft:\s*['"]max\(24px, env\(safe-area-inset-left/.test(legal) && /paddingRight:\s*['"]max\(24px, env\(safe-area-inset-right/.test(legal));
check('Legal footer: bottom inset',
  /paddingBottom:\s*['"]calc\(16px \+ env\(safe-area-inset-bottom/.test(legal));

const pricing = read('app/pricing/page.tsx');
check('Pricing nav: top inset',
  /paddingTop:\s*['"]max\(20px, env\(safe-area-inset-top/.test(pricing));
check('Pricing nav: landscape L/R insets',
  /paddingLeft:\s*['"]max\(40px, env\(safe-area-inset-left/.test(pricing) && /paddingRight:\s*['"]max\(40px, env\(safe-area-inset-right/.test(pricing));

// Full route inventory — every full-screen route's edge chrome is accounted for
// (treated here / already-treated elsewhere / redirect stub / not edge-anchored).
// If a NEW top-level route ships a bare header/footer, extend the inventory doc
// AND this list so the omission is loud, not silent. See:
//   evidence/pwa-safearea/ROUTE_INVENTORY.md
const inventoryTreated = [
  ['dashboard shell header', 'components/layout/Header.tsx', /env\(safe-area-inset-top/],
  ['onboarding chrome', 'app/welcome/_components/chrome.tsx', /env\(safe-area-inset-top/],
  ['admin shell (mobile top bar)', 'components/admin/admin-shell.tsx', /env\(safe-area-inset-top/],
  ['settings sheet (full)', 'components/ui/BottomSheet.tsx', /env\(safe-area-inset-top/],
  ['legal layout', 'app/(legal)/layout.tsx', /env\(safe-area-inset-top/],
  ['pricing nav', 'app/pricing/page.tsx', /env\(safe-area-inset-top/],
];
for (const [label, path, re] of inventoryTreated) check(`Inventory: ${label} treated`, re.test(read(path)));

// ── report ──
console.log('\nSAFEAREA-U1 — swept-surface assertions\n' + '─'.repeat(52));
for (const r of results) console.log(`${r.ok ? '  PASS' : '  FAIL'}  ${r.label}`);
console.log('─'.repeat(52));
console.log(`  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
