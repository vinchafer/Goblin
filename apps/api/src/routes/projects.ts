import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { authMiddleware } from '../middleware/auth';
import { generateProject } from '../services/project-generator';
import { createZip, listFiles, getFile, uploadFile, deleteFile, deleteProject } from '../services/file-storage';
import { getSupabaseAdmin } from '../lib/supabase';
import { createTwoFilesPatch } from 'diff';
import { createProjectFromTemplate } from './templates';
import logger from '../lib/logger';

type Variables = { userId: string }
const projects = new Hono<{ Variables: Variables }>();

projects.use('*', authMiddleware);

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
});

// GET /api/projects/:id/instructions
projects.get('/:id/instructions', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('projects')
    .select('instructions')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return c.json({ error: 'Not found' }, 404);
  return c.json({ instructions: (data as { instructions: string | null }).instructions ?? '' });
});

// PUT /api/projects/:id/instructions  { instructions: string }
projects.put('/:id/instructions', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({ instructions: z.string().max(8000) });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('projects')
    .update({ instructions: parsed.data.instructions })
    .eq('id', projectId)
    .eq('user_id', userId);
  if (error) return c.json({ error: 'Save failed' }, 500);
  return c.json({ success: true });
});

// GET /api/projects/:id/deployments — full live-URL history (newest first).
// Reads the deployments table (migration 0056). Falls back to the project's
// latest preview_url so the hub still shows the live URL before the migration
// lands or for projects deployed under the old single-URL model.
projects.get('/:id/deployments', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '10', 10) || 10, 50);
  const supabase = getSupabaseAdmin();

  const { data: project } = await supabase
    .from('projects')
    .select('preview_url, last_deployed_at')
    .eq('id', projectId).eq('user_id', userId)
    .maybeSingle() as { data: { preview_url: string | null; last_deployed_at: string | null } | null };
  if (!project) return c.json({ error: 'Not found' }, 404);

  let rows: Array<{ id: string; url: string; created_at: string }> = [];
  const { data, error } = await supabase
    .from('deployments')
    .select('id, url, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (!error && data) rows = data as typeof rows;

  // Fallback: no history table / no rows yet but project has a live URL.
  if (rows.length === 0 && project.preview_url) {
    rows = [{
      id: 'latest',
      url: project.preview_url,
      created_at: project.last_deployed_at ?? new Date().toISOString(),
    }];
  }
  return c.json({ deployments: rows });
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
  logger.debug({ user_id: userId }, 'project_create_start');
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
    })
    .select()
    .single();

  if (error) {
    logger.error({ user_id: userId, db_code: error.code, db_message: error.message }, 'project_create_failed');
    return c.json({ error: error.message || 'Failed to create project', code: error.code }, 500);
  }

  // Backfill storage_path — tolerates schema cache lag (column added in migration 0029)
  try {
    await supabase
      .from('projects')
      .update({ storage_path: `projects/${projectId}` })
      .eq('id', projectId);
  } catch { /* storage_path column may not exist yet — non-fatal */ }

  return c.json(data, 201);
});

