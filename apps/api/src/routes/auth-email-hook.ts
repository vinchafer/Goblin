import { Hono } from 'hono';
import { createHmac, timingSafeEqual } from 'node:crypto';
import logger from '../lib/logger';
import { sendEmail } from '../lib/email';
import {
  renderAuthEmail,
  buildConfirmUrl,
  siteOrigin,
  type AuthEmailType,
} from '../lib/auth-email-templates';

/**
 * U3 — Supabase "Send Email" auth hook.
 *
 * Supabase calls this endpoint INSTEAD of sending the mail itself, so every
 * auth mail (password reset, signup confirmation, email change, magic link,
 * invite) is rendered from templates that live versioned in this repo and goes
 * out through the existing hardened Resend service. That is what takes the
 * mails out of the Supabase-default "one bare link" shape that reads as
 * phishing — the reason they land in spam despite green DKIM/SPF.
 *
 * It is also what lets U2 fix the reset chain: we, not the dashboard, decide
 * the link format, so every mail can point at the cross-context-safe
 * token_hash interstitial instead of a PKCE `?code=` round trip that only
 * works in the browser that made the request.
 *
 * Founder's ONE manual step: Supabase Dashboard → Authentication → Hooks →
 * "Send Email" → enable, URL = <API origin>/api/auth/email-hook, and copy the
 * generated secret into SUPABASE_AUTH_HOOK_SECRET on the API host. Nothing
 * else is configured by hand.
 */
export const authEmailHook = new Hono();

/** Standard Webhooks tolerance — reject replays outside a 5-minute window. */
const TIMESTAMP_TOLERANCE_SEC = 5 * 60;

interface HookPayload {
  user?: { email?: string; new_email?: string };
  email_data?: {
    token_hash?: string;
    token_hash_new?: string;
    redirect_to?: string;
    email_action_type?: string;
  };
}

/**
 * Verify a Standard Webhooks signature (the scheme Supabase uses for auth
 * hooks). Signed content is `${id}.${timestamp}.${rawBody}`; the configured
 * secret arrives as `v1,whsec_<base64>` and the base64 part is the HMAC key.
 */
export function verifyHookSignature(opts: {
  secret: string;
  id: string;
  timestamp: string;
  signatureHeader: string;
  rawBody: string;
  nowSec?: number;
}): { ok: true } | { ok: false; reason: string } {
  const ts = Number(opts.timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'bad_timestamp' };
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SEC) return { ok: false, reason: 'timestamp_out_of_tolerance' };

  const base64Key = opts.secret.replace(/^v1,\s*/, '').replace(/^whsec_/, '');
  let key: Buffer;
  try {
    key = Buffer.from(base64Key, 'base64');
  } catch {
    return { ok: false, reason: 'bad_secret' };
  }
  if (key.length === 0) return { ok: false, reason: 'bad_secret' };

  const expected = createHmac('sha256', key)
    .update(`${opts.id}.${opts.timestamp}.${opts.rawBody}`)
    .digest('base64');

  // The header may carry several space-separated versioned signatures during a
  // secret rotation — any one matching is a pass.
  const candidates = opts.signatureHeader
    .split(' ')
    .map(part => (part.startsWith('v1,') ? part.slice(3) : part))
    .filter(Boolean);

  const expectedBuf = Buffer.from(expected);
  for (const candidate of candidates) {
    const buf = Buffer.from(candidate);
    if (buf.length === expectedBuf.length && timingSafeEqual(buf, expectedBuf)) return { ok: true };
  }
  return { ok: false, reason: 'signature_mismatch' };
}

/**
 * Map Supabase's email_action_type onto a template. `email_change_current` and
 * `email_change_new` are the two halves of an address change; both get the
 * change template, addressed to whichever mailbox the half goes to.
 */
export function mapActionType(action: string): AuthEmailType | null {
  switch (action) {
    case 'recovery': return 'recovery';
    case 'signup': return 'signup';
    case 'invite': return 'invite';
    case 'magiclink': return 'magiclink';
    case 'email_change':
    case 'email_change_current':
    case 'email_change_new':
      return 'email_change';
    default:
      return null;
  }
}

/**
 * Reply-To for auth mail, from `AUTH_REPLY_TO`. Unset by default and therefore a
 * no-op until the founder points it at a mailbox someone actually reads: a
 * Reply-To that bounces is worse than none, and promising a reachable human we
 * do not staff would be the same lie in a header instead of in a sentence.
 * (Deliverability note: replies to a From address are a positive engagement
 * signal at the large providers; an unreachable one is not.)
 */
