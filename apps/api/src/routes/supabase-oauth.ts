// WAVE-B B1 — the Supabase OAuth connector routes (D-B1 = user-connected). Mirrors the
// GitHub connector (routes/github.ts): a one-click OAuth redirect flow reusing the existing
// oauth_states table for CSRF-nonce protection. Status + connect require auth; the callback
// is public (Supabase redirects the browser to it). The access token is stored via
// storeSupabaseConnection (byok_keys, provider='supabase') — the token never touches a log
// or a response body (Wave-D scrubbing catches its JWT shape defensively).

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { authMiddleware } from '../middleware/auth';
import { getAuthUrl, exchangeCodeForToken, SupabaseOAuthError } from '../services/fullstack/supabase-oauth';
import { storeSupabaseConnection, getSupabaseConnection, disconnectSupabase } from '../services/byok-service';
import { fullstackEnabled } from '../services/fullstack/config';
import { getSupabaseAdmin } from '../lib/supabase';
import { sendToUser } from '../services/notification-service';
import logger from '../lib/logger';

type Variables = { userId: string };
const supabaseOAuth = new Hono<{ Variables: Variables }>();

supabaseOAuth.use('/status', authMiddleware);
supabaseOAuth.use('/connect', authMiddleware);
supabaseOAuth.use('/disconnect', authMiddleware);

/** Same-origin relative redirect guard (copied from the GitHub connector — defence in depth). */
function isSafeReturnPath(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > 200) return false;
  if (!value.startsWith('/')) return false;
  if (value.startsWith('//')) return false;
  if (value.startsWith('/\\')) return false;
  if (/[\r\n\t]/.test(value)) return false;
  if (/^\/?[a-z][a-z0-9+.-]*:/i.test(value.slice(1))) return false;
  return true;
}

// GET /api/supabase/status — connection status for the connectors page + the JIT pre-check.
supabaseOAuth.get('/status', async (c) => {
  const userId = c.get('userId');
  // Honest capability signal: while the feature flag is off, report available:false so the
  // connectors page can honest-hide rather than offer a connect that leads nowhere.
  try {
    const conn = await getSupabaseConnection(userId);
    return c.json({ ...conn, available: fullstackEnabled() });
  } catch {
    return c.json({ connected: false, available: fullstackEnabled() });
  }
});

// POST /api/supabase/connect — begin the OAuth flow (returns the authorize URL + state).
supabaseOAuth.post('/connect', async (c) => {
  const userId = c.get('userId');
  const state = randomUUID();

  let returnTo: string | null = null;
  try {
    const body = (await c.req.json().catch(() => null)) as { returnTo?: unknown } | null;
    if (body && isSafeReturnPath(body.returnTo)) returnTo = body.returnTo as string;
  } catch { /* no body — fall back to /dashboard */ }

  const supabase = getSupabaseAdmin();
  const insertRow: Record<string, unknown> = { state, user_id: userId };
  if (returnTo) insertRow.return_to = returnTo;
  await supabase.from('oauth_states').insert(insertRow);

  return c.json({ url: getAuthUrl(state), state });
});

// GET /api/supabase/callback — public (Supabase redirects here). Verifies state, exchanges
// the code, stores the token. Redirects back to the app with a success/error flag.
supabaseOAuth.get('/callback', async (c) => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const code = c.req.query('code');
  const state = c.req.query('state');
  if (!code || !state) {
    return c.redirect(`${appUrl}/dashboard?error=supabase_invalid_request`);
  }

  const supabase = getSupabaseAdmin();
  const { data: oauthState, error } = await supabase
    .from('oauth_states')
    .select('user_id, return_to')
    .eq('state', state)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !oauthState) {
    logger.warn({ stateValid: false }, 'supabase_callback');
    return c.redirect(`${appUrl}/dashboard?error=supabase_oauth_expired`);
  }

  // One-time state.
  await supabase.from('oauth_states').delete().eq('state', state);

  const safeReturnTo = isSafeReturnPath(oauthState.return_to) ? (oauthState.return_to as string) : '/dashboard';

  try {
    const tokens = await exchangeCodeForToken(code);
    await storeSupabaseConnection(oauthState.user_id as string, tokens.accessToken);
    logger.info({ stateValid: true, tokenExchanged: true, saved: true }, 'supabase_callback');

    await sendToUser(oauthState.user_id as string, {
      title: 'Supabase',
      body: '✅ Supabase verbunden',
      url: safeReturnTo,
      tag: 'supabase-connected',
    }).catch((err: unknown) => logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'supabase_notification_failed'));

    return c.redirect(`${appUrl}${safeReturnTo}?connected=supabase`);
  } catch (e) {
    // A coded OAuth error surfaces WHY without leaking secrets. Never echo the code/token.
    const codeStr = e instanceof SupabaseOAuthError ? e.code : 'exchange_failed';
    logger.warn({ stateValid: true, tokenExchanged: false, code: codeStr }, 'supabase_callback');
    return c.redirect(`${appUrl}/dashboard?error=supabase_${codeStr}`);
  }
});

// DELETE /api/supabase/disconnect — revoke the stored connection.
supabaseOAuth.delete('/disconnect', async (c) => {
  const userId = c.get('userId');
  try {
    await disconnectSupabase(userId);
    return c.json({ connected: false });
  } catch {
    return c.json({ error: 'Trennen fehlgeschlagen' }, 500);
  }
});

export { supabaseOAuth };