// POST /api/projects/from-template
projects.post('/from-template', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const schema = z.object({
    templateId: z.string().uuid(),
    projectName: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
  });

  const result = schema.safeParse(body);
  if (!result.success) return c.json({ error: 'Invalid request' }, 400);

  try {
    const project = await createProjectFromTemplate(
      userId,
      result.data.templateId,
      result.data.projectName,
      result.data.description
    );
    return c.json(project, 201);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed to create project' }, 400);
  }
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
    logger.error({ project_id: projectId, err: err instanceof Error ? err.message : String(err) }, 'storage_cleanup_failed')
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
  const filePath = wildcardPath(c);

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
  const filePath = wildcardPath(c);

  if (!filePath) {
    return c.json({ error: 'File path required' }, 400);
  }
  if (!isSafePath(filePath)) {
    return c.json({ error: 'Invalid file path' }, 400);
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

// ── Wildcard path extraction ───────────────────────────────────────────────────
// Hono 4.x does NOT populate c.req.param('*') for a `/files/*` wildcard route, so
// GET/PUT/DELETE on file paths were all 400'ing ("File path required") — which is
// why Send-to-Code Apply never persisted a file and Build reported "no files to
// deploy" (R1, Sprint 4). Derive the path after `/files/` from the request URL,
// URL-decoding the (client-encodeURIComponent'd) segment. (Sprint 5 Phase 3 fix.)
function wildcardPath(c: { req: { param: (k: string) => string | undefined; path: string } }): string {
  const fromParam = c.req.param('*');
  if (fromParam) return fromParam;
  const m = c.req.path.match(/\/files\/(.+)$/);
  const raw = m?.[1];
  if (!raw) return '';
  try { return decodeURIComponent(raw); } catch { return raw; }
}

// ── Path traversal guard ──────────────────────────────────────────────────────
function isSafePath(filePath: string): boolean {
  if (!filePath) return false;
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('..')) return false;
  if (normalized.startsWith('/')) return false;
  if (normalized.includes('\0')) return false;
  return true;
}

async function verifyProjectOwnership(supabase: ReturnType<typeof getSupabaseAdmin>, projectId: string, userId: string) {
  const { data, error } = await supabase
    .from('projects').select('id').eq('id', projectId).eq('user_id', userId).single();
  return error || !data ? null : data;
}

// Create new file
projects.post('/:id/files', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const body = await c.req.json();

  const schema = z.object({
    path: z.string().min(1).max(500),
    content: z.string(),
  });
  const result = schema.safeParse(body);
  if (!result.success) return c.json({ error: 'Invalid request' }, 400);

  if (!isSafePath(result.data.path)) return c.json({ error: 'Invalid file path' }, 400);

  const supabase = getSupabaseAdmin();
  if (!await verifyProjectOwnership(supabase, projectId, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  await uploadFile(projectId, result.data.path, result.data.content);
  return c.json({ success: true, path: result.data.path }, 201);
});

// Delete file
projects.delete('/:id/files/*', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const filePath = wildcardPath(c);

  if (!filePath || !isSafePath(filePath)) return c.json({ error: 'Invalid file path' }, 400);

  const supabase = getSupabaseAdmin();
  if (!await verifyProjectOwnership(supabase, projectId, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  // Soft delete: move to .trash/
  const trashPath = `.trash/${Date.now()}_${filePath.replace(/\//g, '_')}`;
  const content = await getFile(projectId, filePath);
  if (content !== null) {
    await uploadFile(projectId, trashPath, content);
  }
  await deleteFile(projectId, filePath);
  return c.json({ success: true, trashedAs: trashPath });
});

// Rename/move file
projects.post('/:id/files/rename', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const body = await c.req.json();

  const schema = z.object({
    from: z.string().min(1).max(500),
    to: z.string().min(1).max(500),
  });
  const result = schema.safeParse(body);
  if (!result.success) return c.json({ error: 'Invalid request' }, 400);
  if (!isSafePath(result.data.from) || !isSafePath(result.data.to)) {
    return c.json({ error: 'Invalid file path' }, 400);
  }

  const supabase = getSupabaseAdmin();
  if (!await verifyProjectOwnership(supabase, projectId, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  const content = await getFile(projectId, result.data.from);
  if (content === null) return c.json({ error: 'Source file not found' }, 404);

  await uploadFile(projectId, result.data.to, content);
  await deleteFile(projectId, result.data.from);
  return c.json({ success: true, from: result.data.from, to: result.data.to });
});

// Diff endpoint — compute unified diff between current and proposed content
projects.post('/:id/diff', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const body = await c.req.json();

  const schema = z.object({
    filePath: z.string().min(1),
    proposedContent: z.string(),
  });
  const result = schema.safeParse(body);
  if (!result.success) return c.json({ error: 'Invalid request' }, 400);
  if (!isSafePath(result.data.filePath)) return c.json({ error: 'Invalid file path' }, 400);

  const supabase = getSupabaseAdmin();
  if (!await verifyProjectOwnership(supabase, projectId, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  const currentContent = await getFile(projectId, result.data.filePath) ?? '';
  const patch = createTwoFilesPatch(
    result.data.filePath,
    result.data.filePath,
    currentContent,
    result.data.proposedContent,
    'Current',
    'Proposed',
  );

  return c.json({ diff: patch, currentContent, proposedContent: result.data.proposedContent });
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
