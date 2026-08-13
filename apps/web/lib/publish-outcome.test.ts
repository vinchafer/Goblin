/**
 * AKT 2 · PHASE 3 · C7 — the honesty rule of the publish outcome, as a test.
 *
 * The defect this guards against shipped once and reached the founder window:
 * the console read `if (response.ok)` and rendered "Live." for a 202 that had
 * uploaded nothing. The lesson is not "add a branch" — it is that the DEFAULT of
 * this classification must be doubt, not success. So the first describe block is
 * about the four outcomes, and the second is the guard: everything unrecognised
 * lands on `unclear`, and nothing but a real URL lands on `live`.
 */

import { describe, it, expect } from 'vitest';
import { classifyPublishOutcome, isLive, type PublishOutcome } from './publish-outcome';

describe('the four outcomes the publish path can report', () => {
  it('200 with a url is LIVE, and carries the server’s url', () => {
    const o = classifyPublishOutcome(200, { url: 'https://meinladen.justgoblin.app', files: 3 });
    expect(o).toEqual({ kind: 'live', url: 'https://meinladen.justgoblin.app', files: 3 });
    expect(isLive(o)).toBe(true);
  });

  it('202 status=review is HELD — and carries no url at all', () => {
    const o = classifyPublishOutcome(202, {
      status: 'review',
      message: 'Diese Veröffentlichung wartet auf einen kurzen Blick durch einen Menschen. …',
      reviewId: 'rv-1',
    });
    expect(o.kind).toBe('review');
    expect(o).not.toHaveProperty('url');
    expect(isLive(o)).toBe(false);
    if (o.kind === 'review') expect(o.reviewId).toBe('rv-1');
  });

  it('422 scan_blocked is REFUSED, with the API’s own German', () => {
    const o = classifyPublishOutcome(422, {
      error: 'scan_blocked',
      message: 'Diese Veröffentlichung wurde gestoppt: … (Nutzungsrichtlinie).',
    });
    expect(o.kind).toBe('refused');
    expect(isLive(o)).toBe(false);
    if (o.kind === 'refused') expect(o.message).toContain('Nutzungsrichtlinie');
  });

  it('503 review_unqueued is its OWN kind — held, and nobody is waiting on it', () => {
    // Not folded into `review`: the promise is different, and the German says so.
    const o = classifyPublishOutcome(503, {
      error: 'review_unqueued',
      message: 'Diese Anfrage konnten wir gerade nicht zur Prüfung vormerken … Bitte versuch es später noch einmal.',
    });
    expect(o.kind).toBe('not_recorded');
    expect(isLive(o)).toBe(false);
  });
});

// ── THE GUARD ───────────────────────────────────────────────────────────────

describe('the guard: this class of bug cannot return quietly', () => {
  /**
   * THE regression test. A held publish must render neither the word "Live." nor
   * a URL — asserted here at the classification layer, where both surfaces read
   * from, and again in the console's own render test.
   */
  it('a HELD publish yields nothing a UI could render as a link or as live', () => {
    const o = classifyPublishOutcome(202, { status: 'review', message: 'gehalten' });
    expect(o.kind).not.toBe('live');
    expect(JSON.stringify(o)).not.toContain('http');
    expect((o as { url?: string }).url).toBeUndefined();
  });

  it.each<[string, number, Record<string, unknown> | null]>([
    ['a 200 with no url at all', 200, {}],
    ['a 200 with an empty url', 200, { url: '' }],
    ['a 200 with a whitespace url', 200, { url: '   ' }],
    ['a 200 with a non-string url', 200, { url: 42 }],
    ['a null body', 200, null],
    ['a 204 with nothing in it', 204, null],
    ['a verdict nobody taught it about', 202, { status: 'quarantined', message: 'neu' }],
    ['an error code nobody taught it about', 418, { error: 'teapot', message: 'nope' }],
    ['a 500', 500, null],
    ['a network failure (status 0)', 0, null],
  ])('%s is UNCLEAR, never live', (_label, status, body) => {
    const o = classifyPublishOutcome(status, body);
    expect(o.kind).toBe('unclear');
    expect(isLive(o)).toBe(false);
  });

  it('never invents a url — `live` is impossible without the server sending one', () => {
    // Exhaustive over every shape in the table above plus the known verdicts: the
    // only input that can produce `live` is one carrying a real url string.
    const inputs: Array<[number, Record<string, unknown> | null]> = [
      [200, {}], [200, { url: '' }], [200, { files: 3 }], [202, { status: 'review' }],
      [422, { error: 'scan_blocked' }], [503, { error: 'review_unqueued' }], [500, null], [0, null],
    ];
    for (const [status, body] of inputs) {
      expect(classifyPublishOutcome(status, body).kind, `${status} ${JSON.stringify(body)}`).not.toBe('live');
    }
  });

  it('prefers the HOLD when a response somehow claims both', () => {
    // Defensive ordering: if a future payload ever carried a url beside a review
    // verdict, the app is still not live and the hold is the fact that matters.
    const o = classifyPublishOutcome(202, { status: 'review', url: 'https://x.justgoblin.app', message: 'gehalten' });
    expect(o.kind).toBe('review');
  });

  it('every kind is handled — an added kind breaks the build, not production', () => {
    // The compile-time half of the guard: `never` here means a new member of
    // PublishOutcome cannot be added without every switch being revisited.
    const describeKind = (o: PublishOutcome): string => {
      switch (o.kind) {
        case 'live': return 'live';
        case 'review': return 'review';
        case 'refused': return 'refused';
        case 'not_recorded': return 'not_recorded';
        case 'unclear': return 'unclear';
        default: {
          const exhaustive: never = o;
          return exhaustive;
        }
      }
    };
    expect(describeKind(classifyPublishOutcome(200, { url: 'https://a.b' }))).toBe('live');
    expect(describeKind(classifyPublishOutcome(202, { status: 'review' }))).toBe('review');
  });
});
