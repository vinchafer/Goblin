/**
 * FOUNDER-WALK-7 · U8 (D-G) — the code block, measured, in both themes.
 *
 * The founder, twice: "sichtbarkeit vom im chat generierten code ist weiterhin
 * furchtbar, das muss jetzt gleich gefixt werden."
 *
 * ── WHY THE EXISTING AUDIT COULD NOT HAVE CAUGHT THIS ──────────────────────────
 * `styles/dark-contrast.test.ts` resolves colour pairs out of the CSS custom
 * properties and measures them. It is a good audit and it was structurally blind
 * here: syntax colours live in `goblin-light.json` / `goblin-dark.json` and reach
 * the page as shiki INLINE styles. They appear in no stylesheet, so no amount of
 * care in that file's matrix could have reached them. This test adds the axis
 * rather than the entry — the next theme file is covered automatically.
 *
 * ── WHAT WAS MEASURED BEFORE THE FIX ──────────────────────────────────────────
 * One theme (`goblin-light`) was rendered in BOTH app themes, and globals.css
 * strips the theme background (`.cb-body .shiki { background: transparent }`), so
 * light-theme token colours sat on the dark `--surface-1` (#133224):
 *
 *     entity.name.function  #133224  →  1.00:1   the background colour, exactly
 *     keyword               #1A3A2A  →  1.11:1
 *     default / variable    #3F3A2C  →  1.23:1
 *     string                #8B4A3A  →  2.08:1
 *     comment               #74694F  →  2.57:1
 *
 * and in LIGHT mode, on `--surface-1` (#FBF7EC):
 *
 *     punctuation           #B8A988  →  2.16:1
 *     constant / type       #A07726  →  3.80:1
 *
 * Punctuation is most of the characters in HTML and CSS — the two languages Goblin
 * mostly writes — which is why "furchtbar" was the right word for the light theme
 * even though its body text measured 10.59:1.
 *
 * The surfaces are read from the REAL stylesheet, not restated here: a token edited
 * back to a light-only literal has to fail at the token, not silently agree with a
 * copy of itself living in a test.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio, AA_BODY } from '../contrast';
import goblinLight from './goblin-light.json';
import goblinDark from './goblin-dark.json';

// ── the surface each theme's code actually paints on ───────────────────────────
//
// `.cb-a { background: var(--surface-1) }` (globals.css) with the shiki background
// stripped. So the ground is `--surface-1` in the corresponding cascade.
const designTokens = readFileSync(join(__dirname, '../../styles/design-tokens.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function surfaceOneIn(selector: 'root' | 'dark'): string {
  const blocks = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  let found: string | null = null;
  while ((match = blocks.exec(designTokens))) {
    const sel = match[1]!.trim();
    const wanted = selector === 'root' ? sel === ':root' : sel.includes('[data-theme="dark"]');
    if (!wanted) continue;
    const decl = /--surface-1\s*:\s*([^;]+);/.exec(match[2]!);
    if (decl) found = decl[1]!.trim();
  }
  if (!found) throw new Error(`--surface-1 not found for ${selector}`);
  return found;
}

const LIGHT_SURFACE = surfaceOneIn('root');
const DARK_SURFACE = surfaceOneIn('dark');

interface ThemeFile {
  colors: { 'editor.foreground': string };
  tokenColors: Array<{ scope: string[]; settings: { foreground: string } }>;
}

/** Every colour a theme can paint text in, with the scope it belongs to. */
function inks(theme: ThemeFile): Array<{ scope: string; color: string }> {
  return [
    { scope: 'editor.foreground', color: theme.colors['editor.foreground'] },
    ...theme.tokenColors.map((t) => ({ scope: t.scope[0]!, color: t.settings.foreground })),
  ];
}

describe('syntax themes — the surfaces are the ones the app really paints', () => {
  it('reads --surface-1 out of the real stylesheet in both cascades', () => {
    expect(LIGHT_SURFACE).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(DARK_SURFACE).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(LIGHT_SURFACE).not.toBe(DARK_SURFACE);
  });
});

describe('goblin-light — every syntax colour clears WCAG AA on the light surface', () => {
  for (const { scope, color } of inks(goblinLight as ThemeFile)) {
    it(`${scope} (${color}) ≥ ${AA_BODY}:1`, () => {
      const ratio = contrastRatio(color, LIGHT_SURFACE);
      expect(ratio, `${scope} ${color} on ${LIGHT_SURFACE}`).not.toBeNull();
      expect(ratio!, `${scope} ${color} on ${LIGHT_SURFACE} measured ${ratio?.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(AA_BODY);
    });
  }
});

describe('goblin-dark — every syntax colour clears WCAG AA on the dark surface', () => {
  for (const { scope, color } of inks(goblinDark as ThemeFile)) {
    it(`${scope} (${color}) ≥ ${AA_BODY}:1`, () => {
      const ratio = contrastRatio(color, DARK_SURFACE);
      expect(ratio, `${scope} ${color} on ${DARK_SURFACE}`).not.toBeNull();
      expect(ratio!, `${scope} ${color} on ${DARK_SURFACE} measured ${ratio?.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(AA_BODY);
    });
  }
});

describe('the specific defect: a light theme rendered on the dark surface', () => {
  it('a dark theme exists at all — this is what was missing', () => {
    expect((goblinDark as ThemeFile).colors['editor.foreground']).toBeTruthy();
    expect(goblinDark).not.toEqual(goblinLight);
  });

  it('no syntax colour equals the surface it is painted on (the 1.00:1 case)', () => {
    for (const { scope, color } of inks(goblinDark as ThemeFile)) {
      expect(color.toUpperCase(), `${scope} is the dark surface colour itself`).not.toBe(DARK_SURFACE.toUpperCase());
    }
    for (const { scope, color } of inks(goblinLight as ThemeFile)) {
      expect(color.toUpperCase(), `${scope} is the light surface colour itself`).not.toBe(LIGHT_SURFACE.toUpperCase());
    }
  });

  it('the light theme would still FAIL on the dark surface — which is why theme selection, not just recolouring, was the fix', () => {
    const failures = inks(goblinLight as ThemeFile)
      .filter(({ color }) => (contrastRatio(color, DARK_SURFACE) ?? 0) < AA_BODY);
    // Recolouring the light theme alone could never have solved this: a palette that
    // works on cream cannot also work on dark green. The fix had to be a second theme
    // plus picking between them.
    expect(failures.length).toBeGreaterThan(0);
  });
});
