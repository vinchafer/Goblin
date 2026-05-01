import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';

type Variables = { userId: string };
const builds = new Hono<{ Variables: Variables }>();
builds.use('*', authMiddleware);

const BUILD_TYPE = z.enum(['github_push', 'vercel_deploy', 'code_generation']);
type BuildType = z.infer<typeof BUILD_TYPE>;

// POST /api/builds/start
builds.post('/start', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const schema = z.object({
    projectId: z.string().uuid(),
    type: BUILD_TYPE,
    message: z.string().optional(),
  });

  const result = schema.safeParse(body);
  if (!result.success) return c.json({ error: 'Invalid request' }, 400);

  const supabase = getSupabaseAdmin();

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', result.data.projectId)
    .eq('user_id', userId)
    .single();

  if (!project) return c.json({ error: 'Project not found' }, 404);

  const { data, error } = await supabase
    .from('build_runs')
    .insert({
      project_id: result.data.projectId,
      user_id: userId,
      type: result.data.type,
      status: 'running',
      progress_pct: 0,
      message: result.data.message ?? typeLabel(result.data.type),
    })
    .select('id')
    .single();

  if (error || !data) return c.json({ error: 'Failed to create build record' }, 500);

  return c.json({ jobId: data.id });
});

// GET /api/builds/project/:projectId — recent builds (last hour)
builds.get('/project/:projectId', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('projectId');
  const supabase = getSupabaseAdmin();
  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();

  const { data, error } = await supabase
    .from('build_runs')
    .select('*')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) return c.json({ error: 'Failed to fetch builds' }, 500);
  return c.json(data ?? []);
});

// GET /api/builds/:jobId/status
builds.get('/:jobId/status', async (c) => {
  const userId = c.get('userId');
  const jobId = c.req.param('jobId');
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('build_runs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .single();

  if (error || !data) return c.json({ error: 'Build not found' }, 404);
  return c.json(data);
});

// PATCH /api/builds/:jobId — internal status update (CRON_SECRET protected)
builds.patch('/:jobId', async (c) => {
  const secret = c.req.header('x-internal-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const jobId = c.req.param('jobId');
  const body = await c.req.json();

  const schema = z.object({
    status: z.enum(['pending', 'running', 'done', 'failed']).optional(),
    progress_pct: z.number().int().min(0).max(100).optional(),
    message: z.string().optional(),
  });

  const result = schema.safeParse(body);
  if (!result.success) return c.json({ error: 'Invalid request' }, 400);

  const update: Record<string, unknown> = { ...result.data };
  if (result.data.status === 'done' || result.data.status === 'failed') {
    update.completed_at = new Date().toISOString();
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('build_runs').update(update).eq('id', jobId);
  if (error) return c.json({ error: 'Update failed' }, 500);

  return c.json({ success: true });
});

function typeLabel(type: BuildType): string {
  switch (type) {
    case 'github_push': return 'Pushing to GitHub…';
    case 'vercel_deploy': return 'Deploying to Vercel…';
    case 'code_generation': return 'Generating project…';
  }
}

export { builds };
