import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { authMiddleware } from '../middleware/auth';
import { generateProject } from '../services/project-generator';
import { createZip, listFiles, getFile, uploadFile, deleteFile, deleteProject, listFilesWithMeta, getFileBytes, uploadProjectFileBytes, listTrashFiles, purgeTrash } from '../services/file-storage';
import { makeTrashPath, parseTrashPath } from '../services/trash-path';
import { getSupabaseAdmin } from '../lib/supabase';
import { createTwoFilesPatch } from 'diff';
import { createProjectFromTemplate } from './templates';
import { teardownVercelProject } from '../services/vercel-service';
import logger from '../lib/logger';
import { trackEvent } from '../lib/platform-events';
import { checkUploadType, MAX_UPLOAD_BYTES } from '../services/upload-policy';
import {
  snapshotProject, listCheckpoints, listPublishVersions, diffCheckpointVsCurrent,
  getCheckpointFileContent, restoreCheckpoint, checkpointsFeatureAvailable,
} from '../services/checkpoints/checkpoint-store';
import { purgeProjectCheckpoints } from '../services/checkpoints/retention';
import { consumeDailyBytes, attachmentBytesPerDay } from '../services/abuse-caps';

type Variables = { userId: string }
const projects = new Hono<{ Variables: Variables }>();

projects.use('*', authMiddleware);

const INTENTS = ["landing_page", "web_app", "import_repo", "exploring"] as const;

