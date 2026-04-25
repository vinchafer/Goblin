import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { generateProject } from '../services/project-generator';
import { createZip, listFiles, getFile } from '../services/file-storage';
import { createClient } from '@supabase/supabase-js';

type Variables = { userId: string }
const projects = new Hono<{ Variables: Variables }>();

projects.use('*', authMiddleware);

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.enum(['#2D4A2B', '#D4A94A', '#B85C3C', '#4A7C3B', '#6B6B6B']).optional()
});

// List user projects
projects.get('/', async (c) => {
  const userId = c.get('userId');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('last_active', { ascending: false });

  if (error) {
    return c.json({ error: 'Failed to fetch projects' }, 500);
  }

  return c.json(data);
});

// Create new project
projects.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const result = CreateProjectSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid project data' }, 400);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name: result.data.name,
      description: result.data.description ?? null,
      color: result.data.color ?? '#2D4A2B',
      status: 'idle'
    })
    .select()
    .single();

  if (error) {
    return c.json({ error: 'Failed to create project' }, 500);
  }

  return c.json(data, 201);
});

// Delete project
projects.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify ownership
  const { data: project, error: checkError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (checkError || !project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);

  return c.json({ success: true });
});

// Generate project
projects.post('/:id/generate', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify ownership
  const { data: project, error: checkError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (checkError || !project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const body = await c.req.json();

  const schema = z.object({
    prompt: z.string().min(1),
    byokKeyId: z.string().uuid()
  });

  const result = schema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid request' }, 400);
  }

  return streamSSE(c, async (stream) => {
    try {
      await generateProject(
        userId,
        projectId,
        result.data.prompt,
        result.data.byokKeyId,
        stream
      );
    } catch {
      // Error already handled in generateProject
    }
  });
});

// List project files
projects.get('/:id/files', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify ownership
  const { data: project, error: checkError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (checkError || !project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const files = await listFiles(projectId);
  return c.json({ files });
});

// Get single file content
projects.get('/:id/files/*', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const filePath = c.req.param('*');

  if (!filePath) {
    return c.json({ error: 'File path required' }, 400);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify ownership
  const { data: project, error: checkError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (checkError || !project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const content = await getFile(projectId, filePath);
  
  if (content === null) {
    return c.json({ error: 'File not found' }, 404);
  }

  return c.json({ path: filePath, content });
});

// Download project zip
projects.get('/:id/download', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify ownership
  const { data: project, error: checkError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (checkError || !project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const zipBuffer = await createZip(projectId);

  c.header('Content-Type', 'application/zip');
  c.header('Content-Disposition', `attachment; filename="project-${projectId}.zip"`);

  return c.body(zipBuffer as unknown as null);
});

export { projects };