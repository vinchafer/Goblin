import { Resend } from 'resend';
import logger from './logger';

const FROM_DEFAULT = process.env.RESEND_FROM ?? 'Goblin <noreply@justgoblin.com>';

let _resend: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

/**
 * Sends an email via Resend. Best-effort: returns ok=false on failure
 * but never throws — callers should not block critical flows on email.
 */
export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    logger.warn({ to: input.to, subject: input.subject }, 'email skipped — RESEND_API_KEY not set');
    return { ok: false, error: 'resend_not_configured' };
  }

  try {
    const result = await resend.emails.send({
      from: input.from ?? FROM_DEFAULT,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    });
    if (result.error) {
      // Log the FULL Resend error (name + statusCode + message) — a 422 from an
      // empty/invalid field or an unverified domain is otherwise a silent drop.
      const e = result.error as { name?: string; statusCode?: number; message?: string };
      logger.warn(
        { to: input.to, from: input.from ?? FROM_DEFAULT, errorName: e.name, statusCode: e.statusCode, error: e.message },
        'email send failed',
      );
      return { ok: false, error: result.error.message };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ to: input.to, error: msg }, 'email send threw');
    return { ok: false, error: msg };
  }
}