const CreateProjectSchema = z.object({
  // Client-generated id doubles as an idempotency key: a retry after a lost
  // response reuses the same id, and the PK conflict resolves to the row the
  // first attempt already created — no duplicate projects (P0.4).
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  // Convergence keystone (Sprint 10). Optional + persisted best-effort so the
  // create flow never breaks before migration 0057 lands on the target DB.
  intent: z.enum(INTENTS).optional(),
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
// F4.1: cap 2000 chars (spec §2). The instructions ride the existing project-context
// injection (goblin-chat-system renderProjectContext, above the rolling memory).
projects.put('/:id/instructions', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({ instructions: z.string().max(2000) });
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

// F4.1: the rolling memory made visible & controllable (spec §2 — "control beats
// mystery"). GET returns the current stored state read-only; DELETE clears the row
// so the next chat honestly has no history (probe 6.2 / the E3 no-history path).
//
// GET /api/projects/:id/state
projects.get('/:id/state', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const supabase = getSupabaseAdmin();
  if (!(await verifyProjectOwnership(supabase, projectId, userId))) {
    return c.json({ error: 'Not found' }, 404);
  }
  // Tolerant of a pre-migration DB (table 0076 absent) → honest empty state.
  try {
    const { data } = await supabase
      .from('project_state')
      .select('summary, decisions, updated_at')
      .eq('project_id', projectId)
      .maybeSingle();
    const row = data as { summary?: string; decisions?: string; updated_at?: string } | null;
    return c.json({
      summary: row?.summary ?? '',
      decisions: row?.decisions ?? '',
      updatedAt: row?.updated_at ?? null,
    });
  } catch {
    return c.json({ summary: '', decisions: '', updatedAt: null });
  }
});

// DELETE /api/projects/:id/state — "Gedächtnis zurücksetzen"
projects.delete('/:id/state', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const supabase = getSupabaseAdmin();
  if (!(await verifyProjectOwnership(supabase, projectId, userId))) {
    return c.json({ error: 'Not found' }, 404);
  }
  // Delete the row entirely — a fresh project_state is indistinguishable from
  // "never had one", which is exactly the honest post-reset state we want.
  try {
    const { error } = await supabase
      .from('project_state')
      .delete()
      .eq('project_id', projectId);
    if (error) return c.json({ error: 'Reset failed' }, 500);
  } catch {
    // Pre-migration table absent → nothing to clear, already the desired state.
  }
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

  const projectId = result.data.id ?? randomUUID();

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

  // Idempotent replay: the id already exists. If it is this user's project the
  // original create succeeded and the client just never saw the response —
  // return that row instead of a duplicate/error.
  if (error && error.code === '23505' && result.data.id) {
    const { data: existing } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();
    if (existing) return c.json(existing, 200);
    return c.json({ error: 'Project id conflict' }, 409);
  }

  if (error) {
    logger.error({ user_id: userId, db_code: error.code, db_message: error.message }, 'project_create_failed');
    return c.json({ error: error.message || 'Failed to create project', code: error.code }, 500);
  }

  // I1 funnel: project_created (metadata only — intent, never name/content).
  // Only genuine new inserts reach here; the idempotent-replay branch returned
  // above, so no duplicate stage event on a client retry.
  trackEvent({ eventType: 'project_created', userId, projectId, meta: { intent: result.data.intent ?? null } });

  // Backfill storage_path — tolerates schema cache lag (column added in migration 0029)
  try {
    await supabase
      .from('projects')
      .update({ storage_path: `projects/${projectId}` })
      .eq('id', projectId);
  } catch { /* storage_path column may not exist yet — non-fatal */ }

  // Persist intent best-effort. Inserted via UPDATE (not the original INSERT) so a
  // pre-migration DB (no `intent` column) silently no-ops instead of failing the
  // whole create. The client also stashes intent in localStorage, so the Code-Tab
  // foreground is correct even before this column exists. (Sprint 10, Slice 1.)
  if (result.data.intent) {
    try {
      const { data: withIntent } = await supabase
        .from('projects')
        .update({ intent: result.data.intent })
        .eq('id', projectId)
        .select()
        .single();
      if (withIntent) return c.json(withIntent, 201);
    } catch { /* intent column may not exist yet — non-fatal */ }
  }

  return c.json(data, 201);
});

// PATCH /:id — rename (name) and/or change project intent (the quiet "Layout
// wechseln"). Tolerant of a pre-migration DB on intent: returns ok:false (not 500)
// so the UI degrades gracefully. Ownership-scoped on every write.
projects.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const schema = z
    .object({ intent: z.enum(INTENTS).optional(), name: z.string().min(1).max(100).optional() })
    .refine((v) => v.intent !== undefined || v.name !== undefined, {
      message: 'Nothing to update',
    });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  const supabase = getSupabaseAdmin();
  if (!(await verifyProjectOwnership(supabase, projectId, userId))) {
    return c.json({ error: 'Not found' }, 404);
  }

  // Rename first — `name` is a guaranteed column (used at create), so a failure
  // here is a real error, unlike the pre-migration-tolerant `intent` write below.
  if (parsed.data.name !== undefined) {
    const { error: nameErr } = await supabase
      .from('projects')
      .update({ name: parsed.data.name })
      .eq('id', projectId)
      .eq('user_id', userId);
    if (nameErr) return c.json({ error: 'Failed to rename' }, 500);
  }

  if (parsed.data.intent !== undefined) {
    const { error } = await supabase
      .from('projects')
      .update({ intent: parsed.data.intent })
      .eq('id', projectId)
      .eq('user_id', userId);
    // Column missing pre-migration → soft-fail; client keeps its localStorage hint.
    if (error) return c.json({ ok: false, persisted: false, intent: parsed.data.intent });
  }

  return c.json({ ok: true, persisted: true, name: parsed.data.name, intent: parsed.data.intent });
});

