import { Hono } from 'hono';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { sendEmail } from '../lib/email';
import logger from '../lib/logger';
import { getSoftLimitStatus } from '../middleware/soft-limits';
import { requestAccountDeletion, reactivateByToken } from '../services/account-deletion';

type Variables = { userId: string };

const account = new Hono<{ Variables: Variables }>();

const sha256 = (input: string): string =>
  createHash('sha256').update(input).digest('hex');

const RequestDeletionSchema = z.object({
  confirmation: z.literal('DELETE'),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(12, 'Mindestens 12 Zeichen')
    .regex(/[A-Z]/, 'Mindestens 1 Großbuchstabe')
    .regex(/[a-z]/, 'Mindestens 1 Kleinbuchstabe')
    .regex(/[0-9]/, 'Mindestens 1 Zahl'),
});

const CancelDeletionSchema = z.object({
  token: z.string().min(32).max(128),
});

/**
 * POST /api/account/request-deletion
 * Soft-delete the account + start the grace period (GRACE_PERIOD_DAYS).
 */
account.post('/request-deletion', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));

  const parsed = RequestDeletionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Confirmation text "DELETE" required' }, 400);
  }

  const result = await requestAccountDeletion(userId);
  if (!result.ok) {
    return c.json(
      { error: result.error, scheduledHardDeleteAt: result.scheduledHardDeleteAt },
      (result.status ?? 500) as 400 | 404 | 409 | 500,
    );
  }

  const dateDe = result.scheduledHardDeleteAt
    ? new Date(result.scheduledHardDeleteAt).toLocaleDateString('de-DE')
    : '';

  return c.json({
    success: true,
    scheduledHardDeleteAt: result.scheduledHardDeleteAt,
    cancellationTokenSent: true,
    message: `Konto-Löschung beantragt. Hard-Delete am ${dateDe}.`,
  });
});

/**
 * POST /api/account/cancel-deletion
 * Cancels a pending deletion via cancellation token. No auth — token is the auth.
 */
account.post('/cancel-deletion', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = CancelDeletionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Cancellation token required' }, 400);
  }
  const { token } = parsed.data;

  const result = await reactivateByToken(token);
  if (!result.ok) {
    return c.json({ error: result.error }, (result.status ?? 500) as 404 | 410 | 500);
  }

  return c.json({ success: true, message: 'Konto-Löschung wurde abgebrochen.' });
});

/**
 * GET /api/account/deletion-status
 */
account.get('/deletion-status', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('account_deletions')
    .select('status, requested_at, scheduled_hard_delete_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return c.json({ error: 'Could not fetch status' }, 500);
  }

  return c.json({
    deletionRequested: data?.status === 'pending',
    status: data?.status ?? null,
    requestedAt: data?.requested_at ?? null,
    scheduledHardDeleteAt: data?.scheduled_hard_delete_at ?? null,
  });
});

/**
 * POST /api/account/change-password
 * Verifies current password, sets new one, invalidates all sessions.
 */
account.post('/change-password', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));

  const parsed = ChangePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', issues: parsed.error.issues }, 400);
  }
  const { currentPassword, newPassword } = parsed.data;

  const admin = getSupabaseAdmin();

  const { data: userResp, error: userErr } = await admin.auth.admin.getUserById(userId);
  if (userErr || !userResp?.user?.email) {
    return c.json({ error: 'User not found' }, 404);
  }
  const userEmail = userResp.user.email;

  // Verify current password via a stateless anon-key client — never touches the
  // user's existing session and never persists a new one.
  const anonClient = createClient(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!,
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error: signInErr } = await anonClient.auth.signInWithPassword({
    email: userEmail,
    password: currentPassword,
  });
  if (signInErr) {
    return c.json({ error: 'Aktuelles Passwort ist falsch' }, 401);
  }

  const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (updateErr) {
    logger.error({ userIdHash: sha256(userId), error: updateErr.message }, 'password change failed');
    return c.json({ error: 'Could not update password' }, 500);
  }

  // Invalidate all sessions on every device.
  try {
    await admin.auth.admin.signOut(userId, 'global');
  } catch (e) {
    logger.warn({ userIdHash: sha256(userId), error: (e as Error).message }, 'signOut global failed');
  }

  await sendEmail({
    to: userEmail,
    subject: 'Goblin: Passwort wurde geändert',
    html: `
      <h2>Dein Goblin-Passwort wurde geändert</h2>
      <p>Aus Sicherheitsgründen wurden alle anderen Sessions abgemeldet. Du musst dich auf anderen Geräten neu anmelden.</p>
      <p>Wenn du diese Änderung nicht vorgenommen hast, antworte sofort auf diese Email.</p>
    `,
  });

  logger.info({ userIdHash: sha256(userId) }, 'password changed');

  return c.json({ success: true, message: 'Passwort geändert. Du musst dich neu einloggen.' });
});

