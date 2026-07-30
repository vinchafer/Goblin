import { describe, it, expect } from 'vitest';
import { normalizeOrigin, describeOriginProblem, headerSafe } from './origin';

const PROD = 'https://goblinapi-production.up.railway.app';
const DEV = 'http://localhost:3001';

describe('normalizeOrigin', () => {
  it('passes a clean origin through untouched', () => {
    const r = normalizeOrigin(PROD, DEV);
    expect(r).toEqual({ origin: PROD, ok: true, usedFallback: false });
  });

  it('strips a trailing slash', () => {
    expect(normalizeOrigin(`${PROD}/`, DEV).origin).toBe(PROD);
  });

  it('strips the documented trailing /api footgun', () => {
    expect(normalizeOrigin(`${PROD}/api`, DEV).origin).toBe(PROD);
    expect(normalizeOrigin(`${PROD}/api/`, DEV).origin).toBe(PROD);
  });

  it('survives the paste artefacts a dashboard field collects', () => {
    for (const raw of [` ${PROD} `, `${PROD}\n`, `\n${PROD}\n`, `"${PROD}"`, `'${PROD}'`, `${PROD}\r\n`]) {
      const r = normalizeOrigin(raw, DEV);
      expect(r.ok, JSON.stringify(raw)).toBe(true);
      expect(r.origin).toBe(PROD);
    }
  });

  // The 2026-07-30 outage, pinned. This exact value was live on Vercel.
  it('refuses the pasted Supabase hook URL and falls back', () => {
    const r = normalizeOrigin(`${PROD}/api/auth/email-hook\n`, DEV);
    expect(r.ok).toBe(false);
    expect(r.problem).toBe('not-an-origin');
    expect(r.origin).toBe(DEV);
    expect(r.usedFallback).toBe(true);
  });

  it('reports each way a value can be unusable', () => {
    expect(normalizeOrigin(undefined, DEV).problem).toBe('missing');
    expect(normalizeOrigin(null, DEV).problem).toBe('missing');
    expect(normalizeOrigin('   ', DEV).problem).toBe('missing');
    expect(normalizeOrigin('not a url', DEV).problem).toBe('not-a-url');
    expect(normalizeOrigin('www.justgoblin.com', DEV).problem).toBe('not-a-url');
    expect(normalizeOrigin('ftp://host.example', DEV).problem).toBe('unsupported-protocol');
    expect(normalizeOrigin(`${PROD}/v2`, DEV).problem).toBe('not-an-origin');
    expect(normalizeOrigin(`${PROD}?x=1`, DEV).problem).toBe('not-an-origin');
    expect(normalizeOrigin(`${PROD}#f`, DEV).problem).toBe('not-an-origin');
    // A control character *inside* the value, not merely trailing.
    expect(normalizeOrigin('https://host\u0000.example', DEV).problem).toBe('control-characters');
  });

  it('never throws and never returns something unusable, whatever it is handed', () => {
    const nasty = [
      undefined, null, '', '\t', '\n', '\u0000', 'https://', '://x', 'https://a b.example',
      `${PROD}
X-Injected: 1`, 'javascript:alert(1)', 'data:text/html,x',
      'HTTPS://HOST.EXAMPLE', '//host.example', 'https://user:pw@host.example',
    ];
    for (const raw of nasty) {
      const r = normalizeOrigin(raw as string | undefined, PROD);
      expect(typeof r.origin, JSON.stringify(raw)).toBe('string');
      expect(r.origin.length).toBeGreaterThan(0);
      // The one invariant everything else exists to protect.
      expect(/[\u0000-\u001F\u007F]/.test(r.origin), JSON.stringify(raw)).toBe(false);
      expect(r.origin.startsWith('http://') || r.origin.startsWith('https://')).toBe(true);
    }
  });

  it('does not let a header-injection attempt survive', () => {
    const r = normalizeOrigin(`${PROD}\r\nX-Injected: 1`, DEV);
    expect(r.ok).toBe(false);
    expect(r.origin).toBe(DEV);
  });
});

describe('describeOriginProblem', () => {
  it('explains every problem without ever quoting the value', () => {
    const secretish = 'https://host.example/leak-me';
    for (const p of ['missing', 'control-characters', 'not-a-url', 'unsupported-protocol', 'not-an-origin'] as const) {
      const msg = describeOriginProblem('NEXT_PUBLIC_API_URL', p);
      expect(msg).toContain('NEXT_PUBLIC_API_URL');
      expect(msg).not.toContain(secretish);
      expect(msg.length).toBeGreaterThan(10);
    }
  });
});

describe('headerSafe', () => {
  it('removes every character Node would refuse to write', () => {
    const dirty = "connect-src 'self' https://host.example/x\n https://other.example\r\u0000";
    expect(/[\u0000-\u001F\u007F]/.test(headerSafe(dirty))).toBe(false);
  });

  it('leaves a clean header untouched', () => {
    const clean = "default-src 'self'; connect-src 'self' https://host.example";
    expect(headerSafe(clean)).toBe(clean);
  });
});