// POST /bulk-delete — delete many projects in one call. Ownership-scoped: the
// `.in('id', ids).eq('user_id', userId)` filter resolves to
// `WHERE id = ANY($ids) AND user_id = <authed>`, so a forged/mixed id list can
// only ever touch the caller's own rows; non-owned ids are silent no-ops (no IDOR).
// Children (chat_sessions, code_sessions, deployments) cascade via FK. The live
// Vercel site IS torn down per project here (best-effort, rule b): teardown is
// attempted BEFORE the DB cascade so we still have the project name; a teardown
// failure never blocks the delete — the orphaned URL is returned in `orphans`.
projects.post('/bulk-delete', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  const supabase = getSupabaseAdmin();

  // Resolve which of the requested ids the caller actually owns (the only ones we touch).
  const { data: owned, error: ownErr } = await supabase
    .from('projects')
    .select('id, name, preview_url')
    .in('id', parsed.data.ids)
    .eq('user_id', userId);
  if (ownErr) return c.json({ error: 'Failed to delete' }, 500);

  const ownedRows = (owned ?? []) as Array<{ id: string; name: string; preview_url: string | null }>;
  if (ownedRows.length === 0) return c.json({ success: true, deleted: 0, orphans: [] });
  const ownedIds = ownedRows.map((r) => r.id);

  // Tear down each project's live Vercel site FIRST (need the name pre-cascade).
  // Best-effort + isolated per project (rule b/c): one failure never blocks the rest.
  const orphans: Array<{ id: string; url: string | null }> = [];
  for (const row of ownedRows) {
    try {
      const t = await teardownVercelProject(userId, row.name);
      if (!t.ok) {
        orphans.push({ id: row.id, url: row.preview_url });
        logger.warn({ project_id: row.id, status: t.status, err: t.error }, 'vercel_teardown_failed');
      }
    } catch (err) {
      orphans.push({ id: row.id, url: row.preview_url });
      logger.error({ project_id: row.id, err: err instanceof Error ? err.message : String(err) }, 'vercel_teardown_threw');
    }
  }

  const { error } = await supabase
    .from('projects')
    .delete()
    .in('id', ownedIds)
    .eq('user_id', userId);
  if (error) return c.json({ error: 'Failed to delete' }, 500);

  // Best-effort storage cleanup per project — never block the response.
  for (const id of ownedIds) {
    deleteProject(id, { userId }).catch((err) =>
      logger.error({ project_id: id, err: err instanceof Error ? err.message : String(err) }, 'storage_cleanup_failed')
    );
  }

  return c.json({ success: true, deleted: ownedIds.length, orphans });
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
    .select('id, name, preview_url')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single() as { data: { id: string; name: string; preview_url: string | null } | null; error: unknown };

  if (checkError || !project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Tear down the live Vercel site FIRST (need the name before the DB cascade).
  // Best-effort (rule b): a teardown failure NEVER blocks the delete — the
  // orphaned URL is returned so the client/caller can surface it.
  let orphan: string | null = null;
  try {
    const t = await teardownVercelProject(userId, project.name);
    if (!t.ok) {
      orphan = project.preview_url;
      logger.warn({ project_id: projectId, status: t.status, err: t.error }, 'vercel_teardown_failed');
    }
  } catch (err) {
    orphan = project.preview_url;
    logger.error({ project_id: projectId, err: err instanceof Error ? err.message : String(err) }, 'vercel_teardown_threw');
  }

  await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);

  // Best-effort storage cleanup — don't block response on failure
  deleteProject(projectId, { userId }).catch((err) =>
    logger.error({ project_id: projectId, err: err instanceof Error ? err.message : String(err) }, 'storage_cleanup_failed')
  );

  // WAVE-F F5: the project's checkpoint blobs (checkpoints/<id>/) don't cascade with the
  // DB rows — purge them too, so a deleted project's snapshots don't linger in B2.
  purgeProjectCheckpoints([projectId]).catch((err) =>
    logger.error({ project_id: projectId, err: err instanceof Error ? err.message : String(err) }, 'checkpoint_cleanup_failed')
  );

  return c.json({ success: true, orphanUrl: orphan });
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

  // Don't hand back a silent empty ZIP when there is nothing to export.
  const files = await listFiles(projectId);
  if (files.length === 0) {
    return c.json({ error: 'empty_project', message: 'This project has no files to export yet.' }, 422);
  }

  const zipBuffer = await createZip(projectId);

  return new Response(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="project-${projectId}.zip"`
    }
  });
});

// ── File Explorer (Sprint 8) ─────────────────────────────────────────────────
// Ownership helper for the explorer endpoints.
async function ownsProject(sb: ReturnType<typeof getSupabaseAdmin>, projectId: string, userId: string) {
  const { data } = await sb.from('projects').select('id').eq('id', projectId).eq('user_id', userId).single();
  return !!data;
}

// GET /:id/files-tree — flat file list with size + last-modified (explorer builds the tree).
projects.get('/:id/files-tree', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const sb = getSupabaseAdmin();
  if (!(await ownsProject(sb, projectId, userId))) return c.json({ error: 'Project not found' }, 404);
  const [entries, meta] = await Promise.all([listFilesWithMeta(projectId), fileMetaMap(sb, projectId)]);
  // WS-B.2: attach per-file created_at + last_pushed_at (null → explorer shows "—").
  const enriched = entries.map((e) => {
    const m = meta.get(e.path);
    return { ...e, createdAt: m?.created_at ?? null, lastPushedAt: m?.last_pushed_at ?? null };
  });
  return c.json({ entries: enriched });
});

// GET /:id/files-raw/<path> — raw bytes (base64) + content-type for preview/download.
// Wildcard path derived from URL (Hono does not populate param('*') reliably — see note below).
projects.get('/:id/files-raw/*', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const m = c.req.path.match(/\/files-raw\/(.+)$/);
  const filePath = m?.[1] ? decodeURIComponent(m[1]) : '';
  if (!filePath) return c.json({ error: 'Path required' }, 400);
  const sb = getSupabaseAdmin();
  if (!(await ownsProject(sb, projectId, userId))) return c.json({ error: 'Project not found' }, 404);
  const file = await getFileBytes(projectId, filePath);
  if (!file) return c.json({ error: 'File not found' }, 404);
  return c.json({
    path: filePath,
    contentType: file.contentType,
    size: file.bytes.length,
    base64: file.bytes.toString('base64'),
  });
});

// POST /:id/files/upload — multipart upload into the workspace Explorer (D-D, FW5-U3).
// Routed through the FULL hardened guard chain, reusing existing services (F-29 lesson —
// no parallel path): type whitelist (upload-policy) → size ceiling (413) → D-2 daily-bytes
// cap (429) → storageKey prefix-jail (unsafe_path → 400) → guardedPut plan cap (413/503).
// Every failure returns a distinct, honest error code so the client can localise DE/EN.
projects.post('/:id/files/upload', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const sb = getSupabaseAdmin();
  if (!(await ownsProject(sb, projectId, userId))) return c.json({ error: 'Project not found' }, 404);

  const form = await c.req.formData().catch(() => null);
  const file = form?.get('file');
  const targetDir = (form?.get('path') as string | null)?.replace(/^\/+|\/+$/g, '') ?? '';
  if (!file || typeof file === 'string') return c.json({ error: 'no_file', message: 'Keine Datei empfangen.' }, 400);
  if (file.size === 0) return c.json({ error: 'empty_file', message: 'Die Datei ist leer.' }, 400);

  // Size ceiling (per-file). Honest 413.
  if (file.size > MAX_UPLOAD_BYTES) {
    return c.json({ error: 'too_big', message: 'Datei zu groß (max 10 MB). Bitte teile sie auf oder lade eine kleinere Version hoch.' }, 413);
  }

  // Type whitelist — reject anything outside the allowed set with a type-specific message.
  const typeCheck = checkUploadType(file.name);
  if (!typeCheck.ok) {
    const message = typeCheck.reason === 'no_extension'
      ? 'Diese Datei hat keine Dateiendung — ich kann den Typ nicht sicher bestimmen. Bitte gib ihr eine Endung (z.B. .txt, .pdf, .png).'
      : `Dateityp „.${typeCheck.ext}" wird hier nicht unterstützt. Erlaubt sind Text- und Code-Dateien, Bilder, PDFs und gängige Dokumente.`;
    return c.json({ error: 'wrong_type', ext: typeCheck.ext, message }, 415);
  }

  // D-2 daily-bytes cap (shared 'attachment' bucket — bounds a per-user upload flood the
  // per-file ceiling alone can't). Denied requests do NOT consume budget.
  const bytesCap = consumeDailyBytes('attachment', userId, file.size, attachmentBytesPerDay());
  if (!bytesCap.allowed) {
    c.header('Retry-After', '3600');
    return c.json({ error: 'daily_cap', message: 'Du hast heute schon viele Dateien hochgeladen. Bitte morgen wieder — oder lade weniger auf einmal hoch.' }, 429);
  }

  // Sanitize the basename (flat, safe chars). The storageKey prefix-jail is the real
  // boundary; this just keeps filenames tidy. A traversal-style targetDir composes an
  // unsafe key that assertSafeStoragePath rejects (unsafe_path) → honest 400 below.
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const relPath = targetDir ? `${targetDir}/${safeName}` : safeName;
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    await uploadProjectFileBytes(projectId, relPath, bytes, file.type || 'application/octet-stream', { userId });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'unsafe_path') {
      return c.json({ error: 'unsafe_path', message: 'Ungültiger Ziel-Pfad. Bitte lade in einen normalen Projektordner hoch.' }, 400);
    }
    if (code === 'storage_cap_exceeded') {
      return c.json({ error: 'storage_cap', message: 'Dein Cloud-Speicher ist voll. Lösche etwas oder erweitere deinen Plan.' }, 413);
    }
    if (code === 'storage_unavailable') {
      return c.json({ error: 'storage_unavailable', message: 'Der Speicher ist gerade nicht erreichbar. Bitte versuch es gleich nochmal.' }, 503);
    }
    logger.warn({ err: err instanceof Error ? err.message : String(err), projectId }, 'explorer_upload_failed');
    return c.json({ error: 'upload_failed', message: 'Upload fehlgeschlagen. Bitte versuch es nochmal.' }, 500);
  }
  await trackFileCreated(sb, projectId, userId, relPath).catch(() => {});
  return c.json({ ok: true, path: relPath, size: bytes.length });
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

  await uploadFile(projectId, filePath, content, { userId });
  await trackFileCreated(supabase, projectId, userId, filePath).catch(() => {});
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

