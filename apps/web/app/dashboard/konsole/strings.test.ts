// AKT 2 · PHASE 2.5 · U-C6 — DE/EN parity, and the copy-out's two honesty rules.
//
// The parity gate is "0 missing", and it is enforced twice on purpose:
//   • at compile time, because `en` is typed as `typeof de` — a missing key is a
//     type error before this file ever runs;
//   • at run time, here, because a type is satisfied by an empty string and by a
//     German sentence pasted into the English block, and neither is a translation.
//
// The walk is recursive rather than a top-level key compare: the nesting is where
// a missing string would actually hide.

import { describe, it, expect } from 'vitest';
import { STR, summaryLine, scrubForCopy } from './strings';

type Node = Record<string, unknown>;

/** Every leaf path in the tree, e.g. "apps.teardownWarnBody". */
function paths(obj: Node, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const p = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === 'object' && !Array.isArray(v) ? paths(v as Node, p) : [p];
  });
}

function at(obj: Node, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => (acc as Node)?.[k], obj);
}

describe('DE/EN parity — 0 missing, both directions', () => {
  const dePaths = paths(STR.de as unknown as Node).sort();
  const enPaths = paths(STR.en as unknown as Node).sort();

  it('has the same set of keys in both languages', () => {
    expect(enPaths.filter((p) => !dePaths.includes(p)), 'EN keys with no DE counterpart').toEqual([]);
    expect(dePaths.filter((p) => !enPaths.includes(p)), 'DE keys with no EN counterpart').toEqual([]);
    expect(enPaths).toEqual(dePaths);
  });

  it('covers every string the console can show', () => {
    expect(dePaths.length).toBeGreaterThan(90);
  });

  it('has no empty or whitespace-only string in either language', () => {
    for (const lang of ['de', 'en'] as const) {
      const empty = paths(STR[lang] as unknown as Node).filter((p) => String(at(STR[lang] as unknown as Node, p)).trim() === '');
      expect(empty, `${lang} has empty strings`).toEqual([]);
    }
  });

  it('has every value actually be a string', () => {
    for (const lang of ['de', 'en'] as const) {
      const notString = paths(STR[lang] as unknown as Node).filter((p) => typeof at(STR[lang] as unknown as Node, p) !== 'string');
      expect(notString, `${lang} has non-string leaves`).toEqual([]);
    }
  });

  it('does not leave German prose sitting in the English block', () => {
    // Words that cannot legitimately appear in an English UI string. Not a
    // grammar check — a leak detector for copy-paste that never got translated.
    const GERMAN = /\b(und|oder|nicht|kann|wird|werden|ist|sind|eine|einen|einem|keine|Datei|Adresse|Fehler|Grund|Sperre|gesperrt|Zwischenablage|Arbeitsspeicher|löschen|geht|Schritte|Namen)\b/;
    const leaks = paths(STR.en as unknown as Node).filter((p) => GERMAN.test(String(at(STR.en as unknown as Node, p))));
    expect(leaks, `untranslated German in EN: ${leaks.join(', ')}`).toEqual([]);
  });

  it('keeps the two languages from being byte-identical where it matters', () => {
    // A handful of proper nouns and env names legitimately match; full sentences
    // must not. Anything over 40 chars that is identical is a missed translation.
    const identical = dePaths.filter((p) => {
      const d = String(at(STR.de as unknown as Node, p));
      return d.length > 40 && d === String(at(STR.en as unknown as Node, p));
    });
    expect(identical, `identical long strings: ${identical.join(', ')}`).toEqual([]);
  });
});

describe('the German summary line reports the run, not a nicer version of it', () => {
  it('says BESTANDEN only when the report says passed', () => {
    const numbers = { publishLoops: '5/5', scanBattery: '9/9', suspensionRoundTrip: '3/3' };
    expect(summaryLine({ passed: true, numbers, steps: [{ ok: true }] })).toContain('BESTANDEN');
    expect(summaryLine({ passed: false, numbers, steps: [{ ok: true }] })).toContain('NICHT BESTANDEN');
  });

  it('carries all three headline numbers verbatim', () => {
    const line = summaryLine({
      passed: false,
      numbers: { publishLoops: '2/5', scanBattery: '9/9', suspensionRoundTrip: '0/3' },
      steps: [{ ok: true }, { ok: false }],
    });
    expect(line).toContain('2/5');
    expect(line).toContain('9/9');
    expect(line).toContain('0/3');
    expect(line).toContain('Schritte 1/2');
  });

  it('says UNBEKANNT rather than inventing a number that is missing', () => {
    const line = summaryLine({ passed: false, numbers: {}, steps: [] });
    expect(line).toContain('UNBEKANNT');
    expect(line).not.toContain('undefined');
    expect(line).not.toContain('0/0 ·'); // no fabricated denominators
  });
});

