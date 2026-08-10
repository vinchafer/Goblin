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

  // 3 — it actually resolves a language and reads the copy map.
  check(`${rel}: bound to the public locale + a copy map`,
    /useAuthLang\(\)/.test(code) && /_COPY\[lang\]/.test(code));
}

// The copy modules are the ONLY place prose may live, and both locales must be
// present for every key — an untranslated key is English, never a missing key.
for (const rel of COPY_MODULES) {
  const src = read(rel);
  check(`${rel}: exports both locales`, /Record<Lang,\s*\w+Copy>\s*=\s*\{\s*en,\s*de\s*\}/.test(src));
  const needsGerman = (src.match(/@needs-german/g) || []).length;
  check(`${rel}: German gap is declared, not hidden (${needsGerman} @needs-german markers)`,
    needsGerman > 0);
}

console.log('─'.repeat(62));
console.log(`  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
