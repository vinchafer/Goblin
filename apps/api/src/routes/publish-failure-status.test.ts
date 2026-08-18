/**
 * FOUNDER-WALK-7 · U7 (D-F2) — what each publish failure MEANS, as a status.
 *
 * The founder tapped "Live stellen" four times and was told the server was briefly
 * unreachable. The client half of that lie is fixed in D-F1 (lib/api.ts). This is
 * the server half: `empty_artifact` — "In diesem Projekt liegen noch keine Dateien,
 * die veröffentlicht werden könnten." — answered 502, a bad gateway, which is a
 * claim that something UPSTREAM misbehaved. Nothing did. The project had nothing in
 * it, which is a precondition the builder can act on.
 *
 * The two halves compound: a precondition filed as a gateway error landed in the
 * client's `status >= 500` branch, which is where the German was discarded.
 *
 * This mapping had no test before this file, which is how a code could sit in the
 * wrong class without anyone noticing.
 *
 * FALSIFICATION: `publishFailureStatus` is new (extracted from an inline ternary),
 * so all 4 fail on the pre-fix tree — but only the first encodes the behaviour
 * change; the other three pin the classes that must NOT move, and they assert the
 * pre-fix values.
 */
import { describe, it, expect } from 'vitest';
import { publishFailureStatus } from './ops';

describe('publishFailureStatus', () => {
  it('empty_artifact is a precondition (422), not a bad gateway (502)', () => {
    expect(publishFailureStatus('empty_artifact')).toBe(422);
  });

  it('a deterministic refusal keeps 422', () => {
    expect(publishFailureStatus('scan_blocked')).toBe(422);
  });

  it('name conflicts keep 409', () => {
    expect(publishFailureStatus('name_taken')).toBe(409);
    expect(publishFailureStatus('name_released')).toBe(409);
    expect(publishFailureStatus('invalid_name')).toBe(409);
  });

  it('genuine substrate failures keep their statuses — 503 for ours, 502 for upstream', () => {
    expect(publishFailureStatus('d1_unavailable')).toBe(503);
    expect(publishFailureStatus('form_unwirable')).toBe(503);
    // These really are "the thing we depend on answered wrongly".
    expect(publishFailureStatus('upload_failed')).toBe(502);
    expect(publishFailureStatus('route_failed')).toBe(502);
    expect(publishFailureStatus('not_verified')).toBe(502);
  });
});
