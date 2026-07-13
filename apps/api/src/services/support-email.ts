import logger from '../lib/logger';
import { sendEmail } from '../lib/email';

/** A minimally-valid email for use as a Resend reply-to. An empty/garbage value
 *  passed as `replyTo` is a classic Resend 422 — so we omit it unless it passes. */
function validReplyTo(email: string | undefined | null): string | undefined {
  if (!email) return undefined;
  const e = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : undefined;
}

// ── Address construction (F-38) ─────────────────────────────────────────────
// A malformed `from` is a classic Resend 422. Two traps we defend against:
//   1. Env values pasted WITH surrounding quotes (Railway keeps the quotes as
//      part of the value), producing `"Goblin Support <support@…>"` — invalid.
//   2. A display-name form that Resend requires as `Name <email>`; a bare email
//      is fine too. We normalise both into a form Resend accepts.
const DEFAULT_FROM = 'Goblin Support <support@justgoblin.com>';

/** Strip a single layer of wrapping single/double quotes left by env misconfig. */
function unquote(v: string): string {
  const t = v.trim();
  if (t.length >= 2 && ((t[0] === '"' && t[t.length - 1] === '"') || (t[0] === "'" && t[t.length - 1] === "'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

/**
 * Resolve and normalise the sender address. Accepts a bare address
 * (`support@justgoblin.com`) or the display-name form (`Goblin Support
 * <support@justgoblin.com>`), tolerating stray wrapping quotes from env config.
 * Exported for unit tests — the F-38 gate asserts the display-name form.
 */
export function resolveFromAddress(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.SUPPORT_EMAIL_FROM ?? env.RESEND_FROM ?? DEFAULT_FROM;
  const cleaned = unquote(raw);
  return cleaned || DEFAULT_FROM;
}

/**
 * Resolve the recipient. A missing recipient env is a silent 422 waiting to
 * happen, so we return null and let the caller degrade honestly instead.
 * Exported for unit tests.
 */
export function resolveToAddress(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.SUPPORT_EMAIL_TO ?? env.FOUNDER_DIGEST_EMAIL ?? env.ADMIN_EMAIL;
  const cleaned = raw ? unquote(raw) : '';
  return cleaned || null;
}

/**
 * Startup diagnostic — logs whether Resend is configured WITHOUT ever printing
 * the key. Call once at boot so the founder can confirm from the logs that the
 * escalation path is armed. (F-38: "today we can't see why".)
 */
export function logResendStatus(env: NodeJS.ProcessEnv = process.env): void {
  const configured = Boolean(env.RESEND_API_KEY);
  const to = resolveToAddress(env);
  logger.info(
    {
      resend: configured ? 'configured' : 'NOT configured',
      supportRecipient: to ? 'set' : 'MISSING',
      supportFrom: resolveFromAddress(env),
    },
    `Resend: ${configured ? 'configured' : 'NOT configured'} — support escalation ${configured && to ? 'armed' : 'DISABLED'}`,
  );
}

// PII patterns — strip before emailing
const STRIP_PATTERNS = [
  /sk-[A-Za-z0-9\-_]{20,}/g,
  /sk-ant-[A-Za-z0-9\-_]{20,}/g,
  /AIza[A-Za-z0-9\-_]{30,}/g,
  /\b4[0-9]{12}(?:[0-9]{3})?\b/g,
  /\b5[1-5][0-9]{14}\b/g,
  /\b[0-9]{4}[\s\-][0-9]{4}[\s\-][0-9]{4}[\s\-][0-9]{4}\b/g,
];

function stripSensitive(text: string): string {
  let out = text;
  for (const re of STRIP_PATTERNS) {
    out = out.replace(re, '[REDACTED]');
    re.lastIndex = 0;
  }
  return out;
}

export interface SupportTicket {
  ticketId: string;
  userId: string;
  userEmail: string;
  plan: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  escalationReason: string;
  timestamp: string;
}

// Rate limit: track escalations per user in-memory (sufficient for single-instance)
const escalationTracker = new Map<string, number[]>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const window = 60 * 60 * 1000; // 1 hour
  const existing = (escalationTracker.get(userId) ?? []).filter(t => now - t < window);
  if (existing.length >= 5) return false;
  escalationTracker.set(userId, [...existing, now]);
  return true;
}

export async function sendSupportEscalation(ticket: SupportTicket): Promise<{ ok: boolean; error?: string }> {
  if (!checkRateLimit(ticket.userId)) {
    return { ok: false, error: 'rate_limited' };
  }

  const apiKey = process.env.RESEND_API_KEY;
  // Recipient: the founder is the escalation. Unified with the Wave-I founder
  // envs so a single ADMIN_EMAIL configures both digests and escalations.
  const to = resolveToAddress();
  // Sender must be on a Resend-VERIFIED domain or the send 404s (the F-29 root
  // cause). The verified domain is the root justgoblin.com — the same one the
  // digest's noreply@justgoblin.com uses — not the send.justgoblin.com subdomain.
  const from = resolveFromAddress();

  if (!apiKey || !to) {
    logger.error(
      { hasApiKey: Boolean(apiKey), hasRecipient: Boolean(to) },
      'support escalation NOT sent — missing config (RESEND_API_KEY and/or SUPPORT_EMAIL_TO/ADMIN_EMAIL)',
    );
    return { ok: false, error: 'missing_config' };
  }

  const recentMessages = ticket.history.slice(-10);
  const chatHtml = recentMessages
    .map(m => {
      const label = m.role === 'user' ? 'User' : 'Goblin Agent';
      const safe = stripSensitive(m.content).replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const bg = m.role === 'user' ? '#f4f4f5' : '#eff6ff';
      return `<tr><td style="padding:8px 12px;background:${bg};border-radius:4px;margin-bottom:4px"><strong>${label}:</strong><br/><span style="white-space:pre-wrap">${safe}</span></td></tr>`;
    })
    .join('<tr><td style="height:6px"></td></tr>');

  const shortReason = stripSensitive(ticket.escalationReason).slice(0, 80);
  const subject = `[Goblin Support] ${ticket.plan} user needs help — ${shortReason}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;color:#18181b;max-width:640px;margin:0 auto;padding:24px">
  <div style="background:#18181b;padding:16px 24px;border-radius:8px 8px 0 0">
    <h2 style="color:#fff;margin:0;font-size:18px">Goblin Support Eskalation</h2>
  </div>

  <div style="border:1px solid #e4e4e7;border-top:none;padding:24px;border-radius:0 0 8px 8px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr><td style="color:#71717a;width:140px;padding:4px 0">User ID</td><td><code>${ticket.userId}</code></td></tr>
      <tr><td style="color:#71717a;padding:4px 0">Email</td><td>${ticket.userEmail}</td></tr>
      <tr><td style="color:#71717a;padding:4px 0">Plan</td><td>${ticket.plan}</td></tr>
      <tr><td style="color:#71717a;padding:4px 0">Ticket ID</td><td><code>${ticket.ticketId}</code></td></tr>
      <tr><td style="color:#71717a;padding:4px 0">Zeitstempel</td><td>${ticket.timestamp}</td></tr>
    </table>

    <h3 style="margin:0 0 8px;font-size:14px;color:#71717a;text-transform:uppercase;letter-spacing:.05em">Eskalationsgrund</h3>
    <p style="background:#fef9c3;border-left:3px solid #ca8a04;padding:10px 14px;border-radius:4px;margin:0 0 20px">${stripSensitive(ticket.escalationReason).replace(/</g, '&lt;')}</p>

    <h3 style="margin:0 0 8px;font-size:14px;color:#71717a;text-transform:uppercase;letter-spacing:.05em">Chat-Verlauf (letzte 10)</h3>
    <table style="width:100%;border-collapse:collapse">${chatHtml}</table>

    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e4e4e7;font-size:12px;color:#a1a1aa">
      <a href="https://justgoblin.com/admin/support-tickets/${ticket.ticketId}" style="color:#6366f1">Admin-Panel →</a>
      &nbsp;|&nbsp; Antworte direkt auf diese Email, um dem User zu schreiben.
    </div>
  </div>
</body>
</html>`;

  // Send through the SAME hardened path the founder-digest uses (lib/email.ts) —
  // NOT a parallel Resend client. J2 built this file with its own `new Resend()`
  // send that ALWAYS set `replyTo: ticket.userEmail`; the support route defaults
  // that email to '' when the user lookup misses, and Resend 422s on an empty
  // reply-to — the regression vs. the digest, which conditionally omits it. We
  // guard the reply-to and delegate; lib/email.ts logs the full Resend error.
  const replyTo = validReplyTo(ticket.userEmail);
  const result = await sendEmail({ from, to, subject, html, ...(replyTo ? { replyTo } : {}) });
  if (!result.ok) {
    logger.error(
      { ticketId: ticket.ticketId, from, hadReplyTo: Boolean(replyTo), error: result.error },
      'support escalation NOT sent — Resend rejected it (see the email-layer log for name/statusCode)',
    );
  }
  return result;
}
