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
import { t, type Lang } from '@/lib/use-lang';

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
export function sessionLoadNotice(error: DetailLoadError | null, lang: Lang = 'de'): SessionLoadNotice | null {
  if (!error) return null;
  if (error.kind === 'incomplete') {
    return {
      headline: t(lang,
        'Nicht alle Projektdateien konnten geladen werden.',
        'Not all project files could be loaded.'),
      detail: t(lang,
        'Was hier steht, ist echt — vollständig ist es womöglich nicht. Lade die Seite neu, bevor du auf dieser Grundlage weiterbaust.',
        'What is shown is real — it may not be everything. Reload before you build on it.'),
    };
  }
  const headline = t(lang,
    'Diese Session konnte nicht geladen werden.',
    'This session could not be loaded.');
  // The second sentence is the one that matters: it refuses to answer a question
  // nobody answered. "No files" was the old, wrong answer to it.
  const open = t(lang,
    'Ob hier Dateien liegen, ist damit offen — nicht beantwortet.',
    'Whether there are files here is therefore open — not answered.');
  if (error.kind === 'unreachable') {
    return {
      headline,
      detail: `${t(lang, 'Die Anfrage kam nicht durch.', 'The request did not get through.')} ${open}`,
    };
  }
  return {
    headline,
    detail: `${t(lang, `Die Antwort war HTTP ${error.status}.`, `The response was HTTP ${error.status}.`)} ${open}`,
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