// WS-B.2 — per-file timestamp tracking (migration 0066). All best-effort: a
// missing table (migration not yet applied) must never break a file write.

/** Record a file's creation. Idempotent — keeps the FIRST created_at on conflict. */
async function trackFileCreated(
  supabase: ReturnType<typeof getSupabaseAdmin>, projectId: string, userId: string, path: string,
): Promise<void> {
  try {
    const { data: existing } = await supabase.from('project_file_meta')
      .select('id').eq('project_id', projectId).eq('path', path).maybeSingle();
    if (existing) return; // don't overwrite the original created_at
    await supabase.from('project_file_meta')
      .insert({ project_id: projectId, user_id: userId, path });
  } catch { /* table may predate migration 0066 — ignore */ }
}

/** Look up tracked timestamps for a project's files, keyed by path. */
async function fileMetaMap(
  supabase: ReturnType<typeof getSupabaseAdmin>, projectId: string,
): Promise<Map<string, { created_at: string | null; last_pushed_at: string | null }>> {
  const out = new Map<string, { created_at: string | null; last_pushed_at: string | null }>();
  try {
    const { data } = await supabase.from('project_file_meta')
      .select('path, created_at, last_pushed_at').eq('project_id', projectId);
    for (const r of data ?? []) {
      out.set(r.path as string, {
        created_at: (r.created_at as string) ?? null,
        last_pushed_at: (r.last_pushed_at as string) ?? null,
      });
    }
  } catch { /* table may predate migration 0066 — ignore */ }
  return out;
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

  await uploadFile(projectId, result.data.path, result.data.content, { userId });
  await trackFileCreated(supabase, projectId, userId, result.data.path).catch(() => {});
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

  // Soft delete: move to .trash/. Net-zero for the cap (copy then remove original),
  // so the trash write is account-only (enforce:false) — a delete must never be
  // blocked by the cap, even for an over-cap user. .trash bytes still count until
  // purged (see POST /:id/files/purge-trash). Reversible key scheme so the
  // Papierkorb can restore to the exact original path (see trash-path.ts).
  const trashPath = makeTrashPath(filePath);
  const content = await getFile(projectId, filePath);
  if (content !== null) {
    await uploadFile(projectId, trashPath, content, { userId, enforce: false });
  }
  await deleteFile(projectId, filePath, { userId });
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

  // Net-zero move: account both sides, never block (enforce:false on the write).
  await uploadFile(projectId, result.data.to, content, { userId, enforce: false });
  await deleteFile(projectId, result.data.from, { userId });
  return c.json({ success: true, from: result.data.from, to: result.data.to });
});

