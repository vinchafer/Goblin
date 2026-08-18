import { describe, it, expect } from 'vitest';
import { LANDING_COPY, landingPath } from './copy';

/**
 * LANDING-MESSAGING v2 · U6 — the gate that keeps the German landing honest.
 *
 * `LandingCopy = typeof EN` already makes a missing or misspelled KEY a compile
 * error. What that inference cannot see is array LENGTH: a German `cards` array
 * with three entries where English has four typechecks cleanly and silently
 * ships a landing with a missing card. It also cannot see an empty string, or a
 * German entry left as its English original.
 *
 * So this walks both trees and fails on any structural difference — which is the
 * difference between "we translated the landing" and "we translated most of it".
 */

type Node = string | Node[] | { [k: string]: Node };

function walk(a: Node, b: Node, path: string, out: string[]) {
  if (typeof a === 'string') {
    if (typeof b !== 'string') { out.push(`${path}: EN is a string, DE is ${typeof b}`); return; }
    if (b.trim() === '') out.push(`${path}: DE is empty`);
    return;
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) { out.push(`${path}: EN is an array, DE is not`); return; }
    if (a.length !== b.length) { out.push(`${path}: EN has ${a.length} entries, DE has ${b.length}`); return; }
    a.forEach((item, i) => walk(item, (b as Node[])[i], `${path}[${i}]`, out));
    return;
  }
  const bo = b as { [k: string]: Node };
  if (typeof bo !== 'object' || bo === null || Array.isArray(bo)) {
    out.push(`${path}: EN is an object, DE is not`); return;
  }
  const ak = Object.keys(a).sort();
  const bk = Object.keys(bo).sort();
  const missing = ak.filter((k) => !bk.includes(k));
  const extra = bk.filter((k) => !ak.includes(k));
  if (missing.length) out.push(`${path}: DE is missing ${missing.join(', ')}`);
  if (extra.length) out.push(`${path}: DE has unexpected ${extra.join(', ')}`);
  ak.filter((k) => bk.includes(k)).forEach((k) => walk(a[k], bo[k], `${path}.${k}`, out));
}

/** Every leaf string in a copy tree, with its dotted path. */
function leaves(n: Node, path = '', acc: [string, string][] = []): [string, string][] {
  if (typeof n === 'string') acc.push([path, n]);
  else if (Array.isArray(n)) n.forEach((v, i) => leaves(v, `${path}[${i}]`, acc));
  else Object.entries(n).forEach(([k, v]) => leaves(v, path ? `${path}.${k}` : k, acc));
  return acc;
}

describe('landing copy — EN/DE parity', () => {
  it('has the identical shape in both languages, with no empty German string', () => {
    const problems: string[] = [];
    walk(LANDING_COPY.en as unknown as Node, LANDING_COPY.de as unknown as Node, 'copy', problems);
    expect(problems).toEqual([]);
  });

  it('translates every string that is not deliberately shared', () => {
    // Brand names, product names and a handful of terms Goblin uses untranslated
    // in its own German UI ("Send to Code" is the product's German label too —
    // see app/dashboard/page.tsx). Everything else must actually differ, so an
    // untranslated paragraph cannot hide behind a green parity check.
    const SHARED = new Set([
      'nav.faq', 'faq.label', 'phone.mode', 'phone.model',
      'runtime.modelsEyebrowB', 'footer.faq', 'footer.copyright',
      'island.steps[2].title', 'problem.cards[0].num', 'problem.cards[1].num',
      'problem.cards[2].num', 'problem.cards[3].num',
      'pricing.plans[0].label', 'pricing.plans[1].label', 'pricing.plans[2].label',
      'phone.updates[2].date',
      // "Goblin" is the brand; "Plan" is the German word too — that step's German
      // was authored by the founder in AgentFlow.tsx and reads "Plan" on purpose.
      'runtime.cards[1].label', 'agent.steps[0].title',
    ]);
    const en = new Map(leaves(LANDING_COPY.en as unknown as Node));
    const de = new Map(leaves(LANDING_COPY.de as unknown as Node));
    const untranslated = [...en.entries()]
      .filter(([p, v]) => !SHARED.has(p) && de.get(p) === v)
      .map(([p, v]) => `${p} = ${JSON.stringify(v)}`);
    expect(untranslated).toEqual([]);
  });

  it('maps each language to its own route', () => {
    expect(landingPath('en')).toBe('/');
    expect(landingPath('de')).toBe('/de');
  });
});
