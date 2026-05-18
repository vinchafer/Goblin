import { Hono } from 'hono';
import { createHash, randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { sendEmail } from '../lib/email';
import logger from '../lib/logger';

type Variables = { userId: string };

const account = new Hono<{ Variables: Variables }>();

const GRACE_PERIOD_DAYS = 30;
const CANCELLATION_TOKEN_VALIDITY_HOURS = 24 * 30;

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
 * Soft-delete the account + start 30-day grace period.
 */
account.post('/request-deletion', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));

  const parsed = RequestDeletionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Confirmation text "DELETE" required' }, 400);
  }

  const supabase = getSupabaseAdmin();

  const { data: userResp, error: userErr } = await supabase.auth.admin.getUserById(userId);
  if (userErr || !userResp?.user?.email) {
    logger.error({ userId, error: userErr?.message }, 'account deletion: user lookup failed');
    return c.json({ error: 'User not found' }, 404);
  }
  const userEmail = userResp.user.email;

  const { data: existing } = await supabase
    .from('account_deletions')
    .select('status, scheduled_hard_delete_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.status === 'pending') {
    return c.json(
      {
        error: 'Account deletion already requested',
        scheduledHardDeleteAt: existing.scheduled_hard_delete_at,
      },
      409,
    );
  }

  const cancellationToken = randomBytes(32).toString('hex');
  const scheduledHardDeleteAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 86400 * 1000);
  const cancellationTokenExpiresAt = new Date(
    Date.now() + CANCELLATION_TOKEN_VALIDITY_HOURS * 3600 * 1000,
  );

  const { error: upsertErr } = await supabase
    .from('account_deletions')
    .upsert(
      {
        user_id: userId,
        requested_at: new Date().toISOString(),
        scheduled_hard_delete_at: scheduledHardDeleteAt.toISOString(),
        status: 'pending',
        cancellation_token: cancellationToken,
        cancellation_token_expires_at: cancellationTokenExpiresAt.toISOString(),
        hard_delete_attempted_at: null,
        hard_delete_completed_at: null,
        hard_delete_error: null,
        metadata: { email_hash: sha256(userEmail) },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

  if (upsertErr) {
    logger.error({ userId, error: upsertErr.message }, 'account deletion: insert failed');
    return c.json({ error: 'Could not request deletion' }, 500);
  }

  await supabase.from('deletion_audit_log').insert({
    user_id_hash: sha256(userId),
    user_email_hash: sha256(userEmail),
    event_type: 'requested',
    metadata: {
      grace_period_days: GRACE_PERIOD_DAYS,
      scheduled_hard_delete_at: scheduledHardDeleteAt.toISOString(),
    },
  });

  // Ban the user for the grace period — blocks logins, preserves data.
  const { error: banErr } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: `${GRACE_PERIOD_DAYS * 24}h`,
    user_metadata: {
      ...(userResp.user.user_metadata ?? {}),
      deletion_requested_at: new Date().toISOString(),
      deletion_status: 'pending',
    },
  });
  if (banErr) {
    logger.error({ userId, error: banErr.message }, 'account deletion: ban failed');
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://justgoblin.com';
  const cancellationUrl = `${appUrl}/cancel-deletion?token=${cancellationToken}`;
  const dateDe = scheduledHardDeleteAt.toLocaleDateString('de-DE');

  await sendEmail({
    to: userEmail,
    subject: 'Goblin: Konto-Löschung beantragt',
    html: `
      <h2>Deine Konto-Löschung wurde beantragt</h2>
      <p>Dein Goblin-Konto wird am <strong>${dateDe}</strong> (in ${GRACE_PERIOD_DAYS} Tagen) unwiderruflich gelöscht.</p>
      <p>Während dieser Zeit kannst du dich nicht einloggen. Falls du die Löschung stoppen möchtest, klicke hier:</p>
      <p><a href="${cancellationUrl}" style="background:#2D4A2B;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block">Löschung abbrechen</a></p>
      <p style="color:#666;font-size:14px">
        Dieser Link ist 30 Tage gültig. Wenn du nichts tust, werden alle deine Daten (Chats, Projekte, BYOK-Keys, Dateien) am ${dateDe} unwiderruflich gelöscht.
      </p>
    `,
  });

  logger.info(
    { userIdHash: sha256(userId), scheduledHardDeleteAt: scheduledHardDeleteAt.toISOString() },
    'account deletion requested',
  );

  return c.json({
    success: true,
    scheduledHardDeleteAt: scheduledHardDeleteAt.toISOString(),
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

  const supabase = getSupabaseAdmin();

  const { data: deletion, error: findErr } = await supabase
    .from('account_deletions')
    .select('user_id, status, cancellation_token_expires_at')
    .eq('cancellation_token', token)
    .eq('status', 'pending')
    .maybeSingle();

  if (findErr || !deletion) {
    return c.json({ error: 'Invalid or expired cancellation token' }, 404);
  }

  if (new Date(deletion.cancellation_token_expires_at) < new Date()) {
    return c.json({ error: 'Cancellation token expired' }, 410);
  }

  const { error: updateErr } = await supabase
    .from('account_deletions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', deletion.user_id);

  if (updateErr) {
    logger.error(
      { userIdHash: sha256(deletion.user_id), error: updateErr.message },
      'account deletion cancel: update failed',
    );
    return c.json({ error: 'Could not cancel deletion' }, 500);
  }

  // Lift the ban.
  await supabase.auth.admin.updateUserById(deletion.user_id, {
    ban_duration: 'none',
    user_metadata: { deletion_status: 'cancelled' },
  });

  const { data: userResp } = await supabase.auth.admin.getUserById(deletion.user_id);
  const userEmail = userResp?.user?.email;

  await supabase.from('deletion_audit_log').insert({
    user_id_hash: sha256(deletion.user_id),
    user_email_hash: userEmail ? sha256(userEmail) : 'unknown',
    event_type: 'cancelled',
  });

  logger.info({ userIdHash: sha256(deletion.user_id) }, 'account deletion cancelled');

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

export { account };