// Move file — alias of rename (the store is path-keyed, so a move IS a rename to a
// new path). Separate route for API clarity / Slice 6 explorer drag-drop. (Sprint 10)
projects.post('/:id/files/move', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const body = await c.req.json();

  const schema = z.object({ from: z.string().min(1).max(500), to: z.string().min(1).max(500) });
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
  // Net-zero move: account both sides, never block (enforce:false on the write).
  await uploadFile(projectId, result.data.to, content, { userId, enforce: false });
  await deleteFile(projectId, result.data.from, { userId });
  return c.json({ success: true, from: result.data.from, to: result.data.to });
});

// WS-B.1 — move a file to ANOTHER project. Data-safe ordering: copy into the
// target's storage FIRST, verify the bytes landed, only THEN delete the source.
// If the copy fails the source is untouched. Does not touch the publish loop.
projects.post('/:id/files/move-to-project', async (c) => {
  const userId = c.get('userId');
  const fromProjectId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const schema = z.object({
    path: z.string().min(1).max(500),
    toProjectId: z.string().uuid(),
    toPath: z.string().min(1).max(500).optional(),
  });
  const result = schema.safeParse(body);
  if (!result.success) return c.json({ error: 'Invalid request' }, 400);

  const { path, toProjectId } = result.data;
  const toPath = result.data.toPath ?? path;
  if (toProjectId === fromProjectId) return c.json({ error: 'Quell- und Zielprojekt sind identisch' }, 400);
  if (!isSafePath(path) || !isSafePath(toPath)) return c.json({ error: 'Invalid file path' }, 400);

  const supabase = getSupabaseAdmin();
  // Caller must own BOTH projects.
  if (!await verifyProjectOwnership(supabase, fromProjectId, userId)) {
    return c.json({ error: 'Quellprojekt nicht gefunden' }, 404);
  }
  if (!await verifyProjectOwnership(supabase, toProjectId, userId)) {
    return c.json({ error: 'Zielprojekt nicht gefunden' }, 404);
  }

  const content = await getFile(fromProjectId, path);
  if (content === null) return c.json({ error: 'Source file not found' }, 404);

  // Don't silently overwrite a file that already exists in the target.
  const existingInTarget = await getFile(toProjectId, toPath);
  if (existingInTarget !== null) {
    return c.json({ error: 'Im Zielprojekt existiert bereits eine Datei mit diesem Namen', conflict: true }, 409);
  }

  // 1) Copy into target and verify the bytes actually landed. Same user owns both
  // projects (checked above) → net-zero for the cap, so account-only (enforce:false).
  await uploadFile(toProjectId, toPath, content, { userId, enforce: false });
  const verify = await getFile(toProjectId, toPath);
  if (verify === null || verify !== content) {
    return c.json({ error: 'Kopieren ins Zielprojekt fehlgeschlagen — Quelle unverändert' }, 500);
  }
  // Track the new file's metadata in the target (best-effort; B.2 migration 0066).
  await trackFileCreated(supabase, toProjectId, userId, toPath).catch(() => {});

  // 2) Copy verified → safe to remove the source.
  await deleteFile(fromProjectId, path, { userId });
  await supabase.from('project_file_meta').delete()
    .eq('project_id', fromProjectId).eq('path', path).then(() => {}, () => {});

  return c.json({ success: true, from: { projectId: fromProjectId, path }, to: { projectId: toProjectId, path: toPath } });
});

