/**
 * DARK-CONTRAST — the systematic audit, as a test that keeps failing if it regresses.
 *
 * A tester's verdict on the first cohort: "dark theme has frequently suboptimal
 * contrast", with a screenshot of barely readable text. The earlier tour-contrast work
 * (#54/#55) covered the popup family; this covers the REST of the app, and it is done by
 * measurement rather than by looking at screens:
 *
 *   1. resolve every token in the DARK cascade out of the real CSS files (var() chains
 *      and all — the same resolution the browser does),
 *   2. compute the WCAG ratio for each (text token, surface token) pair the app actually
 *      paints — every pair below is justified by a real usage, named in `why`,
 *   3. assert each clears its threshold.
 *
 * Why the matrix is CURATED and not a cartesian product: a product of 29 inks × 23
 * surfaces is 667 pairs, most of which never occur, and a failure on a pair nobody
 * renders is noise that teaches the next reader to ignore this file. Every pair here is
 * one the app puts on screen.
 *
 * Reading the values from the CSS (rather than restating them) is the point: a token
 * edited back to a light-only literal fails HERE, at the token, which is where the whole
 * class of defect lives.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio, compositeOver, parseColor, AA_BODY, AA_LARGE, AA_NON_TEXT } from '../lib/contrast';

// ─── resolving the dark cascade out of the real stylesheets ────────────────────

const read = (f: string) => readFileSync(join(__dirname, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Every `--name: value` declared in blocks whose selector satisfies `match`. */
function declarations(css: string, match: (selector: string) => boolean): Record<string, string> {
  const out: Record<string, string> = {};
  const blocks = /([^{}]+)\{([^{}]*)\}/g;
  let block: RegExpExecArray | null;
  while ((block = blocks.exec(css))) {
    if (!match(block[1]!.trim())) continue;
    const decls = /(--[\w-]+)\s*:\s*([^;]+);/g;
    let d: RegExpExecArray | null;
    while ((d = decls.exec(block[2]!))) out[d[1]!] = d[2]!.trim();
  }
  return out;
}

const design = read('design-tokens.css');
const dashboard = read('dashboard-tokens.css');

/**
 * The dark cascade as a browser would compute it inside `.gobl-dash` (which wraps the
 * whole /dashboard layout, so it is the scope nearly every authenticated screen renders
 * in): base :root, then `.gobl-dash`, then the two dark blocks over the top.
 */
const DARK: Record<string, string> = {
  ...declarations(design, (s) => s === ':root'),
  ...declarations(dashboard, (s) => s === '.gobl-dash'),
  ...declarations(design, (s) => s.includes('[data-theme="dark"]')),
  ...declarations(dashboard, (s) => s.includes('[data-theme="dark"]')),
};

/** Follow a var() chain to a literal colour. Returns null if it dead-ends. */
function resolve(token: string, depth = 0): string | null {
  if (depth > 12) return null;
  const raw = DARK[token];
  if (raw === undefined) return null;
  const ref = /^var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)$/.exec(raw);
  if (!ref) return raw;
  const next = resolve(ref[1]!, depth + 1);
  return next ?? (ref[2] ? ref[2].trim() : null);
}

