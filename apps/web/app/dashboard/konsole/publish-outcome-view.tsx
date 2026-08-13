/**
 * AKT 2 · PHASE 3 · C7 — what the console SHOWS for each publish outcome.
 *
 * Its own component for the same reason `refusal.ts` is its own module: the rule
 * that matters here ("a held publish renders no URL and never the word Live")
 * could otherwise only be checked by eye, because it lived inside a closure in a
 * 1,200-line client component. Now it renders in a test, one case per outcome.
 *
 * Pure and prop-driven — no fetch, no state, no effects. The classification is
 * `lib/publish-outcome.ts`; this file only decides what each verdict looks like.
 */

import { STR, type Lang } from './strings';
import type { PublishOutcome } from '@/lib/publish-outcome';

export function PublishOutcomeView({ outcome, lang }: { outcome: PublishOutcome | null; lang: Lang }) {
  if (!outcome) return null;
  const s = STR[lang].publish;

  switch (outcome.kind) {
    // The ONLY branch that renders a link, and it renders the server's URL —
    // never one composed here from the name the founder typed.
    case 'live':
      return (
        <p className="oc-lead" data-testid="publish-live">
          {s.published}{' '}
          <a href={outcome.url} target="_blank" rel="noreferrer">
            {outcome.url}
          </a>
        </p>
      );

    case 'review':
      return (
        <div className="oc-lead" data-testid="publish-review">
          <strong>{s.heldTitle}</strong>
          {/* The API's own German, verbatim. This card authors no sentence of its
              own about why something was held. */}
          {outcome.message ? <p>{outcome.message}</p> : null}
          <p className="oc-note">{s.heldPointer}</p>
        </div>
      );

    case 'not_recorded':
      return (
        <div className="oc-lead" data-testid="publish-not-recorded">
          <strong>{s.notRecordedTitle}</strong>
          {outcome.message ? <p>{outcome.message}</p> : null}
        </div>
      );

    // A deliberate answer, not a malfunction — so it does not go under "das hat
    // nicht funktioniert". The message names the category; the API deliberately
    // keeps rule ids out of this body.
    case 'refused':
      return (
        <div className="oc-lead" data-testid="publish-refused">
          <strong>{s.refusedTitle}</strong>
          {outcome.message ? <p>{outcome.message}</p> : null}
        </div>
      );

    case 'unclear':
      return (
        <div className="oc-why" data-testid="publish-unclear">
          <strong>{s.unclearTitle}</strong>
          <p>{s.unclearBody}</p>
          {outcome.message ? <p className="oc-note">{outcome.message}</p> : null}
        </div>
      );

    default: {
      // A new PublishOutcome member fails the build here rather than falling
      // through to a blank — or, as before, to "Live.".
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}
