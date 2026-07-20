// FOUNDER-WALK-2 U2 deterministic gate.
//
// Verifies — by reading the SHIPPED source (InstallAppBlock.tsx) — that the
// quiet "no app store" line sits under the install block, in BOTH languages,
// wired to the app's t(lang, …) i18n, with meta typography and no icon. Prints
// PASS/FAIL per assertion; exits non-zero on any miss.
// Run: node evidence/founder-walk-2/assert-landing-note.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../apps/web/', import.meta.url));
const src = readFileSync(root + 'components/landing/sections/InstallAppBlock.tsx', 'utf8');

let pass = 0, fail = 0;
const results = [];
const check = (label, cond) => { results.push({ label, ok: !!cond }); cond ? pass++ : fail++; };

const DE = 'Bewusst in keinem App Store — Goblin kommt direkt aufs Gerät.';
const EN = 'Deliberately not in any app store — Goblin goes straight to your device.';

check('DE line present (confident, not apologetic)', src.includes(DE));
check('EN line present', src.includes(EN));
check('line is i18n-wired via t(lang, DE, EN)',
  new RegExp(`t\\(\\s*lang,\\s*'${DE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`).test(src));
check('note element carries a testid', /data-testid="install-app-note"/.test(src));
check('note sits AFTER the install card (below the block)',
  src.indexOf('install-app-note') > src.indexOf('data-testid="install-app-block"'));
check('note uses meta ink + block typography (--ink-3, --small)',
  /const note:[\s\S]*?color:\s*'var\(--ink-3\)'/.test(src) && /const note:[\s\S]*?var\(--small/.test(src));
check('no icon/emoji in the note (typography only)',
  !/install-app-note[\s\S]{0,220}(svg|<img|📱|🏪)/i.test(src));
// Guard the apologetic phrasing was NOT used ("…yet" / "Bis jetzt").
check('does not use the apologetic "…yet" phrasing',
  !src.includes('Bis jetzt in keinem App Store') && !src.includes('any app store — yet'));

console.log('\nFOUNDER-WALK-2 U2 — landing app-store line assertions\n' + '─'.repeat(56));
for (const r of results) console.log(`${r.ok ? '  PASS' : '  FAIL'}  ${r.label}`);
console.log('─'.repeat(56));
console.log(`  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
