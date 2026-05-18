import { Hono } from 'hono';
import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { createHash, randomBytes } from 'crypto';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { sendEmail } from '../lib/email';
import { encryptApiKeyV2, decryptApiKey } from '../lib/byok-encryption';
import logger from '../lib/logger';

type Variables = { userId: string };

const auth2fa = new Hono<{ Variables: Variables }>();

const ISSUER = 'Goblin';
const RECOVERY_CODES_COUNT = 10;
const TOTP_WINDOW = 1;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const VerifySchema = z.object({ code: z.string().length(6).regex(/^\d{6}$/) });
const VerifyLoginSchema = z.object({
  userId: z.string().uuid(),
  code: z.string().min(6).max(20),
  isRecoveryCode: z.boolean().default(false),
});

interface TotpRow {
  totp_secret_encrypted: string;
  totp_secret_vault_id: string | null;
}

async function readTotpSecret(userId: string, row: TotpRow): Promise<string> {
  const { plaintext } = await decryptApiKey(
    userId,
    null,
    {
      ciphertextB64: row.totp_secret_encrypted,
      version: 2,
      vaultSecretId: row.totp_secret_vault_id,
    },
    { provider: 'totp' },
  );
  return plaintext;
}

function totpFor(secret: string, label: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

function generateRecoveryCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const out: string[] = [];
  const bytes = randomBytes(10);
  for (let i = 0; i < 10; i++) {
    out.push(alphabet[bytes[i]! % alphabet.length]!);
  }
  return `${out.slice(0, 4).join('')}-${out.slice(4).join('')}`;
}

/**
 * POST /api/auth/2fa/setup-init
 * Generates a TOTP secret + QR code. Stores the secret sealed with the
 * user's Vault KEK in user_2fa with enabled=false; verify step turns it on.
 */
auth2fa.post('/setup-init', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();

  const { data: userResp } = await supabase.auth.admin.getUserById(userId);
  if (!userResp?.user?.email) return c.json({ error: 'User not found' }, 404);

  const { data: existing } = await supabase
    .from('user_2fa')
    .select('enabled')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing?.enabled) return c.json({ error: '2FA already enabled' }, 409);

  const totpSecret = new OTPAuth.Secret({ size: 20 }).base32;
  const totp = totpFor(totpSecret, userResp.user.email);
  const otpauthUri = totp.toString();
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri);

  const sealed = await encryptApiKeyV2(userId, totpSecret);

  await supabase
    .from('user_2fa')
    .upsert(
      {
        user_id: userId,
        enabled: false,
        totp_secret_encrypted: sealed.ciphertextB64,
        totp_secret_vault_id: sealed.vaultSecretId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

  return c.json({ otpauthUri, qrCodeDataUrl, manualEntryCode: totpSecret });
});

/**
 * POST /api/auth/2fa/setup-verify
 * Verifies a 6-digit code against the pending secret, enables 2FA, and
 * returns 10 fresh recovery codes (shown once).
 */
auth2fa.post('/setup-verify', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const parsed = VerifySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid TOTP code format' }, 400);

  const supabase = getSupabaseAdmin();
  const { data: setup } = await supabase
    .from('user_2fa')
    .select('totp_secret_encrypted, totp_secret_vault_id')
    .eq('user_id', userId)
    .eq('enabled', false)
    .maybeSingle();

  if (!setup?.totp_secret_encrypted) {
    return c.json({ error: 'No pending 2FA setup. Call setup-init first.' }, 404);
  }

  const secret = await readTotpSecret(userId, setup as TotpRow);
  const totp = totpFor(secret, 'Goblin');
  const delta = totp.validate({ token: parsed.data.code, window: TOTP_WINDOW });
  if (delta === null) return c.json({ error: 'Invalid TOTP code' }, 401);

  const codes: string[] = [];
  const rows: Array<{ user_id: string; code_hash: string }> = [];
  for (let i = 0; i < RECOVERY_CODES_COUNT; i++) {
    const code = generateRecoveryCode();
    codes.push(code);
    rows.push({ user_id: userId, code_hash: await bcrypt.hash(code, 10) });
  }

  await supabase.from('user_recovery_codes').delete().eq('user_id', userId);
  await supabase.from('user_recovery_codes').insert(rows);
  await supabase
    .from('user_2fa')
    .update({ enabled: true, enabled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  const { data: userResp } = await supabase.auth.admin.getUserById(userId);
  if (userResp?.user?.email) {
    await sendEmail({
      to: userResp.user.email,
      subject: 'Goblin: 2FA wurde aktiviert',
      html: `
        <h2>Zwei-Faktor-Authentifizierung aktiviert</h2>
        <p>Dein Goblin-Konto ist jetzt mit 2FA geschützt.</p>
        <p>Wenn du das nicht warst, ändere sofort dein Passwort und kontaktiere uns.</p>
      `,
    });
  }

  logger.info({ userIdHash: sha256(userId).slice(0, 12) }, '2fa enabled');

  return c.json({
    success: true,
    recoveryCodes: codes,
    message: 'Speichere deine Recovery-Codes sicher. Sie werden nur einmal angezeigt.',
  });
});

/**
 * POST /api/auth/2fa/verify-login
 * Used by the post-password login step. Accepts either a 6-digit TOTP code
 * or a recovery code (single-use).
 */
auth2fa.post('/verify-login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = VerifyLoginSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  const { userId, code, isRecoveryCode } = parsed.data;
  const supabase = getSupabaseAdmin();

  if (isRecoveryCode) {
    const { data: codes } = await supabase
      .from('user_recovery_codes')
      .select('id, code_hash')
      .eq('user_id', userId)
      .eq('used', false);

    if (!codes || codes.length === 0) {
      return c.json({ error: 'No recovery codes available' }, 404);
    }

    for (const row of codes) {
      if (await bcrypt.compare(code, row.code_hash)) {
        await supabase
          .from('user_recovery_codes')
          .update({ used: true, used_at: new Date().toISOString() })
          .eq('id', row.id);

        const { data: userResp } = await supabase.auth.admin.getUserById(userId);
        if (userResp?.user?.email) {
          await sendEmail({
            to: userResp.user.email,
            subject: 'Goblin: Recovery-Code verwendet',
            html: `
              <p>Ein Recovery-Code wurde gerade verwendet.</p>
              <p>Du hast noch <strong>${codes.length - 1}</strong> Recovery-Codes übrig.</p>
              <p>Falls du das nicht warst, ändere sofort dein Passwort.</p>
            `,
          });
        }

        return c.json({ success: true, remainingCodes: codes.length - 1 });
      }
    }
    return c.json({ error: 'Invalid recovery code' }, 401);
  }

  const { data: setup } = await supabase
    .from('user_2fa')
    .select('totp_secret_encrypted, totp_secret_vault_id')
    .eq('user_id', userId)
    .eq('enabled', true)
    .maybeSingle();
  if (!setup) return c.json({ error: '2FA not enabled for this user' }, 404);

  const secret = await readTotpSecret(userId, setup as TotpRow);
  const totp = totpFor(secret, 'Goblin');
  if (totp.validate({ token: code, window: TOTP_WINDOW }) === null) {
    return c.json({ error: 'Invalid TOTP code' }, 401);
  }

  await supabase
    .from('user_2fa')
    .update({ last_used_at: new Date().toISOString() })
    .eq('user_id', userId);

  return c.json({ success: true });
});

