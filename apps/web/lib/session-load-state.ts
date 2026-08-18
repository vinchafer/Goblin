// FOUNDER-WALK-7 · U4 (D-D) — the sentence for a session whose files could not be read.
//
// The rule this module exists to enforce: the Code surface has exactly TWO empty
// looks, and they must never be the same one.
//
//   • "Noch keine Dateien"  — established. The session really has nothing in it.
//   • "konnte nicht gelesen werden" — NOT established. Something failed, and
//     rendering it as the first sentence is the product asserting a state it did
//     not verify.
//
// D-D was the second wearing the first's clothes: a failed first load left the
// editor blank with "Noch keine Dateien", and only a round trip through another
// project — which happened to make the request succeed — revealed that the code had
// been there all along.

import type { DetailLoadError } from '@/hooks/code/useCodeSessionDetail';

export interface SessionLoadNotice {
  headline: string;
  detail: string;
}

/**
 * The honest German for a load that did not resolve.
 *
 * Deliberately absent from every branch: a cause the client cannot establish (the
 * status number is what came back, not a diagnosis of why), a prediction about when
 * it will work, and the raw response. The status is named because it is a fact and
 * it is what the founder can quote into a bug report; it is not dressed up as an
 * explanation.
 */
export function sessionLoadNotice(error: DetailLoadError | null): SessionLoadNotice | null {
  if (!error) return null;
  if (error.kind === 'incomplete') {
    return {
      headline: 'Nicht alle Projektdateien konnten geladen werden.',
      detail: 'Was hier steht, ist echt — vollständig ist es womöglich nicht. Lade die Seite neu, bevor du auf dieser Grundlage weiterbaust.',
    };
  }
  if (error.kind === 'unreachable') {
    return {
      headline: 'Diese Session konnte nicht geladen werden.',
      detail: 'Die Anfrage kam nicht durch. Ob hier Dateien liegen, ist damit offen — nicht beantwortet.',
    };
  }
  return {
    headline: 'Diese Session konnte nicht geladen werden.',
    detail: `Die Antwort war HTTP ${error.status}. Ob hier Dateien liegen, ist damit offen — nicht beantwortet.`,
  };
}

/**
 * The status-strip state. `unknown` is the third value the strip needed: it used to
 * have only "empty", so a session it could not read was labelled a session with
 * nothing in it.
 */
export function surfaceStateFor(
  error: DetailLoadError | null,
  resolved: 'empty' | 'draft' | 'saved' | 'deployed',
): 'unknown' | 'empty' | 'draft' | 'saved' | 'deployed' {
  // An incomplete hydrate still shows real files; the strip keeps describing them
  // and the banner above carries the caveat. Only a load that produced NOTHING is
  // "unknown" — that is the case that used to read as "Noch keine Dateien".
  if (error && error.kind !== 'incomplete' && resolved === 'empty') return 'unknown';
  return resolved;
}
