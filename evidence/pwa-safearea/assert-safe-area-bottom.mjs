// SAFEAREA-U-BOTTOM deterministic gate.
//
// The top wave (SAFEAREA-U1, PR #41) fixed the header/status-bar overlap. This
// wave fixes the BOTTOM: on an installed standalone iPhone PWA the viewport is
// edge-to-edge (viewport-fit=cover), so every element anchored to the screen
// bottom renders inside the iOS home-indicator gesture zone and gets clipped —
// the founder's report was the sidebar footer (quota card + account/"Vincent"
// pill) and the chat composer sitting under the indicator.
//
// This script VERIFIES — by reading the SHIPPED source — that every
// bottom-anchored fixed/sticky/absolute surface swept in this wave carries an
// env(safe-area-inset-bottom) rule. It greps the real files, prints PASS/FAIL
// per surface, and exits non-zero on any miss. env() is 0 in a normal browser
// tab, so desktop and mobile-Safari-tab rendering is provably unchanged.
//
// Run: node evidence/pwa-safearea/assert-safe-area-bottom.mjs
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

const insetBottom = /env\(safe-area-inset-bottom/;

// ── EVERY bottom-anchored surface treated in this wave ──────────────────────
// Each row: [human label, file, regex the fix must satisfy].
const treated = [
  // ── Headline surfaces (the founder's report) ──
  // Desktop rail — in LANDSCAPE the phone is ≥769px so THIS (not the drawer)
  // renders; its footer = SidebarUsage quota card + the account/"Vincent" pill.
  ['Sidebar (desktop rail): footer clears the indicator',
    'components/layout/Sidebar.tsx',
    /className="goblin-sidebar-desktop"[\s\S]*?paddingBottom: 'env\(safe-area-inset-bottom/],
  // Chat composer — owns the inset on its non-hero root, so BOTH the standalone
  // chat and the workspace chat tab clear the indicator from one source.
  ['Chat composer (ChatInput non-hero root): bottom inset',
    'components/chat/ChatInput.tsx',
    /padding: '10px 16px calc\(12px \+ env\(safe-area-inset-bottom/],

  // ── Bottom sheets (slide up from the screen bottom on mobile) ──
  ['DiffSheet: actions row bottom inset',        'components/code/DiffSheet.tsx',        insetBottom],
  ['LineActionSheet: bottom inset',              'components/code/LineActionSheet.tsx',  insetBottom],
  ['StcPreviewSheet: mobile dock bottom inset',  'components/code/StcPreviewSheet.tsx',  insetBottom],
  ['SessionGitPill: mobile panel bottom inset',  'components/code/SessionGitPill.tsx',   insetBottom],

  // ── Full-height side drawers (their scroll tail reaches the indicator) ──
  ['CodeMobileFileSheet: drawer bottom inset',   'components/code/CodeMobileFileSheet.tsx', insetBottom],
  ['SessionFileNav: drawer bottom inset',        'components/code/SessionFileNav.tsx',      insetBottom],

  // ── Bottom-anchored toasts (fixed/absolute bottom:N) ──
  ['SessionPane toast: lifted by the inset',     'components/code/SessionPane.tsx',
    /bottom: "calc\(16px \+ env\(safe-area-inset-bottom/],
  ['FileExplorer toast: lifted by the inset',    'components/files/FileExplorer.tsx',
    /bottom: "calc\(20px \+ env\(safe-area-inset-bottom/],
];
for (const [label, path, re] of treated) check(label, re.test(read(path)));

// ── Regression guards — bottom surfaces that ALREADY carried the inset before
//    this wave MUST still carry it (no accidental removal). ──
const stillHeld = [
  ['(guard) Sidebar mobile drawer: bottom inset', 'components/layout/Sidebar.tsx',
    /className="goblin-sidebar-mobile"[\s\S]*?paddingBottom: 'env\(safe-area-inset-bottom/],
  ['(guard) Code session composer: bottom inset', 'components/code/SessionPromptInput.tsx', insetBottom],
  ['(guard) Code session tab sheet: bottom inset', 'components/code/SessionTabs.tsx', insetBottom],
  ['(guard) SessionPickerDialog: bottom inset', 'components/code/SessionPickerDialog.tsx', insetBottom],
  ['(guard) BottomSheet: bottom inset', 'components/ui/BottomSheet.tsx', insetBottom],
  ['(guard) bottom-tab-bar: bottom inset', 'components/app-shell/bottom-tab-bar.tsx', insetBottom],
  ['(guard) globals .safe-bottom helper', 'app/globals.css',
    /\.safe-bottom\s*\{\s*padding-bottom:\s*env\(safe-area-inset-bottom/],
];
for (const [label, path, re] of stillHeld) check(label, re.test(read(path)));

// ── De-duplication guard: the standalone-chat wrapper must NOT re-add the inset
//    now that ChatInput owns it (a double inset leaves a dead --surface-2 strip). ──
const standalone = read('components/chat/standalone-chat.tsx');
check('standalone-chat wrapper does NOT double the composer inset',
  !insetBottom.test(standalone));

// ── FOUNDER-WALK-3 U3 — the double-BAR (white + bone). Beyond the double-INSET
//    guard above, the composer wrapper must not paint a DIFFERENT background than
//    the composer it holds: the composer is --panel, so a --surface-2 wrapper let
//    a bone strip show under the white composer in the home-indicator zone (the
//    founder's stacked bars). The wrapper background must be --panel — one
//    continuous surface into the inset. ──
check('U3: standalone-chat composer wrapper is --panel (no bone seam under the composer)',
  /borderTop: "1px solid var\(--rule\)", background: "var\(--panel\)"/.test(standalone));
check('U3: standalone-chat composer wrapper is NOT --surface-2 (the removed bone layer)',
  !/borderTop: "1px solid var\(--rule\)", background: "var\(--surface-2\)"/.test(standalone));

// ── FOUNDER-WALK-2 U4 — onboarding footer + tour popup (BOTTOM). The /welcome
//    footer line (justgoblin.com · SCHRITT x VON y) sat in the home-indicator
//    zone (founder saw the dark-mode bottom cut here), and the first-run tour
//    card's bottom must clear the indicator on a standalone PWA. ──
const onbChrome2 = read('app/welcome/_components/chrome.tsx');
check('Onboarding footer: bottom inset',
  /padding-bottom:\s*calc\(18px \+ env\(safe-area-inset-bottom/.test(onbChrome2));
check('Onboarding footer (≤480px): bottom inset',
  /padding-bottom:\s*calc\(14px \+ env\(safe-area-inset-bottom/.test(onbChrome2));
const tour = read('components/onboarding/first-run-tour.tsx');
check('Tour popup: bottom clears the home indicator',
  /bottom:\s*'calc\(80px \+ env\(safe-area-inset-bottom/.test(tour));

// ── WAVE-KORREKTUR-1 U1 — the PUBLIC bottom edges. Every bottom-inset wave so
//    far treated signed-in chrome; a signed-out visitor scrolling the landing to
//    its end, or reading a legal/help/share page, reaches the home-indicator zone
//    with the last row of content in it. Each of these adds the inset to its own
//    padding exactly once — the surface's own background continues into it. ──
const publicBottom = [
  ['Landing footer: bottom inset', 'styles/landing.css',
    /padding-bottom:\s*calc\(36px \+ env\(safe-area-inset-bottom/],
  ['/login form column: bottom inset', 'app/(auth)/login/page.tsx',
    /paddingBottom:\s*['"]max\(40px, calc\(env\(safe-area-inset-bottom/],
  ['.auth-page (confirm/reset): bottom inset', 'app/globals.css',
    /padding-bottom:\s*max\(24px, calc\(env\(safe-area-inset-bottom/],
  // WAVE-ABOUT-MANIFESTO: /about and /manifesto moved into the landing frame and
  // no longer use this utility — their bottom edge is the landing footer's, one
  // row above. /changelog is the remaining user.
  ['.safe-prose-page (changelog): bottom inset', 'app/globals.css',
    /\.safe-prose-page\s*\{[\s\S]*?padding-bottom:\s*calc\(64px \+ env\(safe-area-inset-bottom/],
  ['/help index: bottom inset', 'app/help/page.tsx',
    /paddingBottom:\s*['"]calc\(80px \+ env\(safe-area-inset-bottom/],
  ['/help/[slug]: bottom inset', 'app/help/[slug]/page.tsx',
    /paddingBottom:\s*['"]calc\(80px \+ env\(safe-area-inset-bottom/],
  ['/shared/[token]: bottom inset', 'app/shared/[token]/page.tsx',
    /paddingBottom:\s*['"]calc\(64px \+ env\(safe-area-inset-bottom/],
  ['404: bottom inset', 'app/not-found.tsx',
    /paddingBottom:\s*['"]max\(24px, env\(safe-area-inset-bottom/],
  ['500: bottom inset', 'app/error.tsx',
    /paddingBottom:\s*['"]max\(24px, env\(safe-area-inset-bottom/],
];
for (const [label, path, re] of publicBottom) check(label, re.test(read(path)));

// Double-inset guard for the landing footer (#44/#55 lesson): the bottom inset
// must appear exactly ONCE in the footer's own rule block.
const landingCss = read('styles/landing.css');
const footerBlock = landingCss.slice(
  landingCss.indexOf('footer.lp-footer {'),
  landingCss.indexOf('.landing-root .footer-grid'),
);
check('Landing footer: bottom inset applied exactly once (no double-inset)',
  (footerBlock.match(/env\(safe-area-inset-bottom/g) || []).length === 1);

// WAVE-ABOUT-MANIFESTO — the same lesson, applied to the new prose frame. The
// footer sits BELOW .lp-prose on /about and /manifesto and already carries the
// bottom inset (asserted above), so .lp-prose must NOT carry one too. This
// assertion is inverted on purpose: here the bug would be an inset that is
// present, not one that is missing.
const proseBlock = landingCss.slice(
  landingCss.indexOf('.landing-root .lp-prose {'),
  landingCss.indexOf('.landing-root .lp-prose-inner {'),
);
check('.lp-prose: no bottom inset — the footer below it owns that edge',
  proseBlock.length > 0 && !/env\(safe-area-inset-bottom/.test(proseBlock));

// ── report ──
console.log('\nSAFEAREA-U-BOTTOM — bottom-anchored surface assertions\n' + '─'.repeat(56));
for (const r of results) console.log(`${r.ok ? '  PASS' : '  FAIL'}  ${r.label}`);
console.log('─'.repeat(56));
console.log(`  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