describe('scrubForCopy removes what must not travel into a pasted report', () => {
  it('removes email addresses anywhere in the tree', () => {
    const out = scrubForCopy({
      actor: 'vinc.hafner3@gmail.com',
      steps: [{ detail: 'suspended by vinc.hafner3@gmail.com at 12:00' }],
      nested: { deep: { who: 'someone@example.org' } },
    });
    const text = JSON.stringify(out);
    expect(text).not.toContain('@gmail.com');
    expect(text).not.toContain('@example.org');
    expect(text).toContain('[email entfernt]');
  });

  it('removes any value under a secret-shaped key, whatever it holds', () => {
    const out = scrubForCopy({
      token: 'abc',
      apiKey: 'xyz',
      Authorization: 'Bearer nope',
      password: 'hunter2',
      nested: { CF_API_TOKEN: 'secret-value' },
    }) as Record<string, unknown>;
    expect(out.token).toBe('[entfernt]');
    expect(out.apiKey).toBe('[entfernt]');
    expect(out.Authorization).toBe('[entfernt]');
    expect(out.password).toBe('[entfernt]');
    expect(JSON.stringify(out)).not.toContain('secret-value');
    expect(JSON.stringify(out)).not.toContain('hunter2');
  });

  it('removes long opaque token-shaped strings even under an innocent key', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const out = scrubForCopy({ note: `see ${jwt} for details` }) as { note: string };
    // The WHOLE token goes, header segment included: leaving the header behind
    // still names the algorithm and still reads as a credential in a document.
    expect(out.note).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(out.note).not.toContain('eyJzdWIiOiIxMjM0NTY3ODkwIn0');
    expect(out.note).toBe('see [entfernt] for details');
  });

  it('also removes a bare 32+ char opaque run', () => {
    const out = scrubForCopy({ note: 'key=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8' }) as { note: string };
    expect(out.note).toBe('key=[entfernt]');
  });

  it('leaves ordinary identifiers and URLs readable', () => {
    const out = scrubForCopy({
      url: 'https://e2e-ab12.justgoblin.app',
      appId: '7f3c1a2b-9d4e-4f10-8a55-1c2d3e4f5a6b',
      step: 'suspend:page-live',
    }) as Record<string, string>;
    expect(out.url).toBe('https://e2e-ab12.justgoblin.app');
    expect(out.appId).toBe('7f3c1a2b-9d4e-4f10-8a55-1c2d3e4f5a6b');
    expect(out.step).toBe('suspend:page-live');
  });

  it('leaves the numbers, step names and details a phase report needs', () => {
    const report = {
      passed: true,
      numbers: { publishLoops: '5/5', scanBattery: '9/9', suspensionRoundTrip: '3/3' },
      steps: [
        { step: 'publish:1/5', ok: true, detail: 'live at https://e2e-ab12.justgoblin.app (3 files)' },
        { step: 'suspend:page-live', ok: true, detail: '403 with the suspended page', propagationSec: 42 },
      ],
      notes: ['BLOCKED-ON-DNS: nothing was run'],
    };
    const out = scrubForCopy(report) as typeof report;
    expect(out.numbers).toEqual(report.numbers);
    expect(out.steps[0]!.step).toBe('publish:1/5');
    expect(out.steps[1]!.propagationSec).toBe(42);
    expect(out.steps[1]!.detail).toBe('403 with the suspended page');
    expect(out.notes).toEqual(report.notes);
    expect(out.passed).toBe(true);
  });

  it('preserves structure — arrays stay arrays, booleans stay booleans', () => {
    const out = scrubForCopy({ a: [1, 2, 3], b: true, c: null, d: 4.5 }) as Record<string, unknown>;
    expect(Array.isArray(out.a)).toBe(true);
    expect(out.a).toEqual([1, 2, 3]);
    expect(out.b).toBe(true);
    expect(out.c).toBeNull();
    expect(out.d).toBe(4.5);
  });
});
