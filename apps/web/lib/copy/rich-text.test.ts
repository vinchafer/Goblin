import { describe, it, expect } from 'vitest';
import { tokenizeEmphasis } from './rich-text';
import { ABOUT_COPY } from './about';
import { MANIFESTO_COPY } from './manifesto';

/**
 * WAVE-ABOUT-MANIFESTO · U2 gate.
 *
 * Two things are worth a test here, and neither is "does bold work":
 *
 *   1. The parser must never SWALLOW copy. A translated string with a mistyped
 *      marker has to degrade to visible asterisks, not to a missing sentence —
 *      losing a line silently is exactly the failure this page's first belief is
 *      about.
 *   2. The page's structure must keep matching its own claims. "Six things we
 *      believe" over five rendered items is the page lying about itself, and the
 *      German block is a hand-maintained mirror of the English one, so its shape
 *      can drift the moment the founder starts replacing values.
 */

describe('tokenizeEmphasis', () => {
  it('splits bold and italic runs and keeps the surrounding prose', () => {
    const tokens = tokenizeEmphasis('It is **the entire thing**, not *nearly* it.');
    expect(tokens).toEqual([
      { text: 'It is ', bold: false, italic: false },
      { text: 'the entire thing', bold: true, italic: false },
      { text: ', not ', bold: false, italic: false },
      { text: 'nearly', bold: false, italic: true },
      { text: ' it.', bold: false, italic: false },
    ]);
  });

  it('reads ** as bold, never as two italics', () => {
    const tokens = tokenizeEmphasis('**you can leave.**');
    expect(tokens).toEqual([{ text: 'you can leave.', bold: true, italic: false }]);
  });

  // The honesty case. Markers may legitimately be consumed (that is the job) or
  // kept literal (when unbalanced), so the invariant is about the PROSE: every
  // non-marker character survives, in order. A malformed German string must
  // degrade to stray asterisks on the page, never to a missing sentence.
  it.each([
    'a lone * asterisk',
    'unbalanced **bold that never closes',
    'unbalanced *italic that never closes',
    'empty markers ** and * *',
    '3am, 5 * 4, and a footnote*',
    '**leading bold** then trailing *emphasis*',
  ])('never drops prose: %s', (input) => {
    const rendered = tokenizeEmphasis(input).map((t) => t.text).join('');
    expect(rendered.replace(/\*/g, '')).toBe(input.replace(/\*/g, ''));
  });

  it('round-trips every paragraph of the shipped copy without losing a character', () => {
    const paragraphs = [
      ...ABOUT_COPY.en.intro,
      ...ABOUT_COPY.en.gap,
      ...ABOUT_COPY.en.what,
      ...ABOUT_COPY.en.who,
      ...MANIFESTO_COPY.en.beliefs.flatMap((b) => b.body),
      ...MANIFESTO_COPY.en.so,
    ];
    for (const p of paragraphs) {
      const rendered = tokenizeEmphasis(p).map((t) => t.text).join('');
      expect(rendered).toBe(p.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1'));
    }
  });
});

describe('page copy structure', () => {
  it('the manifesto ships exactly the six beliefs its H1 promises', () => {
    expect(MANIFESTO_COPY.en.h1).toBe('Six things we believe');
    expect(MANIFESTO_COPY.en.beliefs).toHaveLength(6);
    expect(MANIFESTO_COPY.de.beliefs).toHaveLength(6);
  });

  it('every belief has a title and at least one paragraph, in both locales', () => {
    for (const lang of ['en', 'de'] as const) {
      for (const belief of MANIFESTO_COPY[lang].beliefs) {
        expect(belief.title.trim().length).toBeGreaterThan(0);
        expect(belief.body.length).toBeGreaterThan(0);
        expect(belief.body.every((p) => p.trim().length > 0)).toBe(true);
      }
    }
  });

  it('the German block mirrors the English shape — no dropped paragraph in translation', () => {
    expect(ABOUT_COPY.de.intro).toHaveLength(ABOUT_COPY.en.intro.length);
    expect(ABOUT_COPY.de.gap).toHaveLength(ABOUT_COPY.en.gap.length);
    expect(ABOUT_COPY.de.what).toHaveLength(ABOUT_COPY.en.what.length);
    expect(ABOUT_COPY.de.who).toHaveLength(ABOUT_COPY.en.who.length);
    expect(MANIFESTO_COPY.de.so).toHaveLength(MANIFESTO_COPY.en.so.length);
    MANIFESTO_COPY.en.beliefs.forEach((belief, i) => {
      expect(MANIFESTO_COPY.de.beliefs[i].body).toHaveLength(belief.body.length);
    });
  });

  it('no locale value is empty — an untranslated key is English, never blank', () => {
    const strings = (o: unknown): string[] =>
      typeof o === 'string' ? [o]
      : Array.isArray(o) ? o.flatMap(strings)
      : o && typeof o === 'object' ? Object.values(o).flatMap(strings)
      : [];
    for (const copy of [ABOUT_COPY.en, ABOUT_COPY.de, MANIFESTO_COPY.en, MANIFESTO_COPY.de]) {
      for (const s of strings(copy)) expect(s.trim().length).toBeGreaterThan(0);
    }
  });
});
