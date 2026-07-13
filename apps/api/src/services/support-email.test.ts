// F-38 (FIX-WAVE 2) GATE: the escalation-mail construction + send delegation.
// Pins the address construction (incl. the display-name form + quote-stripping)
// and the send path: it delegates to the hardened lib/email.ts and GUARDS the
// reply-to (an empty/invalid `replyTo` is a classic Resend 422 — the J2
// regression vs. the founder-digest path, which the founder confirms works).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveFromAddress, resolveToAddress } from './support-email';

describe('resolveFromAddress', () => {
  it('defaults to the verified-domain display-name form', () => {
    expect(resolveFromAddress({})).toBe('Goblin Support <support@justgoblin.com>');
  });

  it('accepts the display-name form verbatim', () => {
    expect(resolveFromAddress({ SUPPORT_EMAIL_FROM: 'Goblin Support <support@justgoblin.com>' }))
      .toBe('Goblin Support <support@justgoblin.com>');
  });

  it('accepts a bare address', () => {
    expect(resolveFromAddress({ SUPPORT_EMAIL_FROM: 'support@justgoblin.com' }))
      .toBe('support@justgoblin.com');
  });

  it('strips wrapping double-quotes left by env misconfig (Railway trap)', () => {
    expect(resolveFromAddress({ SUPPORT_EMAIL_FROM: '"Goblin Support <support@justgoblin.com>"' }))
      .toBe('Goblin Support <support@justgoblin.com>');
  });

  it('strips wrapping single-quotes', () => {
    expect(resolveFromAddress({ SUPPORT_EMAIL_FROM: "'support@justgoblin.com'" }))
      .toBe('support@justgoblin.com');
  });

  it('falls back to RESEND_FROM before the default', () => {
    expect(resolveFromAddress({ RESEND_FROM: 'Goblin <noreply@justgoblin.com>' }))
      .toBe('Goblin <noreply@justgoblin.com>');
  });
});

describe('resolveToAddress', () => {
  it('returns null when no recipient env is set (avoids a silent 422)', () => {
    expect(resolveToAddress({})).toBeNull();
  });

  it('prefers SUPPORT_EMAIL_TO', () => {
    expect(resolveToAddress({
      SUPPORT_EMAIL_TO: 'founder@justgoblin.com',
      ADMIN_EMAIL: 'other@justgoblin.com',
    })).toBe('founder@justgoblin.com');
  });

  it('falls back through FOUNDER_DIGEST_EMAIL then ADMIN_EMAIL', () => {
    expect(resolveToAddress({ FOUNDER_DIGEST_EMAIL: 'f@x.com' })).toBe('f@x.com');
    expect(resolveToAddress({ ADMIN_EMAIL: 'a@x.com' })).toBe('a@x.com');
  });

  it('strips wrapping quotes on the recipient too', () => {
    expect(resolveToAddress({ SUPPORT_EMAIL_TO: '"a@x.com"' })).toBe('a@x.com');
  });
});

// ── send path: delegates to the hardened lib/email.ts, guards the reply-to ──
// The J2 regression was a PARALLEL Resend client that always set
// `replyTo: ticket.userEmail`; the support route defaults that to '' and Resend
// 422s on an empty reply-to (the digest path, lib/email.ts, guards it). These
// probes lock the delegation + the guard.
const sendEmailMock = vi.fn();
vi.mock('../lib/email', () => ({ sendEmail: (...a: unknown[]) => sendEmailMock(...a) }));

const logErrorMock = vi.fn();
vi.mock('../lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: (...a: unknown[]) => logErrorMock(...a) },
}));

const baseTicket = {
  ticketId: 't-1',
  userId: 'u-1',
  userEmail: 'user@example.com',
  plan: 'free',
  history: [{ role: 'user' as const, content: 'help' }],
  escalationReason: 'stuck',
  timestamp: '2026-07-13T00:00:00.000Z',
};

describe('sendSupportEscalation send path', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    sendEmailMock.mockReset().mockResolvedValue({ ok: true });
    logErrorMock.mockReset();
    process.env = { ...OLD_ENV, RESEND_API_KEY: 'test-key', SUPPORT_EMAIL_TO: 'founder@justgoblin.com' };
  });
  afterEach(() => { process.env = OLD_ENV; });

  it('delegates to the hardened sendEmail with resolved from/to', async () => {
    const { sendSupportEscalation } = await import('./support-email');
    const res = await sendSupportEscalation({ ...baseTicket, userId: `u-${Date.now()}-ok` });
    expect(res.ok).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const arg = (sendEmailMock.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;
    expect(arg.to).toBe('founder@justgoblin.com');
    expect(arg.from).toBe('Goblin Support <support@justgoblin.com>');
    expect(typeof arg.html).toBe('string');
  });

  it('passes a VALID reply-to through', async () => {
    const { sendSupportEscalation } = await import('./support-email');
    await sendSupportEscalation({ ...baseTicket, userId: `u-${Date.now()}-r`, userEmail: 'real@user.com' });
    const arg = (sendEmailMock.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;
    expect(arg.replyTo).toBe('real@user.com');
  });

  it('OMITS the reply-to when the user email is empty (the 422 regression)', async () => {
    const { sendSupportEscalation } = await import('./support-email');
    await sendSupportEscalation({ ...baseTicket, userId: `u-${Date.now()}-e`, userEmail: '' });
    const arg = (sendEmailMock.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;
    expect('replyTo' in arg).toBe(false);
  });

  it('OMITS the reply-to when the user email is malformed', async () => {
    const { sendSupportEscalation } = await import('./support-email');
    await sendSupportEscalation({ ...baseTicket, userId: `u-${Date.now()}-m`, userEmail: 'not-an-email' });
    const arg = (sendEmailMock.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;
    expect('replyTo' in arg).toBe(false);
  });

  it('logs and returns not-ok when sendEmail rejects (e.g. Resend 422)', async () => {
    sendEmailMock.mockResolvedValue({ ok: false, error: 'validation_error: reply_to is invalid' });
    const { sendSupportEscalation } = await import('./support-email');
    const res = await sendSupportEscalation({ ...baseTicket, userId: `u-${Date.now()}-f` });
    expect(res.ok).toBe(false);
    expect(logErrorMock).toHaveBeenCalled();
  });

  it('returns missing_config (and never calls sendEmail) when the recipient env is empty', async () => {
    process.env = { ...OLD_ENV, RESEND_API_KEY: 'test-key' };
    delete process.env.SUPPORT_EMAIL_TO;
    delete process.env.FOUNDER_DIGEST_EMAIL;
    delete process.env.ADMIN_EMAIL;
    const { sendSupportEscalation } = await import('./support-email');
    const res = await sendSupportEscalation({ ...baseTicket, userId: `u-${Date.now()}-c` });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('missing_config');
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
