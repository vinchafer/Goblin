import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { uploadFile } from '../services/file-storage';
import { byteLen, assertStorageRoom } from '../services/storage-usage';
import { randomUUID } from 'crypto';

type Variables = { userId: string };
const templates = new Hono<{ Variables: Variables }>();

// GET /api/templates — public list with optional filters
templates.get('/', async (c) => {
  const supabase = getSupabaseAdmin();
  const { category, search, limit = '20', offset = '0' } = c.req.query();

  let query = supabase
    .from('templates')
    .select('id, name, slug, description, category, tags, thumbnail_url, is_official, downloads, tech_stack, created_at')
    .eq('is_public', true)
    .order('is_official', { ascending: false })
    .order('downloads', { ascending: false })
    .limit(Math.min(parseInt(limit), 50))
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  if (category && category !== 'all') query = query.eq('category', category);
  if (search) query = query.ilike('name', `%${search}%`);

  const { data, error } = await query;
  if (error) return c.json({ error: 'Failed to fetch templates' }, 500);
  return c.json(data ?? []);
});

// GET /api/templates/:slug — full template with files
templates.get('/:slug', async (c) => {
  const supabase = getSupabaseAdmin();
  const slug = c.req.param('slug');

  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  if (error || !data) return c.json({ error: 'Template not found' }, 404);
  return c.json(data);
});

// POST /api/projects/from-template — create project from template
// (Registered separately via projects router but defined here for co-location)
export async function createProjectFromTemplate(
  userId: string,
  templateId: string,
  projectName: string,
  description?: string
): Promise<{ id: string; name: string }> {
  const supabase = getSupabaseAdmin();

  // Fetch template
  const { data: template, error: templateError } = await supabase
    .from('templates')
    .select('*')
    .eq('id', templateId)
    .eq('is_public', true)
    .single();

  if (templateError || !template) throw new Error('Template not found');

  const projectId = randomUUID();

  // Create project record
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      id: projectId,
      user_id: userId,
      name: projectName.trim(),
      description: description?.trim(),
      color: '#D4A94A',
    })
    .select()
    .single();

  if (projectError || !project) throw new Error('Failed to create project');

  // Upload template files to storage. Fresh project → all files new, so the aggregate
  // delta = Σ byte sizes. Pre-check against the storage cap BEFORE any write; a
  // StorageCapError (→413) / StorageUnavailableError (→503) propagates to the caller
  // and the empty project can be cleaned up — never a half-populated template.
  const files = template.files as Record<string, string>;
  if (files && typeof files === 'object') {
    const entries = Object.entries(files);
    const aggregateDelta = entries.reduce((sum, [, content]) => sum + byteLen(content as string), 0);
    try {
      await assertStorageRoom(userId, aggregateDelta);
    } catch (err) {
      // Over cap (or unverifiable) — roll back the empty project row so we never
      // leave a half-created template, then surface the clear message.
      await supabase.from('projects').delete().eq('id', projectId);
      throw err;
    }

    const uploadPromises = entries.map(([path, content]) =>
      uploadFile(projectId, path, content as string, { userId, enforce: false }).catch(() => null)
    );
    await Promise.allSettled(uploadPromises);
  }

  // Increment download count (best-effort, fire-and-forget)
  void supabase
    .from('templates')
    .update({ downloads: template.downloads + 1 })
    .eq('id', templateId);

  return { id: projectId, name: projectName };
}

// GET /api/templates/featured — top 3 for dashboard quick-start
templates.get('/featured/list', async (c) => {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('templates')
    .select('id, name, slug, description, category, tags, thumbnail_url, is_official, tech_stack')
    .eq('is_public', true)
    .eq('is_official', true)
    .order('downloads', { ascending: false })
    .limit(3);
  return c.json(data ?? []);
});

export { templates };
