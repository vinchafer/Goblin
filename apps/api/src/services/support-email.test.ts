// F-38 (FIX-WAVE 2) GATE: the escalation-mail construction + error-logging path.
// A malformed `from` or an empty recipient is a classic Resend 422 that today
// drops silently — these tests pin the address construction (incl. the
// display-name form) and prove the failure path logs the full Resend error.

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

// ── error-logging path: a mocked 4xx must be logged in full, not swallowed ──
const sendMock = vi.fn();
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendMock } })),
}));

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

describe('sendSupportEscalation error logging', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    sendMock.mockReset();
    logErrorMock.mockReset();
    process.env = { ...OLD_ENV, RESEND_API_KEY: 'test-key', SUPPORT_EMAIL_TO: 'founder@justgoblin.com' };
  });
  afterEach(() => { process.env = OLD_ENV; });

  it('logs the full Resend error (name + statusCode + message) on a 4xx', async () => {
    sendMock.mockResolvedValue({
      error: { name: 'validation_error', statusCode: 422, message: 'The from address is not verified' },
      data: null,
    });
    const { sendSupportEscalation } = await import('./support-email');
    const res = await sendSupportEscalation({ ...baseTicket, userId: `u-${Date.now()}-a` });
    expect(res.ok).toBe(false);
    expect(logErrorMock).toHaveBeenCalled();
    const lastCall = logErrorMock.mock.calls[logErrorMock.mock.calls.length - 1] as unknown[];
    const meta = lastCall[0] as Record<string, unknown>;
    expect(meta).toMatchObject({ statusCode: 422, errorName: 'validation_error' });
    expect(meta.resendError as string).toContain('not verified');
  });

  it('logs missing-config when the recipient env is empty', async () => {
    process.env = { ...OLD_ENV, RESEND_API_KEY: 'test-key' };
    delete process.env.SUPPORT_EMAIL_TO;
    delete process.env.FOUNDER_DIGEST_EMAIL;
    delete process.env.ADMIN_EMAIL;
    const { sendSupportEscalation } = await import('./support-email');
    const res = await sendSupportEscalation({ ...baseTicket, userId: `u-${Date.now()}-b` });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('missing_config');
    expect(logErrorMock).toHaveBeenCalled();
  });
});
