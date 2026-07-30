// U4 GATE — the auth chain, as far as it can be closed without the founder's
// devices and without sending real mail.
//
// The U3 gate (auth-email-hook.test.ts) pinned signature verification and the
// link contract. This file closes the rest of the loop:
//   1. Every mail type Goblin can send goes end-to-end through the hook and
//      renders from the REAL templates (only the Resend dispatch is mocked).
//   2. Missing RESEND_API_KEY must produce an ERROR, never a fake success.
//   3. `redirect_to` handling across the apex/www pair, which is what Supabase
//      actually sends.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';

interface SentEmail { to: string; subject: string; html: string }
const sendEmail = vi.fn(async (_input: SentEmail) => ({ ok: true } as { ok: boolean; error?: string }));
vi.mock('../lib/email', () => ({ sendEmail: (input: SentEmail) => sendEmail(input) }));
vi.mock('../lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { authEmailHook, nextPathFrom } from './auth-email-hook';
import { renderAuthEmail, buildConfirmUrl, type AuthEmailType } from '../lib/auth-email-templates';

const SECRET_B64 = Buffer.from('goblin-test-hook-secret-value').toString('base64');
const SECRET = `v1,whsec_${SECRET_B64}`;

function hookRequest(body: unknown) {
  const raw = JSON.stringify(body);
  const id = 'msg_chain_1';
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = `v1,${createHmac('sha256', Buffer.from(SECRET_B64, 'base64'))
    .update(`${id}.${ts}.${raw}`)
    .digest('base64')}`;
  return new Request('http://localhost/', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'webhook-id': id,
      'webhook-timestamp': ts,
      'webhook-signature': sig,
    },
    body: raw,
  });
}

/** Every action Supabase can hand us, and the template it must resolve to. */
const ACTIONS: Array<{ action: string; type: AuthEmailType; deMarker: string; enMarker: string }> = [
  { action: 'recovery', type: 'recovery', deMarker: 'Neues Passwort setzen', enMarker: 'Set a new password' },
  { action: 'signup', type: 'signup', deMarker: 'E-Mail-Adresse', enMarker: 'email address' },
  { action: 'invite', type: 'invite', deMarker: 'eingeladen', enMarker: 'invited' },
  { action: 'magiclink', type: 'magiclink', deMarker: 'Anmeldelink', enMarker: 'sign-in link' },
  { action: 'email_change', type: 'email_change', deMarker: 'Adresse', enMarker: 'address' },
  { action: 'email_change_current', type: 'email_change', deMarker: 'Adresse', enMarker: 'address' },
];

