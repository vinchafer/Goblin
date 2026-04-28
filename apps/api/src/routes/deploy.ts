import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { deployToVercel, getDeployStatus } from '../services/vercel-service';

type Variables = { userId: string };
const deploy = new Hono<{ Variables: Variables }>();
deploy.use('*', authMiddleware);

// Rate-limit middleware for deploy: max 10 deploys per hour per user
const deployRateLimit = async (c: any, next: any) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();
  
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  
  const { count } = await supabase
    .from('deploy_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneHourAgo);
  
  if (count && count >= 10) {
    return c.json({ error: 'Deploy rate limit: max 10 deploys per hour' }, 429);
  }
  
  await next();
};

// POST /api/deploy/vercel — SSE stream
deploy.post('/vercel', deployRateLimit, async (c) => {
  const userId = c.get('userId');
  const { projectId } = await c.req.json();

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

      // Update project preview_url
      await supabase
        .from('projects')
        .update({ preview_url: result.url, last_deployed_at: new Date().toISOString() })
        .eq('id', projectId);

      // Push notification (non-blocking)
      try {
        const { sendToUser } = await import('../services/notification-service');
        await sendToUser(userId, {
          title: 'Goblin',
          body: `🚀 ${project.name} deployed — live ✅`,
          url: `/dashboard/project/${projectId}`,
        });
      } catch {
        // notifications may not be configured
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
  } catch {
    return c.json({ error: 'Failed to get status' }, 500);
  }
});

export { deploy };