// Folder ops (Slice 6). Folders are implicit in a path-keyed store:
//  - create: write a `<path>/.gitkeep` placeholder so the (empty) folder appears.
//  - delete: soft-delete every file under `<path>/` (mirrors the per-file .trash flow).
projects.post('/:id/files/folder', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const body = await c.req.json();

  const schema = z.object({ path: z.string().min(1).max(500), action: z.enum(['create', 'delete']) });
  const result = schema.safeParse(body);
  if (!result.success) return c.json({ error: 'Invalid request' }, 400);
  const folder = result.data.path.replace(/^\/+|\/+$/g, '');
  if (!folder || !isSafePath(folder)) return c.json({ error: 'Invalid folder path' }, 400);

  const supabase = getSupabaseAdmin();
  if (!await verifyProjectOwnership(supabase, projectId, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  if (result.data.action === 'create') {
    await uploadFile(projectId, `${folder}/.gitkeep`, '', { userId, enforce: false });
    return c.json({ success: true, path: folder });
  }

  // delete: soft-delete all files under the folder prefix.
  const all = await listFiles(projectId);
  const prefix = `${folder}/`;
  const victims = all
    .map((p) => p.replace(`${projectId}/`, '').replace(/^\/+/, ''))
    .filter((p) => p === folder || p.startsWith(prefix));
  let deleted = 0;
  for (const path of victims) {
    const content = await getFile(projectId, path);
    if (content !== null) {
      await uploadFile(projectId, makeTrashPath(path), content, { userId, enforce: false });
      await deleteFile(projectId, path, { userId });
      deleted++;
    }
  }
  return c.json({ success: true, path: folder, deleted });
});

// Permanently purge a project's .trash/ — the REAL "free space" action. Soft-delete
// only moves files to .trash/ (still real bytes that count toward the cap); this
// removes those B2 objects for good and decrements the user's storage counter. The
// only way deleting actually frees cap space.
projects.post('/:id/files/purge-trash', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');

  const supabase = getSupabaseAdmin();
  if (!await verifyProjectOwnership(supabase, projectId, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  // Batched purge (the #18 fix, applied to trash too): chunks DeleteObjects to
  // ≤1000/req and decrements the counter by the exact freed bytes. Frees B2 for good.
  const purged = await purgeTrash(projectId, { userId });
  return c.json({ success: true, purged });
});

// List the Papierkorb — soft-deleted entries with their recovered original path.
// New-scheme entries carry `originalPath`; legacy flattened entries are flagged
// `legacy:true` with `originalPath:null` (listable + purgeable, not auto-restorable).
projects.get('/:id/trash', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');

  const supabase = getSupabaseAdmin();
  if (!await verifyProjectOwnership(supabase, projectId, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  const entries = (await listTrashFiles(projectId))
    .filter((f) => f.path !== '.trash') // ignore the bare folder marker if present
    .map((f) => {
      const parsed = parseTrashPath(f.path);
      return {
        trashPath: f.path,
        originalPath: parsed?.originalPath ?? null,
        deletedAt: parsed?.deletedAt ?? null,
        legacy: parsed?.legacy ?? true,
        size: f.size,
        modified: f.modified,
      };
    })
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)); // newest first

  return c.json({ entries });
});

// Restore a soft-deleted file back to its original path. Net-zero for the cap
// (copy back with enforce:false, then remove the trash copy). 409 if a live file
// already occupies the original path; 400 for legacy entries whose path is lost.
projects.post('/:id/files/restore', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const body = await c.req.json().catch(() => null);

  const schema = z.object({ trashPath: z.string().min(1).max(600) });
  const result = schema.safeParse(body);
  if (!result.success) return c.json({ error: 'Invalid request' }, 400);

  const trashPath = result.data.trashPath;
  if (!trashPath.startsWith('.trash/') || !isSafePath(trashPath)) {
    return c.json({ error: 'Invalid trash path' }, 400);
  }

  const supabase = getSupabaseAdmin();
  if (!await verifyProjectOwnership(supabase, projectId, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  const parsed = parseTrashPath(trashPath);
  if (!parsed || parsed.legacy || !parsed.originalPath) {
    return c.json({ error: 'legacy_unrestorable', message: 'Diese Datei stammt aus einem älteren Papierkorb und kann nicht automatisch wiederhergestellt werden.' }, 400);
  }
  const originalPath = parsed.originalPath;
  if (!isSafePath(originalPath)) return c.json({ error: 'Invalid target path' }, 400);

  const content = await getFile(projectId, trashPath);
  if (content === null) return c.json({ error: 'Trash entry not found' }, 404);

  // Refuse to silently overwrite a live file that reclaimed the original path.
  if (await getFile(projectId, originalPath) !== null) {
    return c.json({ error: 'conflict', conflict: true, path: originalPath }, 409);
  }

  await uploadFile(projectId, originalPath, content, { userId, enforce: false });
  await deleteFile(projectId, trashPath, { userId });
  return c.json({ success: true, restoredTo: originalPath });
});

// ─── WAVE-F (Versionierung & Zeit) — checkpoints / Zeitleiste ────────────────────
// Goblin's internal undo safety net. All endpoints ownership-scoped + pre-0095 tolerant
// (the store no-ops when the table is absent → the UI honest-hides). Static sub-paths
// (/checkpoints, /checkpoints/publish) are registered BEFORE the :checkpointId param
// routes so they are never parsed as an id.

// GET /:id/checkpoints — the F3 timeline (newest first, each with ±n vs previous).
projects.get('/:id/checkpoints', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const supabase = getSupabaseAdmin();
  if (!await verifyProjectOwnership(supabase, projectId, userId)) return c.json({ error: 'Not found' }, 404);
  const checkpoints = await listCheckpoints(projectId, userId);
  // `available` lets the client honest-hide the whole surface pre-0095 (empty list could
  // otherwise read as "no history yet" — this disambiguates).
  return c.json({ available: await checkpointsFeatureAvailable(), checkpoints });
});

// POST /:id/checkpoints — the user "Stand sichern" trigger. Optional { label }.
projects.post('/:id/checkpoints', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const supabase = getSupabaseAdmin();
  if (!await verifyProjectOwnership(supabase, projectId, userId)) return c.json({ error: 'Not found' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ label: z.string().max(120).optional() }).safeParse(body);
  const label = (parsed.success && parsed.data.label?.trim()) || 'Stand gesichert';
  const id = await snapshotProject({ projectId, userId, label, createdBy: 'user' });
  if (!id) return c.json({ error: 'checkpoint_unavailable' }, 409); // pre-0095 / write failed
  return c.json({ success: true, checkpointId: id });
});