/** A surface's effective colour — translucent tints are composited over what they sit on. */
function surfaceColor(token: string, base: string): string {
  const value = resolve(token);
  if (!value) throw new Error(`unresolved surface token ${token}`);
  const parsed = parseColor(value);
  if (!parsed) throw new Error(`unparseable surface ${token}: ${value}`);
  if (parsed[3] >= 1) return value;
  const under = parseColor(surfaceColor(base, base))!;
  const [r, g, b] = compositeOver(parsed, under);
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

function ratio(ink: string, surface: string, base = '--surface-1'): number {
  const inkValue = resolve(ink);
  if (!inkValue) throw new Error(`unresolved ink token ${ink}`);
  const r = contrastRatio(inkValue, surfaceColor(surface, base));
  if (r === null) throw new Error(`could not measure ${ink} on ${surface}`);
  return r;
}

// ─── the matrix ────────────────────────────────────────────────────────────────

interface Pair {
  ink: string;
  surface: string;
  /** For a translucent surface: what it sits on. */
  base?: string;
  min: number;
  why: string;
}

/**
 * Body/secondary text on the surfaces the app paints.
 *
 * --surface-4 (#2A523E) is deliberately absent: its only use in dark is a legend dot on
 * the usage chart (app/dashboard/usage/page.tsx) — a graphic, not a text ground. Adding
 * it would fail pairs nobody renders. Stated rather than silently dropped.
 */
const PAIRS: Pair[] = [
  // — primary + secondary ink on every real text surface —
  { ink: '--text',   surface: '--surface-page', min: AA_BODY, why: 'every page body (surface-page = surface-1 in dark)' },
  { ink: '--text',   surface: '--panel',        min: AA_BODY, why: 'cards, sheets, the composer (panel = surface-0)' },
  { ink: '--text',   surface: '--surface-2',    min: AA_BODY, why: 'dashboard content ground (.gobl-dash --d-surface)' },
  { ink: '--text',   surface: '--subtle',       min: AA_BODY, why: 'hover/tag rows (subtle = surface-3)' },
  { ink: '--text-2', surface: '--surface-page', min: AA_BODY, why: 'secondary copy, diff-modal fail-safe note' },
  { ink: '--text-2', surface: '--panel',        min: AA_BODY, why: 'secondary copy inside cards' },

  // — the meta ink: timestamps, captions, hints, sidebar labels —
  { ink: '--meta',         surface: '--surface-page', min: AA_BODY, why: 'chat timestamps, "wartet auf Verbindung", token line' },
  { ink: '--meta',         surface: '--panel',        min: AA_BODY, why: 'meta inside cards/sheets' },
  { ink: '--meta',         surface: '--surface-2',    min: AA_BODY, why: '.gobl-mono / .gobl-eyebrow / section labels' },
  { ink: '--sidebar-meta', surface: '--surface-page', min: AA_BODY, why: 'sidebar project meta lines' },
  { ink: '--text-faint',   surface: '--surface-page', min: AA_BODY, why: 'empty-state copy' },
  { ink: '--ink-muted',    surface: '--panel',        min: AA_BODY, why: 'muted captions (flipped by P1.1)' },
  { ink: '--ink-4',        surface: '--d-surface-elev', min: AA_BODY, why: '.gobl-dash tertiary meta' },

  // — brand + accent foregrounds —
  { ink: '--brand-fg',        surface: '--surface-page', min: AA_BODY, why: 'headings, active labels, quota labels (F-03/04/06/08)' },
  { ink: '--brand-fg',        surface: '--panel',        min: AA_BODY, why: 'the Fortsetzen button on the truncation notice' },
  { ink: '--accent-primary',  surface: '--surface-page', min: AA_NON_TEXT, why: 'focus ring, active indicators' },
  { ink: '--copper-strong',   surface: '--surface-page', min: AA_BODY, why: 'copper ink (already flip-aware)' },
  { ink: '--brand-gold',      surface: '--surface-page', min: AA_NON_TEXT, why: 'injection dot, gold accents' },

  // — status inks: the tokens that had no dark override at all —
  { ink: '--success', surface: '--surface-page', min: AA_BODY, why: 'save-indicator "Saved ✓", BYOK/FREE badges' },
  { ink: '--success', surface: '--panel',        min: AA_BODY, why: 'status text inside cards' },
  { ink: '--danger',  surface: '--surface-page', min: AA_BODY, why: 'error banners — 47 `color: var(--danger)` call sites' },
  { ink: '--danger',  surface: '--panel',        min: AA_BODY, why: 'the "no model configured" banner, admin error state' },
  { ink: '--warning', surface: '--surface-page', min: AA_BODY, why: 'warning copy' },
  { ink: '--info',    surface: '--surface-page', min: AA_BODY, why: 'info copy' },
  { ink: '--error',   surface: '--surface-page', min: AA_BODY, why: '--error aliases --danger' },
  { ink: '--good',    surface: '--surface-page', min: AA_BODY, why: '--good aliases --success' },
  { ink: '--ok',      surface: '--d-surface-elev', min: AA_BODY, why: '.gobl-tag.ok' },
  { ink: '--warn',    surface: '--d-surface-elev', min: AA_BODY, why: '.gobl-tag.warn' },

  // — ink ON a tinted background: the worst readings in the pre-fix audit —
  { ink: '--text',   surface: '--warning-soft', base: '--surface-page', min: AA_BODY, why: 'the truncation notice banner (chat-tab)' },
  { ink: '--text-2', surface: '--warning-soft', base: '--panel',        min: AA_BODY, why: 'diff-modal fail-safe note' },
  { ink: '--text',   surface: '--success-soft', base: '--surface-page', min: AA_BODY, why: 'success tint backgrounds' },
  { ink: '--text',   surface: '--info-soft',    base: '--surface-page', min: AA_BODY, why: 'info tint backgrounds' },
  { ink: '--text',   surface: '--danger-soft',  base: '--surface-page', min: AA_BODY, why: 'error tint blocks (usage/new/dashboard pages)' },
  { ink: '--danger', surface: '--danger-soft',  base: '--surface-page', min: AA_BODY, why: 'danger ink on its own tint' },
  { ink: '--text',   surface: '--accent-primary-soft', base: '--surface-page', min: AA_BODY, why: 'sage-tinted rows' },
  { ink: '--gold-deep', surface: '--accent-soft', base: '--d-surface-elev', min: AA_BODY, why: '.gobl-tag.gold' },

  // — text ON a solid semantic FILL (the inverse risk the status-ink fix created) —
  // Lightening --danger/--success for readability AS TEXT makes a hard-coded white on
  // those FILLS unreadable (2.4:1 / 2.1:1). Both directions are measured here so neither
  // fix can be made at the other's expense.
  { ink: '--on-danger',  surface: '--danger',  min: AA_BODY, why: 'trial + payment-failing banner buttons, offline banner' },
  { ink: '--on-success', surface: '--success', min: AA_BODY, why: '"Back online" banner, KEY badge, diff-modal accept button' },

  // — the locked-surface lesson (#54): text on a surface that never flips —
  { ink: '--ink-on-dark-1', surface: '--surface-dark', min: AA_BODY, why: 'header/brand-green surfaces, which stay dark in both themes' },
  { ink: '--ink-on-dark-2', surface: '--surface-dark', min: AA_BODY, why: 'inactive header tab labels' },
];

describe('dark theme — WCAG contrast', () => {
  it('every audited token pair resolves to a real colour', () => {
    for (const p of PAIRS) {
      expect(resolve(p.ink), `ink ${p.ink}`).toBeTruthy();
      expect(() => surfaceColor(p.surface, p.base ?? '--surface-1'), `surface ${p.surface}`).not.toThrow();
    }
  });

  it.each(PAIRS.map((p) => [`${p.ink} on ${p.surface}`, p] as const))(
    '%s clears its threshold',
    (_label, p) => {
      const r = ratio(p.ink, p.surface, p.base ?? '--surface-1');
      // The `why` rides into the failure message: a future reader gets the real usage,
      // not just two token names.
      expect(r, `${p.ink} on ${p.surface} — ${p.why}`).toBeGreaterThanOrEqual(p.min);
    },
  );

  it('the tokens that had no dark override now have one', () => {
    // Regression pin for the exact defect class: a semantic colour or tint defined ONLY
    // for light surfaces. Each of these measured under 3:1 in dark before the fix.
    const darkBlock = declarations(design, (s) => s.includes('[data-theme="dark"]'));
    for (const token of ['--success', '--warning', '--danger', '--info', '--success-soft', '--warning-soft', '--info-soft', '--danger-soft', '--ink-3']) {
      expect(darkBlock[token], `${token} needs an explicit dark value`).toBeDefined();
    }
    const dashDark = declarations(dashboard, (s) => s.includes('[data-theme="dark"]'));
    for (const token of ['--ok', '--warn', '--danger', '--gold-deep', '--ink-4']) {
      expect(dashDark[token], `.gobl-dash ${token} needs an explicit dark value`).toBeDefined();
    }
  });

  it('no dark token references itself — a cycle resolves to invalid, not to a colour', () => {
    // The `--bone: var(--bone)` trap this repo already paid for once (a primary button
    // rendered dark-green on dark-green). Cheap to check, expensive to miss.
    const dashDark = declarations(dashboard, (s) => s.includes('[data-theme="dark"]'));
    for (const [name, value] of Object.entries(dashDark)) {
      expect(value, `${name} references itself`).not.toBe(`var(${name})`);
    }
  });

  it('large-text and non-text pairs are held to their own (lower) bar, not waived', () => {
    // Guards against the threshold constants drifting into meaninglessness.
    expect(AA_BODY).toBe(4.5);
    expect(AA_LARGE).toBe(3);
    expect(AA_NON_TEXT).toBe(3);
  });
});

// ─── the other half of the theme ───────────────────────────────────────────────

/**
 * The LIGHT cascade — no dark blocks applied.
 *
 * Every fix above lives in a `[data-theme="dark"]` block, so light should be untouched;
 * this is what proves it rather than asserting it. It matters most for the two tokens
 * that are NEW rather than overridden (--on-danger / --on-success): in light they must
 * still be the white those call sites hard-coded, or the fix would have quietly darkened
 * text on the light-mode banners.
 */
const LIGHT: Record<string, string> = {
  ...declarations(design, (s) => s === ':root'),
  ...declarations(dashboard, (s) => s === '.gobl-dash'),
};

describe('light theme is unaffected by the dark fixes', () => {
  function lightResolve(token: string, depth = 0): string | null {
    if (depth > 12) return null;
    const raw = LIGHT[token];
    if (raw === undefined) return null;
    const ref = /^var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)$/.exec(raw);
    if (!ref) return raw;
    return lightResolve(ref[1]!, depth + 1) ?? (ref[2] ? ref[2].trim() : null);
  }

  const LIGHT_PAIRS: Array<[ink: string, surface: string, min: number]> = [
    ['--text', '--surface-page', AA_BODY],
    ['--text-2', '--surface-page', AA_BODY],
    ['--meta', '--surface-page', AA_BODY],
    ['--text-faint', '--surface-page', AA_BODY],
    ['--brand-fg', '--surface-page', AA_BODY],
    ['--danger', '--surface-page', AA_BODY],
    ['--success', '--surface-page', AA_BODY],
    ['--on-danger', '--danger', AA_BODY],
    ['--on-success', '--success', AA_BODY],
  ];

  it.each(LIGHT_PAIRS.map((p) => [`${p[0]} on ${p[1]}`, p] as const))('%s still clears AA', (_l, [ink, surface, min]) => {
    const r = contrastRatio(lightResolve(ink)!, lightResolve(surface)!);
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThanOrEqual(min);
  });

  it('the semantic light values are the ones that were there before', () => {
    expect(lightResolve('--danger')).toBe('#a04230');   // .gobl-dash scope, unchanged
    expect(lightResolve('--success')).toBe('#3D7A4F');
    expect(lightResolve('--ink-3')).toBe('#5F5640');
    expect(lightResolve('--on-danger')).toBe('#FFFFFF'); // = the `#fff` the call sites had
    expect(lightResolve('--on-success')).toBe('#FFFFFF');
  });
});
