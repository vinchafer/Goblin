// U3 GATE — the Supabase Send-Email auth hook.
//
// Pins the three things that decide whether auth mail works at all:
//   1. Signature verification (a forged or replayed call must never send mail).
//   2. The link format — token_hash on OUR interstitial, never a redeem-on-GET
//      URL. This is the U2 fix expressed as a testable property.
//   3. The delegation: real template rendering, mocked Resend send.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';

interface SentEmail { to: string; subject: string; html: string }
const sendEmail = vi.fn(async (_input: SentEmail) => ({ ok: true } as { ok: boolean; error?: string }));
vi.mock('../lib/email', () => ({ sendEmail: (input: SentEmail) => sendEmail(input) }));
vi.mock('../lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { authEmailHook, verifyHookSignature, mapActionType, nextPathFrom } from './auth-email-hook';
import { renderAuthEmail, buildConfirmUrl } from '../lib/auth-email-templates';

const SECRET_B64 = Buffer.from('goblin-test-hook-secret-value').toString('base64');
const SECRET = `v1,whsec_${SECRET_B64}`;

function sign(id: string, timestamp: string, body: string): string {
  const mac = createHmac('sha256', Buffer.from(SECRET_B64, 'base64'))
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64');
  return `v1,${mac}`;
}

function hookRequest(body: unknown, opts: { id?: string; ts?: string; sig?: string } = {}) {
  const raw = JSON.stringify(body);
  const id = opts.id ?? 'msg_test_1';
  const ts = opts.ts ?? String(Math.floor(Date.now() / 1000));
  return new Request('http://localhost/', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'webhook-id': id,
      'webhook-timestamp': ts,
      'webhook-signature': opts.sig ?? sign(id, ts, raw),
    },
    body: raw,
  });
}

const RECOVERY_PAYLOAD = {
  user: { email: 'vinc.hafner3@gmail.com' },
  email_data: {
    token_hash: 'pkce_abc123hash',
    email_action_type: 'recovery',
    redirect_to: 'https://justgoblin.com/auth/reset-password',
  },
};

describe('verifyHookSignature', () => {
  const base = { secret: SECRET, id: 'msg_1', timestamp: '1700000000', rawBody: '{"a":1}' };

  it('accepts a correctly signed payload', () => {
    const sig = sign(base.id, base.timestamp, base.rawBody);
    expect(verifyHookSignature({ ...base, signatureHeader: sig, nowSec: 1700000000 })).toEqual({ ok: true });
  });

  it('rejects a tampered body', () => {
    const sig = sign(base.id, base.timestamp, base.rawBody);
    const res = verifyHookSignature({ ...base, rawBody: '{"a":2}', signatureHeader: sig, nowSec: 1700000000 });
    expect(res).toEqual({ ok: false, reason: 'signature_mismatch' });
  });

  it('rejects a replay outside the timestamp tolerance', () => {
    const sig = sign(base.id, base.timestamp, base.rawBody);
    const res = verifyHookSignature({ ...base, signatureHeader: sig, nowSec: 1700000000 + 3600 });
    expect(res).toEqual({ ok: false, reason: 'timestamp_out_of_tolerance' });
  });

  it('accepts one valid signature among several (secret rotation)', () => {
    const good = sign(base.id, base.timestamp, base.rawBody);
    const res = verifyHookSignature({
      ...base,
      signatureHeader: `v1,ZmFrZXNpZ25hdHVyZQ== ${good}`,
      nowSec: 1700000000,
    });
    expect(res).toEqual({ ok: true });
  });
});

describe('mapActionType', () => {
  it('maps every action Goblin actually uses', () => {
    expect(mapActionType('recovery')).toBe('recovery');
    expect(mapActionType('signup')).toBe('signup');
    expect(mapActionType('magiclink')).toBe('magiclink');
    expect(mapActionType('email_change_new')).toBe('email_change');
    expect(mapActionType('email_change_current')).toBe('email_change');
  });

  it('returns null for an action we cannot render, so it is reported not dropped', () => {
    expect(mapActionType('reauthentication')).toBeNull();
  });
});

describe('nextPathFrom', () => {
  const origin = 'https://justgoblin.com';

  it('keeps a same-origin path', () => {
    expect(nextPathFrom('https://justgoblin.com/auth/reset-password', origin)).toBe('/auth/reset-password');
  });

  it('drops a foreign origin (open-redirect guard)', () => {
    expect(nextPathFrom('https://evil.example/steal', origin)).toBeUndefined();
  });

  it('drops a protocol-relative URL', () => {
    expect(nextPathFrom('//evil.example/steal', origin)).toBeUndefined();
  });
});

describe('buildConfirmUrl — the U2 link contract', () => {
  it('points at the interstitial with token_hash, never at a redeem-on-GET endpoint', () => {
    const url = new URL(buildConfirmUrl({
      origin: 'https://justgoblin.com',
      tokenHash: 'hash_xyz',
      type: 'recovery',
      next: '/auth/reset-password',
    }));
    expect(url.pathname).toBe('/auth/confirm');
    expect(url.searchParams.get('token_hash')).toBe('hash_xyz');
    expect(url.searchParams.get('type')).toBe('recovery');
    expect(url.searchParams.get('next')).toBe('/auth/reset-password');
    // No PKCE code — that is the cross-context failure we removed.
    expect(url.searchParams.get('code')).toBeNull();
  });

  it('refuses an absolute `next`', () => {
    const url = new URL(buildConfirmUrl({
      origin: 'https://justgoblin.com',
      tokenHash: 'h',
      type: 'signup',
      next: 'https://evil.example/x',
    }));
    expect(url.searchParams.get('next')).toBeNull();
  });
});

