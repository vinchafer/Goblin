/**
 * AKT 2 · PHASE 4 · U4.3 — the ingest ROUTE.
 *
 * The decision is tested next door (services/ops-forms.test.ts). What is tested
 * here is the part a visitor's browser actually meets:
 *
 *   • the CORS answer is ONE exact origin, never `*`, and never another app's
 *   • every refusal carries a German sentence in the app's language, and never a
 *     status code left to speak for itself, a rule id, or an internal
 *   • the body is refused by its MEASURED size before anything parses it
 *   • no submission content comes back in any response
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const ingestSubmission = vi.fn();

vi.mock('../services/ops-forms', async () => ({
  ...(await vi.importActual<typeof import('../services/ops-forms')>('../services/ops-forms')),
  ingestSubmission: (...a: unknown[]) => ingestSubmission(...a),
}));

vi.mock('../services/cf-deploy', () => ({ opsAppsDomain: () => 'justgoblin.app' }));

const { opsForms } = await import('./ops-forms');

const ORIGIN = 'https://meinladen.justgoblin.app';

const post = (body: unknown, headers: Record<string, string> = {}) =>
  opsForms.request('/meinladen/kontakt', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  ingestSubmission.mockResolvedValue({ ok: true, submissionId: 's1', app: {}, formId: 'kontakt', fields: {}, acceptedThisMonth: 1, monthlyCap: 500 });
});

describe('CORS', () => {
  it('answers the preflight with the app’s OWN origin, exactly', async () => {
    const res = await opsForms.request('/meinladen/kontakt', { method: 'OPTIONS', headers: { origin: ORIGIN } });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(res.headers.get('access-control-allow-origin')).not.toBe('*');
    expect(res.headers.get('vary')).toBe('Origin');
  });

  it('refuses a preflight from an origin that is not on the apps domain', async () => {
    const res = await opsForms.request('/meinladen/kontakt', { method: 'OPTIONS', headers: { origin: 'https://boese.example' } });
    expect(res.status).toBe(403);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('refuses http and multi-level labels — neither is a Living App', async () => {
    for (const origin of ['http://meinladen.justgoblin.app', 'https://a.b.justgoblin.app', 'https://justgoblin.app']) {
      const res = await opsForms.request('/meinladen/kontakt', { method: 'OPTIONS', headers: { origin } });
      expect(res.status).toBe(403);
    }
  });

  it('never sends credentials — this endpoint has no session and must not look like it does', async () => {
    const res = await opsForms.request('/meinladen/kontakt', { method: 'OPTIONS', headers: { origin: ORIGIN } });
    expect(res.headers.get('access-control-allow-credentials')).toBeNull();
  });
});

describe('the sentences a visitor gets', () => {
  it('says thank you — in German by default', async () => {
    const res = await post({ name: 'Anna' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; message: string };
    expect(body.ok).toBe(true);
    expect(body.message).toBe('Danke — deine Nachricht ist angekommen.');
  });

  it('answers in English when the browser asks for English first', async () => {
    const res = await post({ name: 'Anna' }, { 'accept-language': 'en-GB,en;q=0.9' });
    expect(((await res.json()) as { message: string }).message).toBe('Thank you — your message has arrived.');
  });

  it('a browser that lists de before en still gets German', async () => {
    const res = await post({ name: 'Anna' }, { 'accept-language': 'de-CH,de;q=0.9,en;q=0.5' });
    expect(((await res.json()) as { message: string }).message).toMatch(/^Danke/);
  });

  it('OVER THE CAP: says the message did NOT arrive, and that the owner was told', async () => {
    ingestSubmission.mockResolvedValue({ ok: false, code: 'over_cap', status: 429, app: { appId: 'app-1' } });
    const res = await post({ name: 'Anna' });
    expect(res.status).toBe(429);
    const body = (await res.json()) as { ok: boolean; code: string; message: string };
    expect(body.ok).toBe(false);
    expect(body.code).toBe('over_cap');
    expect(body.message).toContain('NICHT angekommen');
    expect(body.message).toContain('informiert');
  });

  it('a missing Turnstile secret tells the visitor it is not their fault, and that nothing arrived', async () => {
    ingestSubmission.mockResolvedValue({ ok: false, code: 'not_configured', status: 503 });
    const body = (await (await post({ name: 'Anna' })).json()) as { message: string };
    expect(body.message).toContain('nicht an dir');
    expect(body.message).toContain('NICHT angekommen');
  });

  it('every refusal has a sentence — no code is left to speak for itself', async () => {
    const { FORM_MESSAGES } = await import('./ops-forms');
    for (const [code, texts] of Object.entries(FORM_MESSAGES)) {
      expect(texts.de.length).toBeGreaterThan(20);
      expect(texts.en.length).toBeGreaterThan(20);
      // No internals in anything a visitor reads.
      for (const text of [texts.de, texts.en]) {
        expect(text).not.toMatch(/D1|Turnstile|Cloudflare|SQL|500|null|undefined/);
      }
      expect(code).toBeTruthy();
    }
  });
});

describe('the body', () => {
  it('is refused by its MEASURED size before anything parses it', async () => {
    const res = await post({ nachricht: 'x'.repeat(20 * 1024) });
    expect(res.status).toBe(413);
    expect(ingestSubmission).not.toHaveBeenCalled();
  });

  it('a body that is not an object is a shape refusal, not a crash', async () => {
    for (const raw of ['[]', '"hallo"', 'nicht-json', 'null']) {
      const res = await post(raw);
      expect(res.status).toBe(400);
    }
  });

  it('the Turnstile token is read from the body and passed on as a token, not as a field', async () => {
    await post({ name: 'Anna', 'cf-turnstile-response': 'tok-123' });
    expect(ingestSubmission).toHaveBeenCalledWith(expect.objectContaining({ token: 'tok-123' }));
  });

  it('the source key handed to the limiter is a hash — the address is not in it', async () => {
    await post({ name: 'Anna' }, { 'cf-connecting-ip': '203.0.113.9' });
    const arg = ingestSubmission.mock.calls[0]?.[0] as { rateKey: string };
    expect(arg.rateKey).toMatch(/^[0-9a-f]{32}$/);
    expect(arg.rateKey).not.toContain('203.0.113');
  });
});

describe('no submission content comes back out', () => {
  it('not on success and not on any refusal', async () => {
    const secret = 'anna.mueller@example.com';
    for (const outcome of [
      { ok: true, submissionId: 's1', app: {}, formId: 'kontakt', fields: { email: secret }, acceptedThisMonth: 1, monthlyCap: 500 },
      { ok: false, code: 'storage_failed', status: 503 },
      { ok: false, code: 'challenge_failed', status: 403 },
    ]) {
      ingestSubmission.mockResolvedValue(outcome);
      const text = await (await post({ email: secret })).text();
      expect(text).not.toContain(secret);
    }
  });
});
