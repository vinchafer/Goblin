import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { Context, Next } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { deployToVercel, getDeployStatus } from '../services/vercel-service';

type Variables = { userId: string };
const deploy = new Hono<{ Variables: Variables }>();
deploy.use('*', authMiddleware);

// Rate-limit: max 10 deploys per hour per user using agent_runs as proxy
// DEPLOY-FIX [2026-04-29]: removed broken deploy_logs reference (table never existed)
const deployRateLimit = async (c: Context<{ Variables: Variables }>, next: Next) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();

  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();

  const { count } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('last_deployed_at', oneHourAgo);

  if (count !== null && count >= 10) {
    return c.json({ error: 'Deploy rate limit: max 10 deploys per hour' }, 429);
  }

  await next();
};

// POST /api/deploy/vercel — SSE stream
deploy.post('/vercel', deployRateLimit, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({})) as { projectId?: string };
  const { projectId } = body;

  if (!projectId) return c.json({ error: 'projectId required' }, 400);

  const supabase = getSupabaseAdmin();
  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (!project) return c.json({ error: 'Project not found' }, 404);

  return streamSSE(c, async (stream) => {
    try {
      const result = await deployToVercel(
        userId,
        projectId,
        project.name,
        async (msg) => {
          await stream.writeSSE({ data: JSON.stringify({ type: 'progress', message: msg }) });
        },
      );

      await supabase
        .from('projects')
        .update({ preview_url: result.url, last_deployed_at: new Date().toISOString() })
        .eq('id', projectId);

      // Push notification (non-blocking)
      try {
        const { sendToUser } = await import('../services/notification-service');
        await sendToUser(userId, {
          title: `✅ ${project.name} deployed`,
          body: result.url,
          url: `/dashboard/project/${projectId}`,
          tag: 'build_complete',
          actionUrls: {
            open_preview: result.url,
          },
        });
      } catch {
        // VAPID may not be configured — not fatal
      }

      await stream.writeSSE({
        data: JSON.stringify({
          type: 'success',
          url: result.url,
          deploymentId: result.deploymentId,
        }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Deploy failed';
      await stream.writeSSE({ data: JSON.stringify({ type: 'error', message: msg }) });
    }
  });
});

// GET /api/deploy/vercel/:deploymentId/status
deploy.get('/vercel/:deploymentId/status', async (c) => {
  const userId = c.get('userId');
  const deploymentId = c.req.param('deploymentId');
  try {
    const status = await getDeployStatus(userId, deploymentId);
    return c.json(status);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to get status';
    return c.json({ error: msg }, 500);
  }
});

export { deploy };
