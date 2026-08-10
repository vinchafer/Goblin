/**
 * WAVE-ABOUT-MANIFESTO — grep proof: no hardcoded user-facing string.
 *
 * The PR-#68 leak class is a user-facing string that never reaches the locale
 * layer. This proves, by reading the shipped source, that the two prose pages
 * contain none: every word a visitor reads comes from lib/copy/{about,manifesto}.ts.
 *
 * It reports three things per component and fails on any of them:
 *   1. JSX TEXT NODES  — literal text between tags. Must be empty (the arrow
 *      glyph in decorative, aria-hidden spans is the one allowed exception).
 *   2. STRING LITERALS — every quoted string, classified. Anything that is not a
 *      className / href / testid / import path / other machine value is a
 *      candidate leak and is printed for inspection.
 *   3. THE BINDING     — the component must resolve a language and index the
 *      copy map, or it has no locale at all (the /manifesto bug this wave fixed).
 *
 *   node evidence/about-manifesto/grep-no-hardcoded-strings.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../apps/web/', import.meta.url));
const read = (p) => readFileSync(root + p, 'utf8');

const COMPONENTS = ['app/about/AboutProse.tsx', 'app/manifesto/ManifestoProse.tsx'];
const COPY_MODULES = ['lib/copy/about.ts', 'lib/copy/manifesto.ts'];

// Attributes whose string values are machine-facing, never read as language.
const MACHINE_ATTRS = /(className|href|key|data-testid|id|type|rel|target|aria-hidden|style)=/;

let pass = 0, fail = 0;
const check = (label, ok, detail) => {
  (ok ? pass++ : fail++);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `\n          ${detail}` : ''}`);
};

console.log('\nWAVE-ABOUT-MANIFESTO — no hardcoded user-facing strings\n' + '─'.repeat(62));

for (const rel of COMPONENTS) {
  const src = read(rel);
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  // 1 — JSX text nodes.
  const textNodes = [...code.matchAll(/>([^<>{}\n]+)</g)]
    .map((m) => m[1].trim())
    .filter((t) => t.length > 0 && t !== '→');
  check(`${rel}: no literal JSX text`, textNodes.length === 0,
    textNodes.length ? `found: ${JSON.stringify(textNodes)}` : '');

  // 2 — string literals that are not machine values.
  const suspects = [];
  for (const line of code.split('\n')) {
    if (!/['"]/.test(line)) continue;
    if (MACHINE_ATTRS.test(line)) continue;
    if (/^\s*import\b/.test(line)) continue;
    if (/^\s*'use client'/.test(line)) continue;
    for (const m of line.matchAll(/'([^']{2,})'|"([^"]{2,})"/g)) {
      const value = m[1] ?? m[2];
      if (/^[a-z0-9@/._-]+$/i.test(value)) continue; // slugs, paths, ids
      suspects.push(value);
    }
  }
  check(`${rel}: no prose-shaped string literal`, suspects.length === 0,
    suspects.length ? `found: ${JSON.stringify(suspects)}` : '');

  // 3 — it actually resolves a language and reads the copy map. `useProseLang()`
  // is the public binding pinned to English until real German exists
  // (lib/copy/prose-locale.ts); apps/web/lib/locale.test.ts pins that the
  // wrapper is built on useAuthLang and resolves nothing of its own.
  check(`${rel}: bound to the public locale + a copy map`,
    /useProseLang\(\)|useAuthLang\(\)/.test(code) && /_COPY\[lang\]/.test(code));
}

// The copy modules are the ONLY place prose may live, and both locales must be
// present for every key — an untranslated key is English, never a missing key.
for (const rel of COPY_MODULES) {
  const src = read(rel);
  check(`${rel}: exports both locales`, /Record<Lang,\s*\w+Copy>\s*=\s*\{\s*en,\s*de\s*\}/.test(src));
  const needsGerman = (src.match(/@needs-german/g) || []).length;
  check(`${rel}: German gap is declared, not hidden (${needsGerman} @needs-german markers)`,
    needsGerman > 0);
  // FOLLOW-UP: the page is English end-to-end until real German prose exists, so
  // no `de` value may carry a German literal — a translated back-link above
  // English paragraphs is the half-finished look the founder rejected. Every DE
  // value must therefore be a reference to its EN twin, never a string.
  const deBlock = src.slice(src.indexOf('const de:'), src.indexOf('export const'));
  const germanLiterals = [...deBlock.matchAll(/:\s*(['"])(.*?)\1/g)].map((m) => m[2]);
  check(`${rel}: no DE value is a literal — all reference the EN copy`,
    germanLiterals.length === 0,
    germanLiterals.length ? `found: ${JSON.stringify(germanLiterals)}` : '');
}

// The selection switch itself: one value feeds both the copy and `<html lang>`,
// so an English page can never be announced as German.
const proseLocale = read('lib/copy/prose-locale.ts');
check('prose-locale: the English pin is a single declared switch',
  /export const PROSE_GERMAN_READY: boolean = false;/.test(proseLocale));
check('prose-locale: wraps the PUBLIC binding, resolves nothing itself',
  /useAuthLang\(\)/.test(proseLocale) && !/resolveLang|localStorage/.test(proseLocale));

console.log('─'.repeat(62));
console.log(`  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