describe('renderAuthEmail', () => {
  it('carries both languages, the button, and the plain-URL fallback', () => {
    const { subject, html } = renderAuthEmail('recovery', {
      email: 'vinc.hafner3@gmail.com',
      actionUrl: 'https://justgoblin.com/auth/confirm?token_hash=h&type=recovery',
    });
    expect(subject).toBe('Passwort zurücksetzen · Reset your password');
    // German first, English below — the DE heading precedes the EN one.
    expect(html.indexOf('Neues Passwort setzen')).toBeLessThan(html.indexOf('Set a new password'));
    // Sender context naming the account, in both languages.
    expect(html).toContain('Du erhältst diese E-Mail, weil für dein Goblin-Konto');
    expect(html).toContain('You are receiving this email because a password reset was requested');
    // Fallback plain URL is present as visible text, not only as an href.
    expect(html).toContain('>https://justgoblin.com/auth/confirm?token_hash=h&amp;type=recovery</a>');
    // Footer: why received + imprint.
    expect(html).toContain('/imprint');
    // Honesty: no invented validity duration anywhere.
    expect(html).not.toMatch(/\b\d+\s*(Minuten|minutes|Stunden|hours)\b/);
    // No tracking pixel.
    expect(html).not.toMatch(/<img[^>]+(1x1|pixel|open\.gif|track)/i);
  });

  it('renders a signup confirmation with its own copy', () => {
    const { subject, html } = renderAuthEmail('signup', {
      email: 'a@b.de',
      actionUrl: 'https://justgoblin.com/auth/confirm?token_hash=h&type=signup',
    });
    expect(subject).toBe('Bestätige deine E-Mail-Adresse · Confirm your email address');
    expect(html).toContain('ein Goblin-Konto angelegt wurde');
    expect(html).toContain('a Goblin account was created with this address');
  });

  it('escapes the recipient address instead of interpolating markup', () => {
    const { html } = renderAuthEmail('recovery', {
      email: '"><script>alert(1)</script>@x.de',
      actionUrl: 'https://justgoblin.com/auth/confirm?token_hash=h&type=recovery',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('POST /api/auth/email-hook', () => {
  beforeEach(() => {
    sendEmail.mockClear();
    process.env.SUPABASE_AUTH_HOOK_SECRET = SECRET;
    process.env.NEXT_PUBLIC_APP_URL = 'https://justgoblin.com';
  });
  afterEach(() => {
    delete process.env.SUPABASE_AUTH_HOOK_SECRET;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it('sends a recovery mail whose link is the token_hash interstitial', async () => {
    const res = await authEmailHook.request(hookRequest(RECOVERY_PAYLOAD));
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const sent = sendEmail.mock.calls[0]![0];
    expect(sent.to).toBe('vinc.hafner3@gmail.com');
    expect(sent.subject).toContain('Passwort zurücksetzen');
    expect(sent.html).toContain('/auth/confirm?token_hash=pkce_abc123hash');
    expect(sent.html).toContain('type=recovery');
    expect(sent.html).toContain('next=%2Fauth%2Freset-password');
  });

  it('rejects an unsigned call without sending anything', async () => {
    const raw = JSON.stringify(RECOVERY_PAYLOAD);
    const res = await authEmailHook.request(new Request('http://localhost/', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: raw,
    }));
    expect(res.status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('rejects a forged signature without sending anything', async () => {
    const res = await authEmailHook.request(hookRequest(RECOVERY_PAYLOAD, { sig: 'v1,ZmFrZQ==' }));
    expect(res.status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('refuses everything while the hook secret is unset (no unverified mail)', async () => {
    delete process.env.SUPABASE_AUTH_HOOK_SECRET;
    const res = await authEmailHook.request(hookRequest(RECOVERY_PAYLOAD));
    expect(res.status).toBe(500);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('addresses the email_change_new half to the NEW mailbox with its own token', async () => {
    const res = await authEmailHook.request(hookRequest({
      user: { email: 'old@x.de', new_email: 'new@x.de' },
      email_data: {
        token_hash: 'old_half',
        token_hash_new: 'new_half',
        email_action_type: 'email_change_new',
        redirect_to: 'https://justgoblin.com/dashboard',
      },
    }));
    expect(res.status).toBe(200);
    const sent = sendEmail.mock.calls[0]![0];
    expect(sent.to).toBe('new@x.de');
    expect(sent.html).toContain('token_hash=new_half');
  });

  it('reports an unsupported action instead of silently dropping the mail', async () => {
    const res = await authEmailHook.request(hookRequest({
      user: { email: 'a@b.de' },
      email_data: { token_hash: 'h', email_action_type: 'reauthentication' },
    }));
    expect(res.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('surfaces a Resend failure as an error, never as a silent success', async () => {
    sendEmail.mockResolvedValueOnce({ ok: false, error: 'domain_not_verified' });
    const res = await authEmailHook.request(hookRequest(RECOVERY_PAYLOAD));
    expect(res.status).toBe(500);
  });

  it('does not answer GET — the interstitial, not the hook, is what a scanner could reach', async () => {
    const res = await authEmailHook.request(new Request('http://localhost/', { method: 'GET' }));
    expect(res.status).toBe(404);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
