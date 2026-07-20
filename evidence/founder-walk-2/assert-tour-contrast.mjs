// FOUNDER-WALK-2 U3 deterministic contrast gate.
//
// The onboarding tour popup hard-coded a white card (#fff) but used flip-aware
// text tokens, so in dark mode the text turned light on the light card → the
// founder's unreadable pale-gold title. The fix flips the SURFACE with the text
// (card → --panel, which is #FFFFFF in light / #08170F in dark).
//
// This script COMPUTES WCAG contrast for EVERY text element of the popup, in
// BOTH modes, from the RESOLVED design-token hex values (design-tokens.css), so
// the "readable" claim is a measured number, not a look. Text must clear AA
// (≥4.5:1); the two progress-bar fills are non-text UI (≥3:1). Exits non-zero
// on any miss. Run: node evidence/founder-walk-2/assert-tour-contrast.mjs

// ── resolved token values (design-tokens.css :root + [data-theme="dark"]) ──
const T = {
  light: {
    panel: '#FFFFFF',      // --panel = --surface-0
    border: '#D8CBA8',     // --border = --rule
    text: '#0F2B1E',       // --text = --ink-1
    meta: '#5F5640',       // --meta = --ink-3
    div: '#E8DEC2',        // --div = --rule-soft (opaque in light)
    brandGreen: '#1A3A2A', // --brand-green (locked)
    brandGold: '#D4A737',  // --brand-gold (locked)
    brandFg: '#1A3A2A',    // --brand-fg = --brand-green in light
  },
  dark: {
    panel: '#08170F',                    // --surface-0 (dark)
    borderRgba: [247, 247, 236, 0.10],   // --rule (dark) over the card
    text: '#FBF7EC',                     // --ink-1 (dark)
    meta: '#968768',                     // --ink-3 (dark)
    divRgba: [247, 247, 236, 0.06],      // --rule-soft (dark) over the card
    brandGreen: '#1A3A2A',               // locked
    brandGold: '#D4A737',                // locked
    brandFg: '#7FA98A',                  // --brand-fg = --sage (dark)
  },
};

const hex = (h) => Array.isArray(h) ? h : [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
const ratio = (a, b) => { const la = L(a), lb = L(b); const [hi, lo] = la > lb ? [la, lb] : [lb, la]; return (hi + 0.05) / (lo + 0.05); };
// alpha-blend an rgba foreground fill over a solid hex background → solid rgb.
const over = (rgba, bgHex) => { const bg = hex(bgHex); const a = rgba[3]; return [0, 1, 2].map((i) => Math.round(rgba[i] * a + bg[i] * (1 - a))); };

let fail = 0;
const rows = [];
function measure(mode, element, fg, bg, kind = 'text') {
  const r = ratio(hex(fg), hex(bg));
  const min = kind === 'text' ? 4.5 : 3.0;
  const ok = r >= min;
  if (!ok) fail++;
  rows.push({ mode, element, ratio: r.toFixed(2), min: min.toFixed(1), kind, ok });
}

// ── LIGHT ──
{
  const c = T.light;
  measure('light', 'Title (--text on card)', c.text, c.panel);
  measure('light', 'Body (--meta on card)', c.meta, c.panel);
  measure('light', 'Skip link (--meta on card)', c.meta, c.panel);
  measure('light', 'Next button (--brand-gold on --brand-green)', c.brandGold, c.brandGreen);
  measure('light', 'Close × glyph (--meta on --div pill)', c.meta, c.div);
  // The progress bar reads via the FILLED segment. Its meaningful contrasts are
  // fill-vs-card and fill-vs-track (≥3:1). The unfilled track is intentionally
  // subtle, so it is NOT held to a contrast floor of its own.
  measure('light', 'Progress fill vs card (--brand-fg on card)', c.brandFg, c.panel, 'ui');
  measure('light', 'Progress fill vs track (--brand-fg on --div)', c.brandFg, c.div, 'ui');
}
// ── DARK ──
{
  const c = T.dark;
  measure('dark', 'Title (--text on card)', c.text, c.panel);
  measure('dark', 'Body (--meta on card)', c.meta, c.panel);
  measure('dark', 'Skip link (--meta on card)', c.meta, c.panel);
  measure('dark', 'Next button (--brand-gold on --brand-green)', c.brandGold, c.brandGreen);
  measure('dark', 'Close × glyph (--meta on --div over card)', c.meta, over(c.divRgba, c.panel));
  measure('dark', 'Progress fill vs card (--brand-fg/sage on card)', c.brandFg, c.panel, 'ui');
  measure('dark', 'Progress fill vs track (--brand-fg/sage on --div over card)', c.brandFg, over(c.divRgba, c.panel), 'ui');
}

console.log('\nFOUNDER-WALK-2 U3 — tour popup contrast (WCAG, computed)\n' + '─'.repeat(64));
for (const m of ['light', 'dark']) {
  console.log(`\n  ${m.toUpperCase()} mode`);
  for (const r of rows.filter((x) => x.mode === m)) {
    console.log(`   ${r.ok ? 'PASS' : 'FAIL'}  ${r.ratio.padStart(5)}:1  (min ${r.min}, ${r.kind})  ${r.element}`);
  }
}
console.log('\n' + '─'.repeat(64));
console.log(`  ${rows.length - fail}/${rows.length} elements clear their threshold\n`);
process.exit(fail === 0 ? 0 : 1);