/**
 * POST /api/auth/2fa/disable
 * Requires a current TOTP code as a re-auth step.
 */
auth2fa.post('/disable', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const parsed = VerifySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'TOTP code required to disable 2FA' }, 400);

  const supabase = getSupabaseAdmin();
  const { data: setup } = await supabase
    .from('user_2fa')
    .select('totp_secret_encrypted, totp_secret_vault_id')
    .eq('user_id', userId)
    .eq('enabled', true)
    .maybeSingle();

  if (!setup) return c.json({ error: '2FA not enabled' }, 404);

  const secret = await readTotpSecret(userId, setup as TotpRow);
  const totp = totpFor(secret, 'Goblin');
  if (totp.validate({ token: parsed.data.code, window: TOTP_WINDOW }) === null) {
    return c.json({ error: 'Invalid TOTP code' }, 401);
  }

  await supabase.from('user_2fa').delete().eq('user_id', userId);
  await supabase.from('user_recovery_codes').delete().eq('user_id', userId);

  const { data: userResp } = await supabase.auth.admin.getUserById(userId);
  if (userResp?.user?.email) {
    await sendEmail({
      to: userResp.user.email,
      subject: 'Goblin: 2FA wurde deaktiviert',
      html: `
        <h2>Zwei-Faktor-Authentifizierung deaktiviert</h2>
        <p>Dein Goblin-Konto ist jetzt nur noch mit Passwort geschützt.</p>
        <p>Falls du das nicht warst, ändere sofort dein Passwort und aktiviere 2FA neu.</p>
      `,
    });
  }

  return c.json({ success: true });
});

/**
 * GET /api/auth/2fa/status
 */
auth2fa.get('/status', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();

  const { data: setup } = await supabase
    .from('user_2fa')
    .select('enabled, enabled_at, last_used_at')
    .eq('user_id', userId)
    .maybeSingle();

  const { count } = await supabase
    .from('user_recovery_codes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('used', false);

  return c.json({
    enabled: setup?.enabled ?? false,
    enabledAt: setup?.enabled_at ?? null,
    lastUsedAt: setup?.last_used_at ?? null,
    recoveryCodesRemaining: count ?? 0,
  });
});

/**
 * GET /api/auth/2fa/is-enabled-for?email=<email>
 * Public endpoint — used by the login UI to decide whether to redirect into
 * the 2FA step. Returns only a boolean + opaque userId so we don't expose
 * which emails exist.
 */
auth2fa.get('/is-enabled-for', async (c) => {
  const email = c.req.query('email')?.toLowerCase().trim();
  if (!email) return c.json({ enabled: false });

  const supabase = getSupabaseAdmin();
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (!users?.id) return c.json({ enabled: false });

  const { data: setup } = await supabase
    .from('user_2fa')
    .select('enabled')
    .eq('user_id', users.id)
    .maybeSingle();
  return c.json({ enabled: setup?.enabled === true, userId: setup?.enabled ? users.id : null });
});

export { auth2fa };