export function authReplyTo(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const raw = (env.AUTH_REPLY_TO ?? '').trim().replace(/^["']|["']$/g, '');
  return raw || undefined;
}

/** `justgoblin.com` and `www.justgoblin.com` are the same site to us. */
function sameSite(a: URL, b: URL): boolean {
  if (a.origin === b.origin) return true;
  const strip = (h: string) => h.replace(/^www\./, '');
  return a.protocol === b.protocol && strip(a.host) === strip(b.host);
}

/**
 * Only same-site relative paths survive — never trust redirect_to blindly. Note
 * that only `pathname + search` is ever carried over, never the origin, so this
 * cannot become an open redirect; the check exists to keep a foreign path out of
 * our own URL.
 *
 * U4: the apex/www pair is accepted as one site. Supabase sends `redirect_to`
 * derived from the project's Site URL, which is the apex, while
 * NEXT_PUBLIC_APP_URL on the API host is `https://www.justgoblin.com` (the apex
 * 307s to www). A strict origin comparison silently dropped every `next`, so a
 * signup confirmation meant to land somewhere specific fell back to the default.
 */
export function nextPathFrom(redirectTo: string | undefined, origin: string): string | undefined {
  if (!redirectTo) return undefined;
  try {
    const base = new URL(origin);
    const url = new URL(redirectTo, origin);
    if (!sameSite(url, base)) return undefined;
    return `${url.pathname}${url.search}`;
  } catch {
    return undefined;
  }
}

authEmailHook.post('/', async (c) => {
  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  if (!secret) {
    // Fail loudly rather than send unverified mail. Until the founder enables
    // the hook this endpoint refuses everything, and Supabase keeps sending its
    // own templates — so the worst case is today's behaviour, not an outage.
    logger.error('auth-email-hook: SUPABASE_AUTH_HOOK_SECRET not set — refusing');
    return c.json({ error: { http_code: 500, message: 'hook not configured' } }, 500);
  }

  const rawBody = await c.req.text();
  const id = c.req.header('webhook-id') ?? '';
  const timestamp = c.req.header('webhook-timestamp') ?? '';
  const signature = c.req.header('webhook-signature') ?? '';
  if (!id || !timestamp || !signature) {
    return c.json({ error: { http_code: 401, message: 'missing signature headers' } }, 401);
  }

  const verdict = verifyHookSignature({ secret, id, timestamp, signatureHeader: signature, rawBody });
  if (!verdict.ok) {
    logger.warn({ reason: verdict.reason }, 'auth-email-hook: signature verification failed');
    return c.json({ error: { http_code: 401, message: 'invalid signature' } }, 401);
  }

  let payload: HookPayload;
  try {
    payload = JSON.parse(rawBody) as HookPayload;
  } catch {
    return c.json({ error: { http_code: 400, message: 'invalid json' } }, 400);
  }

  const action = payload.email_data?.email_action_type ?? '';
  const type = mapActionType(action);
  if (!type) {
    // Never pretend to have sent something. An unmapped action (e.g.
    // reauthentication, which is a 6-digit code and not a link) is reported so
    // it surfaces instead of silently dropping an auth mail.
    logger.warn({ action }, 'auth-email-hook: unsupported email_action_type');
    return c.json({ error: { http_code: 400, message: `unsupported email_action_type: ${action}` } }, 400);
  }

  // The `email_change_new` half is addressed to the NEW mailbox and carries its
  // own token; every other action goes to the account's current address.
  const isNewAddressHalf = action === 'email_change_new';
  const to = (isNewAddressHalf ? payload.user?.new_email : payload.user?.email) ?? payload.user?.email;
  const tokenHash = (isNewAddressHalf ? payload.email_data?.token_hash_new : payload.email_data?.token_hash)
    ?? payload.email_data?.token_hash;

  if (!to || !tokenHash) {
    logger.warn({ action, hasEmail: !!to, hasToken: !!tokenHash }, 'auth-email-hook: incomplete payload');
    return c.json({ error: { http_code: 400, message: 'payload missing email or token_hash' } }, 400);
  }

  const origin = siteOrigin();
  const actionUrl = buildConfirmUrl({
    origin,
    tokenHash,
    type,
    next: nextPathFrom(payload.email_data?.redirect_to, origin),
  });

  const { subject, html, text } = renderAuthEmail(type, { email: to, actionUrl });
  const replyTo = authReplyTo();
  const result = await sendEmail({ to, subject, html, text, ...(replyTo ? { replyTo } : {}) });

  if (!result.ok) {
    // Surface the failure to Supabase so the USER sees an error instead of
    // waiting forever for a mail that was never sent.
    logger.error({ action, error: result.error }, 'auth-email-hook: send failed');
    return c.json({ error: { http_code: 500, message: 'email delivery failed' } }, 500);
  }

  logger.info({ action, type }, 'auth-email-hook: sent');
  return c.json({});
});
