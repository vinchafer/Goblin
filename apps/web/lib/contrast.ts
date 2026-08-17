// WCAG 2.1 contrast maths — the measuring tool for the dark-theme audit.
//
// A tester reported dark mode as "frequently suboptimal contrast" with a screenshot of
// barely readable text. Spot-fixing the one screenshot would have left the rest, so this
// is the instrument instead: exact ratios for real token pairs, checked in a test that
// fails when a token drifts back under threshold (styles/dark-contrast.test.ts).
//
// Pure functions, no DOM — they run in a unit test and can be called from a script.

export type Rgba = [r: number, g: number, b: number, a: number];

/** Parse `#rgb`, `#rrggbb`, `rgb(…)` or `rgba(…)`. Returns null for anything else. */
export function parseColor(input: string): Rgba | null {
  const c = input.trim();

  const six = /^#([0-9a-f]{6})$/i.exec(c);
  if (six) {
    const h = six[1]!;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }

  const three = /^#([0-9a-f]{3})$/i.exec(c);
  if (three) {
    const h = three[1]!;
    return [parseInt(h[0]! + h[0]!, 16), parseInt(h[1]! + h[1]!, 16), parseInt(h[2]! + h[2]!, 16), 1];
  }

  const fn = /^rgba?\(([^)]+)\)$/i.exec(c);
  if (fn) {
    const parts = fn[1]!.split(/[,/]/).map((p) => parseFloat(p.trim()));
    const [r, g, b, a] = parts;
    if (r === undefined || g === undefined || b === undefined || Number.isNaN(r)) return null;
    return [r, g, b, a === undefined || Number.isNaN(a) ? 1 : a];
  }

  return null;
}

/** sRGB → linear, per WCAG 2.1 relative-luminance definition. */
function channel(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance([r, g, b]: Rgba): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Composite a translucent colour over an opaque one. Necessary because several of this
 * design system's tints are `rgba(…)` over a surface — their EFFECTIVE colour, and the
 * only one worth measuring, depends on what they sit on.
 */
export function compositeOver(fg: Rgba, bg: Rgba): Rgba {
  const a = fg[3];
  return [
    fg[0] * a + bg[0] * (1 - a),
    fg[1] * a + bg[1] * (1 - a),
    fg[2] * a + bg[2] * (1 - a),
    1,
  ];
}

/**
 * WCAG contrast ratio between a foreground and a background, 1…21.
 * A translucent foreground is composited over the background first; a translucent
 * BACKGROUND must be composited by the caller against whatever it really sits on
 * (`compositeOver`), because this function cannot know that.
 */
export function contrastRatio(foreground: string, background: string): number | null {
  const bg = parseColor(background);
  const fg0 = parseColor(foreground);
  if (!bg || !fg0) return null;
  if (bg[3] < 1) return null; // ambiguous — resolve the background first
  const fg = fg0[3] < 1 ? compositeOver(fg0, bg) : fg0;

  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA thresholds. `large` = ≥18.66px bold or ≥24px regular. */
export const AA_BODY = 4.5;
export const AA_LARGE = 3;
/** Non-text UI (icons, borders that carry meaning, focus rings) — WCAG 1.4.11. */
export const AA_NON_TEXT = 3;