describe('U4 · every mail type survives the whole hook', () => {
  beforeEach(() => {
    process.env.SUPABASE_AUTH_HOOK_SECRET = SECRET;
    process.env.NEXT_PUBLIC_APP_URL = 'https://www.justgoblin.com';
    sendEmail.mockClear();
    sendEmail.mockResolvedValue({ ok: true });
  });
  afterEach(() => {
    delete process.env.SUPABASE_AUTH_HOOK_SECRET;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  for (const { action, type, deMarker, enMarker } of ACTIONS) {
    it(`${action} → a bilingual mail whose only link is the interstitial`, async () => {
      const res = await authEmailHook.request(
        hookRequest({
          user: { email: 'vinc.hafner3@gmail.com' },
          email_data: { token_hash: `hash_${action}`, email_action_type: action },
        }),
      );

      expect(res.status).toBe(200);
      expect(sendEmail).toHaveBeenCalledTimes(1);
      const sent = sendEmail.mock.calls[0]![0];

      expect(sent.to).toBe('vinc.hafner3@gmail.com');
      // Both languages in one message — that is the template contract.
      expect(sent.subject).toContain('·');
      expect(sent.html).toContain(deMarker);
      expect(sent.html).toContain(enMarker);

      // The link contract: our interstitial with a token_hash, and NOTHING that
      // redeems on GET. A `?code=` link is the defect the whole chain replaced.
      const expected = buildConfirmUrl({
        origin: 'https://www.justgoblin.com',
        tokenHash: `hash_${action}`,
        type,
      });
      expect(sent.html).toContain(expected.replace(/&/g, '&amp;'));
      expect(sent.html).not.toMatch(/[?&]code=/);
      expect(sent.html).not.toContain('/auth/v1/verify');
    });
  }

  it('email_change_new is addressed to the NEW mailbox with its own token', async () => {
    const res = await authEmailHook.request(
      hookRequest({
        user: { email: 'old@example.com', new_email: 'vinc.hafner4@gmail.com' },
        email_data: {
          token_hash: 'hash_old_half',
          token_hash_new: 'hash_new_half',
          email_action_type: 'email_change_new',
        },
      }),
    );
    expect(res.status).toBe(200);
    const sent = sendEmail.mock.calls[0]![0];
    expect(sent.to).toBe('vinc.hafner4@gmail.com');
    expect(sent.html).toContain('hash_new_half');
    expect(sent.html).not.toContain('hash_old_half');
  });
});

describe('U4 · honest failure when the mail cannot be sent', () => {
  beforeEach(() => {
    process.env.SUPABASE_AUTH_HOOK_SECRET = SECRET;
    sendEmail.mockClear();
  });
  afterEach(() => { delete process.env.SUPABASE_AUTH_HOOK_SECRET; });

  it('RESEND_API_KEY missing → 500 to Supabase, so the USER sees an error', async () => {
    // What lib/email.ts really returns with no key configured.
    sendEmail.mockResolvedValue({ ok: false, error: 'resend_not_configured' });

    const res = await authEmailHook.request(
      hookRequest({
        user: { email: 'vinc.hafner3@gmail.com' },
        email_data: { token_hash: 'h', email_action_type: 'recovery' },
      }),
    );

    expect(res.status).toBe(500);
    // Never 200. A 200 would tell Supabase the mail went out and leave the user
    // waiting for a message that was never sent.
    expect(res.status).not.toBe(200);
  });

  it('the real sendEmail refuses rather than pretending, with no key set', async () => {
    const previous = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
    try {
      const { sendEmail: realSendEmail } = await vi.importActual<typeof import('../lib/email')>('../lib/email');
      const result = await realSendEmail({ to: 'x@example.com', subject: 's', html: '<p>h</p>' });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('resend_not_configured');
    } finally {
      if (previous !== undefined) process.env.RESEND_API_KEY = previous;
    }
  });
});

describe('U4 · redirect_to across the apex/www pair', () => {
  const ORIGIN = 'https://www.justgoblin.com';

  it('keeps a path Supabase built from the APEX Site URL', () => {
    // This is the real shape: NEXT_PUBLIC_APP_URL is the www host, Supabase's
    // Site URL is the apex. A strict origin match dropped every `next`.
    expect(nextPathFrom('https://justgoblin.com/auth/reset-password', ORIGIN))
      .toBe('/auth/reset-password');
  });

  it('keeps a path on the www host itself', () => {
    expect(nextPathFrom('https://www.justgoblin.com/dashboard?x=1', ORIGIN))
      .toBe('/dashboard?x=1');
  });

  it('still drops a foreign origin', () => {
    expect(nextPathFrom('https://evil.example.com/steal', ORIGIN)).toBeUndefined();
  });

  it('still drops a look-alike domain', () => {
    expect(nextPathFrom('https://justgoblin.com.evil.example/x', ORIGIN)).toBeUndefined();
  });

  it('still drops a protocol downgrade', () => {
    expect(nextPathFrom('http://justgoblin.com/x', ORIGIN)).toBeUndefined();
  });

  it('carries the surviving path into the confirm link', () => {
    const url = buildConfirmUrl({
      origin: ORIGIN,
      tokenHash: 'h',
      type: 'signup',
      next: nextPathFrom('https://justgoblin.com/onboarding', ORIGIN),
    });
    expect(url).toContain('next=%2Fonboarding');
  });
});

describe('U4 · templates state nothing they cannot know', () => {
  const TYPES: AuthEmailType[] = ['recovery', 'signup', 'email_change', 'magiclink', 'invite'];

  for (const type of TYPES) {
    it(`${type} invents no validity duration and carries no tracking`, () => {
      const { html, subject } = renderAuthEmail(type, {
        email: 'vinc.hafner3@gmail.com',
        actionUrl: buildConfirmUrl({ origin: 'https://www.justgoblin.com', tokenHash: 'h', type }),
      });

      // The hook payload carries no expiry, so any concrete duration would be
      // an invented time claim.
      expect(html).not.toMatch(/\b\d+\s*(Minuten|Stunden|minutes|hours)\b/i);
      // No open/click beacon, no redirect wrapper.
      expect(html).not.toMatch(/<img[^>]+(track|beacon|pixel|open)/i);
      // Bilingual subject, and the plain-URL fallback for a dead button.
      expect(subject).toContain('·');
      expect(html).toContain('/auth/confirm?token_hash=h');
    });
  }
});
