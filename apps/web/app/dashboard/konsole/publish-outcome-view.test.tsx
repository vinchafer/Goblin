/**
 * AKT 2 · PHASE 3 · C7 — one test per outcome, in the surface the founder reads.
 *
 * `lib/publish-outcome.test.ts` proves the CLASSIFICATION is right. This proves
 * the RENDER is — which is where the defect actually lived: the classification
 * never existed, and the render said "Live." for everything that was not an error.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublishOutcomeView } from './publish-outcome-view';
import { classifyPublishOutcome } from '@/lib/publish-outcome';
import { STR, type Lang } from './strings';

const render = (outcome: Parameters<typeof PublishOutcomeView>[0]['outcome'], lang: Lang = 'de') =>
  renderToStaticMarkup(<PublishOutcomeView outcome={outcome} lang={lang} />);

/** The word that must appear for exactly one outcome and no other. */
const LIVE_DE = STR.de.publish.published; // "Live."

describe('one render per outcome', () => {
  it('LIVE shows the word and the server’s url as a link', () => {
    const html = render(classifyPublishOutcome(200, { url: 'https://meinladen.justgoblin.app', files: 3 }));
    expect(html).toContain('data-testid="publish-live"');
    expect(html).toContain(LIVE_DE);
    expect(html).toContain('href="https://meinladen.justgoblin.app"');
  });

  it('HELD shows the API’s German, a pointer to the queue — and NO url, NO "Live."', () => {
    // THE regression assertion. This exact render said "Live." before C7.
    const html = render(
      classifyPublishOutcome(202, {
        status: 'review',
        message: 'Diese Veröffentlichung wartet auf einen kurzen Blick durch einen Menschen. Hochgeladen wurde nichts …',
        reviewId: 'rv-1',
      }),
    );
    expect(html).toContain('data-testid="publish-review"');
    expect(html).toContain('Hochgeladen wurde nichts');
    expect(html).toContain(STR.de.publish.heldPointer);

    expect(html).not.toContain(LIVE_DE);
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('href');
    expect(html).not.toContain('http');
    // And no trace of the internals — the reviewId is for the API, not the reader.
    expect(html).not.toContain('rv-1');
  });

  it('REFUSED names the category and reads as a decision, not a malfunction', () => {
    const html = render(
      classifyPublishOutcome(422, {
        error: 'scan_blocked',
        message: 'Diese Veröffentlichung wurde gestoppt: Die Seite sieht aus wie das Abgreifen von Zugangsdaten … (Nutzungsrichtlinie).',
      }),
    );
    expect(html).toContain('data-testid="publish-refused"');
    expect(html).toContain('Nutzungsrichtlinie');
    expect(html).not.toContain(LIVE_DE);
    expect(html).not.toContain('href');
    // No rule internals reach the reader.
    for (const leak of ['PH-BRAND-CRED', 'WD-SEED-FIELD', 'ruleId', 'scan_blocked']) {
      expect(html, `refusal leaks ${leak}`).not.toContain(leak);
    }
  });

  it('NOT_RECORDED is its own line — held, and nobody is waiting on it', () => {
    const html = render(
      classifyPublishOutcome(503, {
        error: 'review_unqueued',
        message: 'Diese Anfrage konnten wir gerade nicht zur Prüfung vormerken … Bitte versuch es später noch einmal.',
      }),
    );
    expect(html).toContain('data-testid="publish-not-recorded"');
    expect(html).toContain('Bitte versuch es später noch einmal');
    expect(html).not.toContain(LIVE_DE);
    expect(html).not.toContain('href');
  });

  it('UNCLEAR says UNKLAR and refuses to imply either outcome', () => {
    const html = render(classifyPublishOutcome(200, {}));
    expect(html).toContain('data-testid="publish-unclear"');
    expect(html).toContain('UNKLAR');
    // The closing German quote is HTML-escaped in the markup, so match up to it.
    expect(html).toContain("Das heißt NICHT „live");
    expect(html).not.toContain(LIVE_DE);
    expect(html).not.toContain('href');
  });

  it('renders nothing at all before a publish has happened', () => {
    expect(render(null)).toBe('');
  });
});

describe('the guard, at the render layer', () => {
  it('ONLY the live outcome can produce a link or the word "Live."', () => {
    const outcomes = [
      classifyPublishOutcome(200, { url: 'https://a.justgoblin.app' }),
      classifyPublishOutcome(202, { status: 'review', message: 'x' }),
      classifyPublishOutcome(422, { error: 'scan_blocked', message: 'x' }),
      classifyPublishOutcome(503, { error: 'review_unqueued', message: 'x' }),
      classifyPublishOutcome(200, {}),
      classifyPublishOutcome(500, null),
    ];
    for (const o of outcomes) {
      const html = render(o);
      const claimsLive = html.includes(LIVE_DE) || html.includes('href');
      expect(claimsLive, `${o.kind} must not claim live`).toBe(o.kind === 'live');
    }
  });

  it('never renders an empty or undefined href', () => {
    // The original defect rendered `<a href={undefined}>` beside "Live.".
    for (const status of [200, 202, 422, 503, 500]) {
      const html = render(classifyPublishOutcome(status, status === 202 ? { status: 'review' } : {}));
      expect(html).not.toContain('href=""');
      expect(html).not.toContain('href="undefined"');
    }
  });

  it('says all of it in English too', () => {
    const html = render(classifyPublishOutcome(202, { status: 'review', message: 'held' }), 'en');
    expect(html).toContain(STR.en.publish.heldTitle);
    expect(html).not.toContain(STR.en.publish.published);
  });
});