// GET /:id/checkpoints/publish — the F4 publish-history ("frühere Versionen").
projects.get('/:id/checkpoints/publish', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const supabase = getSupabaseAdmin();
  if (!await verifyProjectOwnership(supabase, projectId, userId)) return c.json({ error: 'Not found' }, 404);
  const versions = await listPublishVersions(projectId, userId);
  return c.json({ versions });
});

// GET /:id/checkpoints/:checkpointId/diff — F3 file-change list vs current.
projects.get('/:id/checkpoints/:checkpointId/diff', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const checkpointId = c.req.param('checkpointId');
  const supabase = getSupabaseAdmin();
  if (!await verifyProjectOwnership(supabase, projectId, userId)) return c.json({ error: 'Not found' }, 404);
  const diff = await diffCheckpointVsCurrent(projectId, userId, checkpointId);
  if (!diff) return c.json({ error: 'Not found' }, 404);
  return c.json(diff);
});

// GET /:id/checkpoints/:checkpointId/file?path= — the checkpoint's version of ONE file
// plus the current version, so the client can render a DiffSheet (base=checkpoint, proposed
// =current). A file absent from the snapshot returns base=null (restore would delete it).
projects.get('/:id/checkpoints/:checkpointId/file', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const checkpointId = c.req.param('checkpointId');
  const path = c.req.query('path') ?? '';
  if (!isSafePath(path)) return c.json({ error: 'Invalid file path' }, 400);
  const supabase = getSupabaseAdmin();
  if (!await verifyProjectOwnership(supabase, projectId, userId)) return c.json({ error: 'Not found' }, 404);
  const [base, current] = await Promise.all([
    getCheckpointFileContent(projectId, userId, checkpointId, path),
    getFile(projectId, path),
  ]);
  return c.json({ path, base, current: current ?? null });
});

// POST /:id/checkpoints/:checkpointId/restore — F2 restore ("rückgängig").
projects.post('/:id/checkpoints/:checkpointId/restore', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const checkpointId = c.req.param('checkpointId');
  const supabase = getSupabaseAdmin();
  if (!await verifyProjectOwnership(supabase, projectId, userId)) return c.json({ error: 'Not found' }, 404);
  const res = await restoreCheckpoint(projectId, userId, checkpointId);
  if (res.ok) {
    return c.json({ success: true, restored: res.restored, removed: res.removed, newCheckpointId: res.newCheckpointId });
  }
  // Honest, per-reason responses — never a generic 500.
  if (res.error === 'not_found') return c.json({ error: 'Not found' }, 404);
  if (res.error === 'run_active') {
    return c.json({
      error: 'run_active',
      message: 'Es läuft gerade ein Agent-Lauf für dieses Projekt. Warte, bis er fertig ist, dann kannst du wiederherstellen.',
    }, 409);
  }
  if (res.error === 'unavailable') return c.json({ error: 'checkpoint_unavailable' }, 409);
  return c.json({ error: 'restore_failed', message: 'Wiederherstellung fehlgeschlagen. Es wurde nichts verändert.' }, 500);
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
