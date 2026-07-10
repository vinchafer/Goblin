import { Hono } from 'hono';
import { z } from 'zod';
import { checkLockout, logLoginAttempt } from '../middleware/login-lockout';
import { getSupabaseAdmin } from '../lib/supabase';
import { trackEvent } from '../lib/platform-events';

const auth = new Hono();

/**
 * GET /api/auth/lockout-check?email=<email>
 * Public pre-flight check. The Supabase client-side sign-in doesn't hit our
 * backend, so the login page calls this before signInWithPassword to enforce
 * account lockout.
 */
auth.get('/lockout-check', async (c) => {
  const email = c.req.query('email')?.toLowerCase().trim();
  if (!email) return c.json({ locked: false, remainingAttempts: 5 });
  const result = await checkLockout(email);
  return c.json(result);
});

const LogAttemptSchema = z.object({
  email: z.string().email(),
  success: z.boolean(),
  failureReason: z.string().optional(),
});

/**
 * POST /api/auth/login-attempt
 * Public. The login page calls this after each Supabase sign-in attempt
 * (success or failure) so the lockout window has data to work with.
 */
auth.post('/login-attempt', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = LogAttemptSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid payload' }, 400);

  const ipAddress =
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    undefined;
  const userAgent = c.req.header('user-agent') ?? undefined;

  await logLoginAttempt({
    email: parsed.data.email,
    success: parsed.data.success,
    failureReason: parsed.data.failureReason,
    ipAddress,
    userAgent,
  });

  // I1: login (actives signal) — only on a successful sign-in, and only as a
  // by-user-id event so it joins the purge. Resolve the id best-effort; the
  // whole block is fire-and-forget and never blocks the response.
  if (parsed.data.success) {
    void (async () => {
      try {
        const { data } = await getSupabaseAdmin()
          .from('users')
          .select('id')
          .ilike('email', parsed.data.email)
          .maybeSingle();
        const uid = (data as { id?: string } | null)?.id;
        if (uid) trackEvent({ eventType: 'login', userId: uid });
      } catch { /* silent-fail — measurement only */ }
    })();
  }

  return c.json({ ok: true });
});

export { auth };
