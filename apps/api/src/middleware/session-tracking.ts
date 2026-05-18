import { createHash } from 'crypto';
import { getSupabaseAdmin } from '../lib/supabase';
import { sendEmail } from '../lib/email';
import logger from '../lib/logger';

const SESSION_TTL_HOURS = 24 * 7;
const NEW_DEVICE_WINDOW_DAYS = 30;

export interface CreateSessionInput {
  userId: string;
  sessionToken: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function parseUserAgent(ua: string): string {
  if (!ua) return 'Unknown Device';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android Device';
  if (/Macintosh|Mac OS/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Unknown Device';
}

/**
 * Insert a row in user_sessions for the just-issued Supabase access_token.
 * Sends a "new device" email when the device label hasn't been seen for this
 * user in the last 30 days. Email failures don't block the auth flow.
 */
export async function createUserSession(input: CreateSessionInput): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const sessionTokenHash = sha256(input.sessionToken);
  const deviceLabel = parseUserAgent(input.userAgent ?? '');
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000);

  const newDeviceCutoff = new Date(Date.now() - NEW_DEVICE_WINDOW_DAYS * 86400 * 1000);
  const { data: seen } = await supabase
    .from('user_sessions')
    .select('id')
    .eq('user_id', input.userId)
    .eq('device_label', deviceLabel)
    .gte('created_at', newDeviceCutoff.toISOString())
    .limit(1);
  const isNewDevice = !seen || seen.length === 0;

  const { data, error } = await supabase
    .from('user_sessions')
    .insert({
      user_id: input.userId,
      session_token_hash: sessionTokenHash,
      device_label: deviceLabel,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    logger.warn({ error: error?.message }, 'session create failed');
    return null;
  }

  if (isNewDevice) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://justgoblin.com';
    await sendEmail({
      to: input.email,
      subject: 'Goblin: Neues Gerät hat sich angemeldet',
      html: `
        <h2>Neue Anmeldung erkannt</h2>
        <p>Ein neues Gerät hat sich bei deinem Goblin-Konto angemeldet:</p>
        <p><strong>Gerät:</strong> ${deviceLabel}<br>
        <strong>IP:</strong> ${input.ipAddress ?? 'unbekannt'}<br>
        <strong>Zeit:</strong> ${new Date().toLocaleString('de-DE')}</p>
        <p>Wenn du das warst, kannst du diese Email ignorieren.</p>
        <p>Falls nicht: Ändere sofort dein Passwort und revoke die Session in <a href="${appUrl}/settings">Einstellungen → Aktive Sitzungen</a>.</p>
      `,
    });
  }

  return data.id as string;
}

/**
 * Update last_active_at for the session matching a given access_token. Cheap
 * upsert by token hash. Returns nothing — caller is the auth middleware and
 * does not care about failure.
 */
export async function touchSession(sessionToken: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase
      .from('user_sessions')
      .update({ last_active_at: new Date().toISOString() })
      .eq('session_token_hash', sha256(sessionToken))
      .eq('revoked', false);
  } catch (e) {
    logger.warn({ error: (e as Error).message }, 'session touch failed');
  }
}
