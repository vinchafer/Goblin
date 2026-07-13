// F-39 (FIX-WAVE 2) GATE — iOS input auto-zoom guard.
//
// iOS Safari zooms into any focused text-entry control whose font-size computes
// below 16px and does not zoom back out. The systematic fix is a global
// touch-device rule in globals.css forcing every input/textarea/select to
// ≥16px. This test deterministically asserts that guard exists and enforces
// ≥16px — a browser-free build-time check (headless iOS is not available in CI).
//
// Swept surfaces (all real <input>/<textarea>, no contenteditable — the CSS
// selector covers them all): help/support composer (support-chat.tsx,
// --t-caption-fs 12px → fixed), main chat composer (chat/ChatInput.tsx,
// --t-small-fs 14px → fixed), login/auth, settings forms, feedback modal.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('./globals.css', import.meta.url)), 'utf8');

/** Extract the body of the first `@media (pointer: coarse){…}` block. */
function coarseBlock(source: string): string {
  const start = source.search(/@media\s*\(pointer:\s*coarse\)\s*\{/);
  expect(start, 'globals.css must contain an @media (pointer: coarse) guard').toBeGreaterThan(-1);
  let i = source.indexOf('{', start);
  let depth = 0;
  const from = i;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) break; }
  }
  return source.slice(from + 1, i);
}

describe('F-39 input auto-zoom guard (globals.css)', () => {
  const block = coarseBlock(css);

  it('forces text-entry controls to ≥16px on touch devices', () => {
    // A font-size declaration set to at least 16px (bare or !important).
    const m = block.match(/font-size:\s*(\d+(?:\.\d+)?)px/);
    expect(m, 'coarse-pointer block must declare a px font-size').not.toBeNull();
    expect(parseFloat(m![1])).toBeGreaterThanOrEqual(16);
  });

  it('targets input, textarea and select', () => {
    expect(block).toMatch(/\binput\b/);
    expect(block).toMatch(/\btextarea\b/);
    expect(block).toMatch(/\bselect\b/);
  });

  it('also overrides the desktop .settings-section sizing (coarse tablets)', () => {
    expect(block).toMatch(/\.settings-section\s+input/);
  });
});
