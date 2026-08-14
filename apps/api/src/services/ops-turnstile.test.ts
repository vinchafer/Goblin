/**
 * AKT 2 · PHASE 4 · U4.3 — Turnstile verification.
 *
 * One property carries this file: THERE IS NO PATH THROUGH IT THAT RETURNS `ok`
 * WITHOUT CLOUDFLARE HAVING SAID SO. Every other test here is a way of trying to
 * find one — no secret, no token, a timeout, a 500, a garbled body, a rejected
 * secret — and each has to come back refused.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { verifyTurnstile, turnstileConfigured, turnstileSiteKey } = await import('./ops-turnstile');

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  process.env.CF_TURNSTILE_SECRET_KEY = '0x-secret-value';
  delete process.env.CF_TURNSTILE_SITE_KEY;
});

describe('configuration', () => {
  it('reports the secret’s presence without ever returning it', () => {
    expect(turnstileConfigured()).toBe(true);
    delete process.env.CF_TURNSTILE_SECRET_KEY;
    expect(turnstileConfigured()).toBe(false);
  });

  it('reads the site key through the same unwrapper, so a pasted value with quotes works', () => {
    process.env.CF_TURNSTILE_SITE_KEY = '"0x4AAA"';
    expect(turnstileSiteKey()).toBe('0x4AAA');
  });

  it('an unset site key is an empty string, not the literal "undefined"', () => {
    expect(turnstileSiteKey()).toBe('');
  });
});

describe('the refusals', () => {
  it('NO SECRET refuses — it never waves traffic through', async () => {
    delete process.env.CF_TURNSTILE_SECRET_KEY;
    const fetchImpl = vi.fn();
    const res = await verifyTurnstile('tok', fetchImpl as unknown as typeof fetch);
    expect(res).toEqual({ ok: false, code: 'not_configured', codes: [] });
    // And it did not even ask — nothing was sent anywhere.
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('no token is its own answer', async () => {
    const res = await verifyTurnstile('  ', vi.fn() as unknown as typeof fetch);
    expect(res).toEqual({ ok: false, code: 'missing_token', codes: [] });
  });

  it('a failed challenge carries Cloudflare’s codes for the log, not for the visitor', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: false, 'error-codes': ['timeout-or-duplicate'] }));
    const res = await verifyTurnstile('tok', fetchImpl as unknown as typeof fetch);
    expect(res).toEqual({ ok: false, code: 'failed', codes: ['timeout-or-duplicate'] });
  });

  it('a REJECTED SECRET is our fault, not the visitor’s, and is reported as configuration', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: false, 'error-codes': ['invalid-input-secret'] }));
    const res = await verifyTurnstile('tok', fetchImpl as unknown as typeof fetch);
    expect(res).toMatchObject({ ok: false, code: 'not_configured' });
  });

  it('an upstream 5xx is UNAVAILABLE — unknown, never green', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 500));
    expect(await verifyTurnstile('tok', fetchImpl as unknown as typeof fetch)).toMatchObject({ code: 'unavailable' });
  });

  it('a body that is not JSON is UNAVAILABLE, not a pass', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>maintenance</html>', { status: 200 }));
    expect(await verifyTurnstile('tok', fetchImpl as unknown as typeof fetch)).toMatchObject({ code: 'unavailable' });
  });

  it('a hang is bounded and answers UNAVAILABLE — a request must not be held open', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        }),
    );
    vi.useFakeTimers();
    const pending = verifyTurnstile('tok', fetchImpl as unknown as typeof fetch);
    await vi.advanceTimersByTimeAsync(6_000);
    const res = await pending;
    vi.useRealTimers();
    expect(res).toMatchObject({ ok: false, code: 'unavailable' });
  });

  it('a body that omits `success` entirely is refused, never defaulted to true', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ 'error-codes': [] }));
    expect(await verifyTurnstile('tok', fetchImpl as unknown as typeof fetch)).toMatchObject({ ok: false });
  });
});

describe('the one path that passes', () => {
  it('passes only on an explicit success from Cloudflare', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: true }));
    expect(await verifyTurnstile('tok', fetchImpl as unknown as typeof fetch)).toEqual({ ok: true });
  });

  it('sends the secret and the token as form fields — and NOTHING about the visitor', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: { body?: unknown }) => {
      const body = init?.body as URLSearchParams;
      // `remoteip` is deliberately absent: this code path never holds an address,
      // which is what makes "no visitor IP leaves Goblin" a property of the code.
      expect([...body.keys()].sort()).toEqual(['response', 'secret']);
      expect(body.get('response')).toBe('tok');
      return jsonResponse({ success: true });
    });
    await verifyTurnstile('tok', fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('the secret never reaches an outbound string', () => {
  it('is redacted out of anything the Cloudflare adapter emits', async () => {
    const { redactSecrets } = await import('./cf-deploy');
    process.env.CF_TURNSTILE_SECRET_KEY = 'super-secret-turnstile-value';
    expect(redactSecrets('upstream said: super-secret-turnstile-value is wrong')).toBe(
      'upstream said: [redacted:CF_TURNSTILE_SECRET_KEY] is wrong',
    );
  });
});