/**
 * POST /api/account/avatar
 * Multipart upload of an avatar image. The web app already crops + WebP-encodes
 * the file client-side via canvas to 512x512, so we just persist the blob and
 * write the resulting URL into user_metadata.avatar_url.
 */
account.post('/avatar', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.parseBody().catch(() => ({}));
  const file = (body as Record<string, unknown>).avatar;
  if (!(file instanceof File)) {
    return c.json({ error: 'Kein Bild angehängt' }, 400);
  }
  if (file.size > 5 * 1024 * 1024) {
    return c.json({ error: 'Bild zu groß (max 5MB)' }, 400);
  }

  const { uploadBytes } = await import('../services/file-storage');
  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `users/${userId}/avatar.webp`;
  const contentType = file.type && file.type.startsWith('image/') ? file.type : 'image/webp';

  try {
    const result = await uploadBytes(key, buffer, contentType);
    const supabase = getSupabaseAdmin();
    const { data: userResp } = await supabase.auth.admin.getUserById(userId);
    const newMeta = {
      ...(userResp?.user?.user_metadata ?? {}),
      avatar_url: result.publicUrl ?? null,
      avatar_key: key,
      avatar_updated_at: new Date().toISOString(),
    };
    await supabase.auth.admin.updateUserById(userId, { user_metadata: newMeta });
    return c.json({ url: result.publicUrl, key });
  } catch (e) {
    logger.error(
      { userIdHash: sha256(userId).slice(0, 12), error: (e as Error).message },
      'avatar upload failed',
    );
    return c.json({ error: 'Upload fehlgeschlagen' }, 500);
  }
});

/**
 * POST /api/account/sessions/register
 * Called by the web app right after a successful Supabase sign-in (and after
 * the optional 2FA step) to record the just-issued access_token in
 * user_sessions. Sends a "new device" email if this UA hasn't been seen.
 */
account.post('/sessions/register', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const authHeader = c.req.header('Authorization') ?? '';
  const sessionToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!sessionToken) return c.json({ error: 'Missing token' }, 400);

  const supabase = getSupabaseAdmin();
  const { data: userResp } = await supabase.auth.admin.getUserById(userId);
  const email = userResp?.user?.email ?? '';

  const ipAddress =
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    undefined;
  const userAgent = c.req.header('user-agent') ?? undefined;

  const { createUserSession } = await import('../middleware/session-tracking');
  const id = await createUserSession({
    userId,
    sessionToken,
    email,
    ipAddress,
    userAgent,
  });
  return c.json({ ok: true, sessionId: id });
});

/**
 * GET /api/account/sessions
 * Lists active sessions for the current user. Marks the request's own
 * session by hash so the UI can flag it.
 */
account.get('/sessions', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();
  const authHeader = c.req.header('Authorization') ?? '';
  const sessionToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const { sha256: hash } = await import('../middleware/session-tracking');
  const currentHash = sessionToken ? hash(sessionToken) : null;

  const { data, error } = await supabase
    .from('user_sessions')
    .select('id, session_token_hash, device_label, ip_address, last_active_at, created_at, expires_at')
    .eq('user_id', userId)
    .eq('revoked', false)
    .gt('expires_at', new Date().toISOString())
    .order('last_active_at', { ascending: false });
  if (error) return c.json({ error: 'Could not load sessions' }, 500);

  const sessions = (data ?? []).map((row) => ({
    id: row.id,
    device_label: row.device_label,
    ip_address: row.ip_address,
    last_active_at: row.last_active_at,
    created_at: row.created_at,
    expires_at: row.expires_at,
    isCurrent: currentHash !== null && row.session_token_hash === currentHash,
  }));

  return c.json({ sessions });
});

/**
 * POST /api/account/sessions/:id/revoke
 */
account.post('/sessions/:id/revoke', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('user_sessions')
    .update({ revoked: true, revoked_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('user_id', userId);
  if (error) return c.json({ error: 'Could not revoke session' }, 500);
  return c.json({ success: true });
});

/**
 * POST /api/account/sessions/revoke-others
 * Revokes every session for the user except the one making this request.
 */
account.post('/sessions/revoke-others', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const authHeader = c.req.header('Authorization') ?? '';
  const sessionToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!sessionToken) return c.json({ error: 'Missing token' }, 400);

  const supabase = getSupabaseAdmin();
  const { sha256: hash } = await import('../middleware/session-tracking');
  const currentHash = hash(sessionToken);

  const { error } = await supabase
    .from('user_sessions')
    .update({ revoked: true, revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('revoked', false)
    .neq('session_token_hash', currentHash);
  if (error) return c.json({ error: 'Could not revoke sessions' }, 500);
  return c.json({ success: true });
});

/**
 * GET /api/account/byok-decrypt-log
 * Returns the latest decrypt audit entries for the current user.
 */
account.get('/byok-decrypt-log', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const limitRaw = parseInt(c.req.query('limit') ?? '50', 10);
  const limit = Math.min(Math.max(isFinite(limitRaw) ? limitRaw : 50, 1), 200);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('byok_decrypt_log')
    .select('id, provider, operation, ip_address, user_agent, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return c.json({ error: 'Could not fetch log' }, 500);
  return c.json({ entries: data ?? [] });
});

account.get('/soft-limit-status', authMiddleware, async (c) => {
  const userId = c.get('userId');
  try {
    const status = await getSoftLimitStatus(userId);
    return c.json(status);
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'soft-limit-status failed');
    return c.json({ error: 'Failed to compute soft-limit status' }, 500);
  }
});

