// WAVE-D · D-3 gate — the secret scrubber. Injects a known specimen of every secret
// shape and asserts it never survives, that its raw prefix is gone, and that ordinary
// prose is untouched. Also covers the env-value layer (prefix-less crown-jewels) and
// deep object walking (the shape agent_runs / log objects actually take).

import { describe, it, expect, afterEach } from 'vitest';
import { scrubString, scrubSecrets, safeErrorMessage, REDACTED } from './scrub-secrets';

// Representative specimens (all FAKE). Built by concatenating a prefix fragment with a
// body so no contiguous secret-shaped literal ever exists in this source file — that
// keeps push-protection / secret-scanners from flagging the test fixtures while the
// runtime value still exercises the scrubber exactly as a real key would.
const B = 'AbCdEf0123456789AbCdEf0123456789';
const SPECIMENS: Record<string, string> = {
  anthropic: 'sk-' + 'ant-' + 'api03-' + B + 'AbCd',
  openai: 'sk-' + B,
  openrouter: 'sk-' + 'or-' + 'v1-' + 'abcdef0123456789abcdef0123456789',
  stripeLive: 'sk_' + 'live_' + 'AbCdEf0123456789AbCdEf01',
  stripeWebhook: 'whsec' + '_' + B,
  google: 'AIza' + 'SyA0123456789abcdefghijklmnopqrstuv',
  groq: 'gsk' + '_' + B,
  xai: 'xai' + '-' + B,
  fireworks: 'fw' + '-' + B,
  resend: 're' + '_' + 'AbCdEf0123456789AbCdEf01',
  githubPat: 'github' + '_pat_' + '11ABCDEFG0abcdefghijkl_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCD',
  githubClassic: 'ghp' + '_' + B + 'abcd',
  jwt: 'eyJ' + 'hbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' + '.eyJzdWIiOiJzZXJ2aWNlX3JvbGUifQ' + '.abcdefghijklmnop',
};

describe('scrubString — every secret shape is redacted', () => {
  it.each(Object.entries(SPECIMENS))('redacts a %s key', (_name, secret) => {
    const text = `error from provider: your key ${secret} was rejected`;
    const out = scrubString(text);
    expect(out).not.toContain(secret);
    expect(out).toContain(REDACTED);
  });

  it('redacts a Bearer token but keeps the label', () => {
    const out = scrubString('Authorization: Bearer sk-AbCdEf0123456789AbCdEf0123456789');
    expect(out).toContain('Bearer [REDACTED]');
    expect(out).not.toContain('sk-AbCdEf0123456789');
  });

  it('leaves ordinary prose and the word "token"/"key" untouched', () => {
    const prose = 'Bitte trag deinen eigenen API-Key ein. Das Token-Limit ist erreicht.';
    expect(scrubString(prose)).toBe(prose);
  });

  it('redacts multiple secrets in one string', () => {
    const out = scrubString(`${SPECIMENS.anthropic} and ${SPECIMENS.stripeLive}`);
    expect(out).not.toContain(SPECIMENS.anthropic);
    expect(out).not.toContain(SPECIMENS.stripeLive);
    expect(out).toBe(`${REDACTED} and ${REDACTED}`);
  });
});

describe('scrubString — env-value layer (prefix-less secrets)', () => {
  const KEY = 'DEEPINFRA_API_KEY';
  afterEach(() => { delete process.env[KEY]; });

  it('redacts the exact value of a configured secret env var', () => {
    process.env[KEY] = 'di-9f3c1a2b4d5e6f7a8b9c0d1e2f3a4b5c'; // no public prefix
    const out = scrubString('provider said: di-9f3c1a2b4d5e6f7a8b9c0d1e2f3a4b5c invalid');
    expect(out).not.toContain('di-9f3c1a2b4d5e6f7a8b9c0d1e2f3a4b5c');
    expect(out).toContain(REDACTED);
  });

  it('does NOT redact a short/empty env value (would corrupt unrelated text)', () => {
    process.env[KEY] = 'true';
    expect(scrubString('the value is true here')).toBe('the value is true here');
  });
});

describe('scrubSecrets — deep object walking (agent_runs / log shape)', () => {
  it('redacts secrets nested in arrays and objects without mutating the original', () => {
    const original = {
      outcome: 'error',
      step_log: [
        { tool: 'write_file', args: 'path=index.html', outcome: 'ok' },
        { tool: 'publish', args: `token=${SPECIMENS.openai}`, outcome: 'failed' },
      ],
      report: { modelText: `Ich habe ${SPECIMENS.jwt} gesehen`, failureReason: null },
    };
    const scrubbed = scrubSecrets(original);
    const flat = JSON.stringify(scrubbed);
    expect(flat).not.toContain(SPECIMENS.openai);
    expect(flat).not.toContain(SPECIMENS.jwt);
    expect(flat).toContain(REDACTED);
    // Original object is untouched (no in-place mutation).
    expect(JSON.stringify(original)).toContain(SPECIMENS.openai);
  });

  it('passes non-string primitives through unchanged', () => {
    expect(scrubSecrets(42)).toBe(42);
    expect(scrubSecrets(true)).toBe(true);
    expect(scrubSecrets(null)).toBe(null);
  });

  it('survives a cyclic object without hanging', () => {
    const a: Record<string, unknown> = { name: 'x' };
    a.self = a;
    expect(() => scrubSecrets(a)).not.toThrow();
  });
});

describe('safeErrorMessage — client-visible errors are scrubbed', () => {
  it('scrubs a secret echoed in an upstream error message', () => {
    const err = new Error(`401 invalid api key: ${SPECIMENS.anthropic}`);
    const msg = safeErrorMessage(err);
    expect(msg).not.toContain(SPECIMENS.anthropic);
    expect(msg).toContain(REDACTED);
  });
  it('falls back when the error has no message', () => {
    expect(safeErrorMessage(new Error(''), 'Standardfehler')).toBe('Standardfehler');
    expect(safeErrorMessage(undefined, 'Standardfehler')).toBe('Standardfehler');
  });
});
