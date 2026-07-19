// WAVE-H · H4 — the honest server "auf Anschlag" body contract: stable machine code,
// truthful German copy (defer, not fail; no English leak), Retry-After passed through.

import { describe, it, expect } from 'vitest';
import { capacityResponseBody } from './capacity-copy';

describe('WAVE-H H4 — capacity response body', () => {
  it('global_limit → honest "auf Anschlag", machine code + retry-after', () => {
    const body = capacityResponseBody({ admitted: false, reason: 'global_limit', retryAfterSec: 8 });
    expect(body.error).toBe('agent_at_capacity');
    expect(body.reason).toBe('global_limit');
    expect(body.retryAfterSeconds).toBe(8);
    expect(body.message).toContain('auf Anschlag');
    // Honest: never claims the run failed or ran; no English leak.
    expect(body.message).not.toMatch(/fehlgeschlagen|failed|error/i);
    expect(body.message).not.toMatch(/[Cc]apacity|your run/);
  });

  it('per_user_limit → honest "schon einen Lauf offen"', () => {
    const body = capacityResponseBody({ admitted: false, reason: 'per_user_limit', retryAfterSec: 12 });
    expect(body.reason).toBe('per_user_limit');
    expect(body.retryAfterSeconds).toBe(12);
    expect(body.message).toContain('schon einen Lauf');
    expect(body.message).not.toMatch(/fehlgeschlagen|failed/i);
  });
});
