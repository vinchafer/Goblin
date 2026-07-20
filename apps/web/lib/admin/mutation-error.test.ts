import { describe, it, expect } from 'vitest';
import { describeMutationError, readMutationError } from './mutation-error';

describe('describeMutationError', () => {
  it('returns null when the response was ok (no false error)', () => {
    expect(describeMutationError({ ok: true, status: 200 })).toBeNull();
  });

  it('surfaces the unconfigured-admin-key case honestly', () => {
    const msg = describeMutationError({ ok: false, status: 500, body: { error: 'admin_key_unconfigured' } }, 'en');
    expect(msg).toMatch(/admin key/i);
  });

  it('maps 403 to a not-authorized message (de + en)', () => {
    expect(describeMutationError({ ok: false, status: 403 }, 'en')).toMatch(/not authorized/i);
    expect(describeMutationError({ ok: false, status: 403 }, 'de')).toMatch(/nicht berechtigt/i);
  });

  it('maps 502 to an unavailable message', () => {
    expect(describeMutationError({ ok: false, status: 502 }, 'en')).toMatch(/unavailable/i);
  });

  it('includes the HTTP status and a safe detail for unknown errors', () => {
    const msg = describeMutationError({ ok: false, status: 422, body: { detail: 'plan must be one of build/pro/power' } }, 'en');
    expect(msg).toContain('422');
    expect(msg).toContain('plan must be one of');
  });

  it('never floods the UI with a giant/multiline body (stack-trace guard)', () => {
    const huge = 'Error\n'.repeat(500);
    const msg = describeMutationError({ ok: false, status: 500, body: { detail: huge } }, 'en')!;
    expect(msg.length).toBeLessThan(200);
    expect(msg).not.toContain('\n');
  });

  it('falls back to a bare status line when there is no body', () => {
    expect(describeMutationError({ ok: false, status: 500 }, 'en')).toBe('Action failed (HTTP 500)');
    expect(describeMutationError({ ok: false, status: 500 }, 'de')).toBe('Aktion fehlgeschlagen (HTTP 500)');
  });
});

describe('readMutationError', () => {
  it('returns null for an ok response', async () => {
    const res = new Response('{}', { status: 200 });
    expect(await readMutationError(res)).toBeNull();
  });

  it('describes a failed response body', async () => {
    const res = new Response(JSON.stringify({ error: 'boom', detail: 'nope' }), { status: 400 });
    expect(await readMutationError(res, 'en')).toContain('400');
  });

  it('degrades gracefully when the body is not JSON', async () => {
    const res = new Response('<html>500</html>', { status: 500 });
    const msg = await readMutationError(res, 'en');
    expect(msg).toBe('Action failed (HTTP 500)');
  });
});