// ─── Phase J: invite code redemption ────────────────────────────────────────
const RedeemInviteSchema = z.object({
  code: z.string().min(3).max(64),
});

account.post('/redeem-invite', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const parsed = RedeemInviteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Ungültiger Code' }, 400);
  }
  const code = parsed.data.code.trim().toUpperCase();
  const supabase = getSupabaseAdmin();

  const { data: invite } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('code', code)
    .maybeSingle();

  if (!invite) return c.json({ error: 'Code nicht gefunden' }, 404);
  if (invite.expires_at && new Date(invite.expires_at as string) < new Date()) {
    return c.json({ error: 'Code ist abgelaufen' }, 400);
  }
  if ((invite.use_count as number) >= (invite.max_uses as number)) {
    return c.json({ error: 'Code wurde bereits vollständig eingelöst' }, 400);
  }

  // Idempotency: if same user already redeemed this code, no-op success.
  if (invite.redeemed_by === userId) {
    return c.json({ success: true, alreadyRedeemed: true });
  }

  const { error: updErr } = await supabase
    .from('invite_codes')
    .update({
      use_count: (invite.use_count as number) + 1,
      redeemed_by: userId,
      redeemed_at: new Date().toISOString(),
    })
    .eq('code', code);

  if (updErr) {
    logger.error({ err: updErr.message, userId, code }, 'invite redeem update failed');
    return c.json({ error: 'Einlösung fehlgeschlagen' }, 500);
  }

  if (invite.grants_comp) {
    await supabase
      .from('users')
      .update({
        is_comped: true,
        comp_reason: `invite:${code}`,
        comped_at: new Date().toISOString(),
      })
      .eq('id', userId);
  }

  return c.json({ success: true });
});

// ─── Phase C: per-key monthly usage summary for sidebar ─────────────────────
const PROVIDER_LABELS: Record<string, string> = {
  google: 'Gemini',
  groq: 'Groq',
  anthropic: 'Claude',
  openai: 'OpenAI',
  mistral: 'Mistral',
  deepseek: 'DeepSeek',
  xai: 'xAI',
};
const FREE_TIER_PROVIDERS = new Set(['google', 'groq']);

account.get('/key-usage-summary', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { data: keys } = await supabase
    .from('byok_keys')
    .select('provider')
    .eq('user_id', userId);

  if (!keys || keys.length === 0) {
    return c.json({ keys: [] });
  }

  const result: Array<{
    provider: string;
    providerLabel: string;
    requestsThisMonth: number;
    isFreeTier: boolean;
  }> = [];

  // De-dup providers (one key per provider in practice, but defensive)
  const providers = Array.from(new Set(keys.map((k: { provider: string }) => k.provider)));

  for (const provider of providers) {
    const { data: usageRows } = await supabase
      .from('byok_key_usage')
      .select('requests')
      .eq('user_id', userId)
      .eq('provider', provider)
      .gte('period_start', monthStart.toISOString().split('T')[0]);

    const requestsThisMonth = (usageRows ?? []).reduce(
      (s: number, r: { requests: number | null }) => s + (r.requests ?? 0),
      0
    );

    result.push({
      provider,
      providerLabel: PROVIDER_LABELS[provider] ?? provider,
      requestsThisMonth,
      isFreeTier: FREE_TIER_PROVIDERS.has(provider),
    });
  }

  return c.json({ keys: result });
});

// ─── Phase H: user preferences (custom instructions, locale, tz, notifications) ───
const PreferencesSchema = z.object({
  custom_instructions: z.string().max(4000).optional().nullable(),
  locale: z.enum(['de', 'en']).optional(),
  timezone: z.string().max(64).optional().nullable(),
  notify_build_complete: z.boolean().optional(),
  notify_important_updates: z.boolean().optional(),
  notify_email: z.boolean().optional(),
  memory_enabled: z.boolean().optional(),
});

account.get('/preferences', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('custom_instructions, locale, timezone, notify_build_complete, notify_important_updates, notify_email, memory_enabled')
    .eq('id', userId)
    .maybeSingle();
  if (error) return c.json({ error: 'Lookup failed' }, 500);
  return c.json(data ?? {});
});

account.put('/preferences', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const parsed = PreferencesSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid preferences', details: parsed.error.flatten() }, 400);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('users')
    .update(parsed.data)
    .eq('id', userId);
  if (error) {
    logger.error({ err: error.message, userId }, 'preferences update failed');
    return c.json({ error: 'Update failed' }, 500);
  }
  return c.json({ success: true });
});

export { account };
