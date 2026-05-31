import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { storeVercelToken, getVercelConnection, disconnectVercel } from '../services/byok-service';

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

export { integrations };
