import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { storeVercelToken, getVercelConnection, disconnectVercel, storeBraveKey, getBraveConnection, disconnectBrave } from '../services/byok-service';
import { getPlatformSearchProvider, searchDailyCap, remainingPlatformSearches } from '../services/search';

type Variables = { userId: string };
const integrations = new Hono<{ Variables: Variables }>();
integrations.use('*', authMiddleware);

// GET /api/integrations/vercel — connection status + account
integrations.get('/vercel', async (c) => {
  const userId = c.get('userId');
  try {
    return c.json(await getVercelConnection(userId));
  } catch {
    return c.json({ connected: false });
  }
});

const ConnectSchema = z.object({ token: z.string().min(1) });

// POST /api/integrations/vercel — paste-token connect (validates against Vercel /user)
integrations.post('/vercel', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const parsed = ConnectSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Token erforderlich' }, 400);
  try {
    const { account } = await storeVercelToken(userId, parsed.data.token);
    return c.json({ connected: true, account }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Verbindung fehlgeschlagen';
    // 'Invalid token' → 401-ish UX, but keep 400 so the form shows the message inline
    return c.json({ error: msg === 'Invalid token' ? 'Token ungültig — bitte prüfen' : msg }, 400);
  }
});

// DELETE /api/integrations/vercel — disconnect
integrations.delete('/vercel', async (c) => {
  const userId = c.get('userId');
  try {
    await disconnectVercel(userId);
    return c.json({ connected: false });
  } catch {
    return c.json({ error: 'Trennen fehlgeschlagen' }, 500);
  }
});

// ── Websuche / Brave (F4.3) ─────────────────────────────────────────────────────

// GET /api/integrations/websearch — capability + user-key status for the connectors page.
// `platform` = the bundled Brave key is configured (Websuche is live for everyone in
// agent chats); `userKey` = the caller connected their own key (cap-exempt); `remaining`
// drives the JIT nudge toward the own-key connector as the daily cap approaches.
integrations.get('/websearch', async (c) => {
  const userId = c.get('userId');
  const platform = !!getPlatformSearchProvider();
  let brave: { connected: boolean; keyHint?: string } = { connected: false };
  try {
    brave = await getBraveConnection(userId);
  } catch { /* no key */ }
  return c.json({
    platform,
    live: platform || brave.connected,
    userKey: brave.connected,
    keyHint: brave.keyHint,
    dailyCap: searchDailyCap(),
    remaining: brave.connected ? null : remainingPlatformSearches(userId),
  });
});

const BraveConnectSchema = z.object({ key: z.string().min(1) });

// POST /api/integrations/brave — connect the user's own Brave Search key (validated).
integrations.post('/brave', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const parsed = BraveConnectSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Key erforderlich' }, 400);
  try {
    await storeBraveKey(userId, parsed.data.key);
    const brave = await getBraveConnection(userId);
    return c.json({ connected: true, keyHint: brave.keyHint }, 201);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Verbindung fehlgeschlagen' }, 400);
  }
});

// DELETE /api/integrations/brave — disconnect the user's Brave key.
integrations.delete('/brave', async (c) => {
  const userId = c.get('userId');
  try {
    await disconnectBrave(userId);
    return c.json({ connected: false });
  } catch {
    return c.json({ error: 'Trennen fehlgeschlagen' }, 500);
  }
});

export { integrations };
