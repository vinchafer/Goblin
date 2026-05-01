import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { authMiddleware } from '../middleware/auth';
import { generateProject } from '../services/project-generator';
import { createZip, listFiles, getFile, uploadFile, deleteProject } from '../services/file-storage';
import { getSupabaseAdmin } from '../lib/supabase';

type Variables = { userId: string }
const projects = new Hono<{ Variables: Variables }>();

projects.use('*', authMiddleware);

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
});

// List user projects
projects.get('/', async (c) => {
  const userId = c.get('userId');
  
  const supabase = getSupabaseAdmin();

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

  const supabase = getSupabaseAdmin();

  const projectId = randomUUID();

  const { data, error } = await supabase
    .from('projects')
    .insert({
      id: projectId,
      user_id: userId,
      name: result.data.name,
      description: result.data.description ?? null,
      color: result.data.color ?? '#2D4A2B',
      status: 'idle',
      storage_path: `projects/${projectId}`
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

  const supabase = getSupabaseAdmin();

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

  // Best-effort storage cleanup — don't block response on failure
  deleteProject(projectId).catch((err) =>
    console.error(`Storage cleanup failed for project ${projectId}:`, err)
  );

  return c.json({ success: true });
});

// Generate project
projects.post('/:id/generate', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');

  const supabase = getSupabaseAdmin();

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

  const supabase = getSupabaseAdmin();

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

  const supabase = getSupabaseAdmin();

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

  const supabase = getSupabaseAdmin();

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

  return new Response(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="project-${projectId}.zip"`
    }
  });
});

// Get pending code injections for a project
projects.get('/:id/pending-injections', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');

  const supabase = getSupabaseAdmin();

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

  // Fetch pending injections
  const { data: injections, error: fetchError } = await supabase
    .from('code_injections')
    .select('id, payload, payload_type, filename_hint, created_at')
    .eq('project_id', projectId)
    .is('applied_at', null)
    .order('created_at', { ascending: false });

  if (fetchError) {
    return c.json({ error: 'Failed to fetch injections' }, 500);
  }

  return c.json({
    injections: (injections || []).map(i => ({
      id: i.id,
      payload: i.payload,
      payloadType: i.payload_type,
      filenameHint: i.filename_hint ?? undefined,
      createdAt: i.created_at,
    })),
  });
});

// Acknowledge received injections — client calls this after successfully consuming them
projects.patch('/:id/pending-injections/acknowledge', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const body = await c.req.json();
  const ids: string[] = body.ids ?? [];

  if (!Array.isArray(ids) || ids.length === 0) {
    return c.json({ error: 'ids must be a non-empty array' }, 400);
  }

  const supabase = getSupabaseAdmin();

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
    .from('code_injections')
    .update({ applied_at: new Date().toISOString() })
    .in('id', ids)
    .eq('project_id', projectId);

  return c.json({ acknowledged: ids.length });
});

// Save file content (for CodeMirror editor)
projects.put('/:id/files/*', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const filePath = c.req.param('*');

  if (!filePath) {
    return c.json({ error: 'File path required' }, 400);
  }

  const { content } = await c.req.json();
  if (content === undefined || content === null) {
    return c.json({ error: 'Content required' }, 400);
  }

  const supabase = getSupabaseAdmin();

  // Verify ownership
  const { data: project, error: checkError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (checkError || !project) {
    return c.json({ error: 'Not found' }, 404);
  }

  await uploadFile(projectId, filePath, content);
  return c.json({ success: true, path: filePath });
});

// Get single project by id
projects.get('/:id', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');

  const supabase = getSupabaseAdmin();

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (error || !project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  return c.json(project);
});

export { projects };
