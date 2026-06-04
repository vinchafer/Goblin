import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { streamCompletion } from '../services/model-router';
import { uploadFile } from '../services/file-storage';
import { deployToVercel } from '../services/vercel-service';
import { parseCodeBlocks } from '../lib/parse-code-blocks';
import logger from '../lib/logger';

type Variables = { userId: string };
const codeSessions = new Hono<{ Variables: Variables }>();
codeSessions.use('*', authMiddleware);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Verify the project belongs to the user. Returns project row or null. */
async function ownProject(sb: ReturnType<typeof getSupabaseAdmin>, projectId: string, userId: string) {
  const { data } = await sb.from('projects').select('id, name').eq('id', projectId).eq('user_id', userId).single();
  return data;
}

/** Verify the session belongs to the user. Returns session row or null. */
async function ownSession(sb: ReturnType<typeof getSupabaseAdmin>, sessionId: string, userId: string) {
  const { data } = await sb.from('code_sessions').select('*').eq('id', sessionId).eq('user_id', userId).single();
  return data;
}

const CODE_SYSTEM_PREAMBLE = [
  'Du bist ein KI-Coding-Assistent in einer Session der Goblin Cloud IDE.',
  'Erzeuge den Code, den die Aufgabe verlangt. Halte dich an die bestehenden Dateien dieser Session.',
  'Formatiere JEDE Dateiänderung als einen eigenen umzäunten Codeblock, dessen ERSTE Zeile',
  'den Dateinamen als Kommentar enthält, exakt in einem dieser Formate:',
  '```html',
  '<!-- index.html -->',
  '...',
  '```',
  '```tsx',
  '// src/App.tsx',
  '...',
  '```',
  'Schreibe kurze Erklärungen ausserhalb der Codeblöcke. Antworte auf Deutsch.',
].join('\n');

// ─── GET /api/code-sessions?projectId= — list sessions for a project ────────────
codeSessions.get('/', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.query('projectId');
  if (!projectId) return c.json({ error: 'projectId required' }, 400);

  const sb = getSupabaseAdmin();
  if (!(await ownProject(sb, projectId, userId))) return c.json({ error: 'Project not found' }, 404);

  const { data, error } = await sb
    .from('code_sessions')
    .select('id, name, model_id, state, created_at, updated_at')
    .eq('project_id', projectId)
    .eq('state', 'active')
    .order('updated_at', { ascending: false });

  if (error) return c.json({ error: 'Failed to list sessions' }, 500);

  // Attach a draft-count badge per session (cheap aggregate).
  const ids = (data ?? []).map(s => s.id);
  const draftCounts: Record<string, number> = {};
  if (ids.length) {
    const { data: drafts } = await sb
      .from('code_session_files')
      .select('session_id')
      .in('session_id', ids)
      .eq('change_state', 'draft');
    for (const row of drafts ?? []) draftCounts[row.session_id] = (draftCounts[row.session_id] ?? 0) + 1;
  }

  return c.json({ sessions: (data ?? []).map(s => ({ ...s, draftCount: draftCounts[s.id] ?? 0 })) });
});

// ─── POST /api/code-sessions — create a session ─────────────────────────────────
const CreateSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  modelId: z.string().max(120).optional(),
  initialContent: z.string().max(200_000).optional(),
  initialFilename: z.string().max(300).optional(),
});

codeSessions.post('/', async (c) => {
  const userId = c.get('userId');
  const parsed = CreateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  const { projectId, name, modelId, initialContent, initialFilename } = parsed.data;

  const sb = getSupabaseAdmin();
  if (!(await ownProject(sb, projectId, userId))) return c.json({ error: 'Project not found' }, 404);

  const { data: session, error } = await sb
    .from('code_sessions')
    .insert({ project_id: projectId, user_id: userId, name: name ?? 'Neue Session', model_id: modelId ?? null })
    .select('id, name, model_id, state, created_at, updated_at')
    .single();

  if (error || !session) {
    logger.warn({ err: error?.message }, 'code_session_create_failed');
    return c.json({ error: 'Failed to create session' }, 500);
  }

  // Optional: land initial code (e.g. from Send-to-Code) as a draft.
  if (initialContent && initialContent.trim()) {
    const path = (initialFilename && initialFilename.trim()) || 'index.html';
    await sb.from('code_session_files').insert({
      session_id: session.id, user_id: userId, path, content: initialContent, change_state: 'draft',
    });
  }

  return c.json({ session: { ...session, draftCount: initialContent ? 1 : 0 } }, 201);
});

// ─── GET /api/code-sessions/:sessionId — detail + thread + files ─────────────────
codeSessions.get('/:sessionId', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('sessionId');
  const sb = getSupabaseAdmin();

  const session = await ownSession(sb, sessionId, userId);
  if (!session) return c.json({ error: 'Session not found' }, 404);

  const [{ data: messages }, { data: files }, { data: proj }] = await Promise.all([
    sb.from('code_session_messages').select('id, role, content, model_used, state, created_at')
      .eq('session_id', sessionId).order('created_at', { ascending: true }).limit(200),
    sb.from('code_session_files').select('id, path, content, change_state, updated_at')
      .eq('session_id', sessionId).order('updated_at', { ascending: true }),
    sb.from('projects').select('preview_url, last_deployed_at').eq('id', session.project_id).single(),
  ]);

  const p = proj as { preview_url: string | null; last_deployed_at: string | null } | null;
  return c.json({
    session,
    messages: messages ?? [],
    files: files ?? [],
    deployUrl: p?.preview_url ?? null,
    deployedAt: p?.last_deployed_at ?? null,
  });
});

// ─── PATCH /api/code-sessions/:sessionId — rename / model / state ────────────────
const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  modelId: z.string().max(120).nullable().optional(),
  state: z.enum(['active', 'archived']).optional(),
});

codeSessions.patch('/:sessionId', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('sessionId');
  const parsed = PatchSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);

  const sb = getSupabaseAdmin();
  if (!(await ownSession(sb, sessionId, userId))) return c.json({ error: 'Session not found' }, 404);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.modelId !== undefined) patch.model_id = parsed.data.modelId;
  if (parsed.data.state !== undefined) patch.state = parsed.data.state;

  const { data, error } = await sb.from('code_sessions').update(patch).eq('id', sessionId)
    .select('id, name, model_id, state, created_at, updated_at').single();
  if (error) return c.json({ error: 'Failed to update session' }, 500);
  return c.json({ session: data });
});

// ─── DELETE /api/code-sessions/:sessionId — soft (archive) or hard delete ────────
codeSessions.delete('/:sessionId', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('sessionId');
  const hard = c.req.query('hard') === 'true';
  const sb = getSupabaseAdmin();
  if (!(await ownSession(sb, sessionId, userId))) return c.json({ error: 'Session not found' }, 404);

  if (hard) {
    const { error } = await sb.from('code_sessions').delete().eq('id', sessionId);
    if (error) return c.json({ error: 'Failed to delete session' }, 500);
  } else {
    const { error } = await sb.from('code_sessions')
      .update({ state: 'archived', updated_at: new Date().toISOString() }).eq('id', sessionId);
    if (error) return c.json({ error: 'Failed to archive session' }, 500);
  }
  return c.json({ success: true });
});

// ─── PATCH /api/code-sessions/:sessionId/files — upsert a file (path in body) ────
const FileSchema = z.object({
  path: z.string().min(1).max(300),
  content: z.string().max(500_000),
  changeState: z.enum(['draft', 'saved', 'deployed']).optional(),
});

codeSessions.patch('/:sessionId/files', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('sessionId');
  const parsed = FileSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);

  const sb = getSupabaseAdmin();
  if (!(await ownSession(sb, sessionId, userId))) return c.json({ error: 'Session not found' }, 404);

  const { path, content, changeState } = parsed.data;
  const { data, error } = await sb.from('code_session_files')
    .upsert({
      session_id: sessionId, user_id: userId, path, content,
      change_state: changeState ?? 'draft', updated_at: new Date().toISOString(),
    }, { onConflict: 'session_id,path' })
    .select('id, path, content, change_state, updated_at').single();
  if (error) return c.json({ error: 'Failed to save file' }, 500);

  await sb.from('code_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId);
  return c.json({ file: data });
});

// ─── POST /api/code-sessions/:sessionId/save — promote drafts → saved (storage) ──
codeSessions.post('/:sessionId/save', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('sessionId');
  const sb = getSupabaseAdmin();
  const session = await ownSession(sb, sessionId, userId);
  if (!session) return c.json({ error: 'Session not found' }, 404);

  const { data: drafts } = await sb.from('code_session_files')
    .select('id, path, content').eq('session_id', sessionId).eq('change_state', 'draft');

  if (!drafts || drafts.length === 0) return c.json({ saved: 0, message: 'Keine Entwürfe zu sichern' });

  const saved: string[] = [];
  for (const f of drafts) {
    try {
      await uploadFile(session.project_id, f.path, f.content);   // → project storage (the real file)
      await sb.from('code_session_files')
        .update({ change_state: 'saved', updated_at: new Date().toISOString() }).eq('id', f.id);
      saved.push(f.path);
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err.message : String(err), path: f.path }, 'session_save_file_failed');
    }
  }

  await sb.from('code_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId);
  return c.json({ saved: saved.length, paths: saved });
});

// ─── POST /api/code-sessions/:sessionId/deploy — gated on no remaining drafts ────
codeSessions.post('/:sessionId/deploy', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('sessionId');
  const sb = getSupabaseAdmin();
  const session = await ownSession(sb, sessionId, userId);
  if (!session) return c.json({ error: 'Session not found' }, 404);

  const { count } = await sb.from('code_session_files')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId).eq('change_state', 'draft');
  if (count && count > 0) {
    return c.json({ error: 'Bitte zuerst alle Entwürfe sichern', drafts: count }, 409);
  }

  const project = await ownProject(sb, session.project_id, userId);
  if (!project) return c.json({ error: 'Project not found' }, 404);

  return streamSSE(c, async (stream) => {
    try {
      const result = await deployToVercel(userId, session.project_id, project.name, async (msg) => {
        await stream.writeSSE({ data: JSON.stringify({ type: 'progress', message: msg }) });
      });
      await sb.from('projects')
        .update({ preview_url: result.url, last_deployed_at: new Date().toISOString() })
        .eq('id', session.project_id);
      // Log to deploy history (best-effort — table is migration 0056; ignore if absent).
      try {
        await sb.from('deployments').insert({
          project_id: session.project_id,
          user_id: userId,
          url: result.url,
          vercel_deployment_id: result.deploymentId ?? null,
          session_id: sessionId,
        });
      } catch (err) {
        logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'deployment_log_skipped');
      }
      // Mark this session's saved files as deployed.
      await sb.from('code_session_files')
        .update({ change_state: 'deployed', updated_at: new Date().toISOString() })
        .eq('session_id', sessionId).eq('change_state', 'saved');
      await stream.writeSSE({ data: JSON.stringify({ type: 'success', url: result.url, deploymentId: result.deploymentId }) });
    } catch (err) {
      await stream.writeSSE({ data: JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : 'Deploy failed' }) });
    }
  });
});

// ─── POST /api/code-sessions/:sessionId/messages — prompt → stream → draft files ─
codeSessions.post('/:sessionId/messages', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('sessionId');
  const body = await c.req.json().catch(() => ({})) as { prompt?: string; modelId?: string; activePath?: string };
  const prompt = (body.prompt ?? '').trim();
  if (!prompt) return c.json({ error: 'prompt required' }, 400);
  // 10.8-8: the file the user currently has open. When set, the agent edits it
  // in place (returns the same path) instead of inventing a new file — which
  // makes the existing live-diff + draft-review flow (SessionPane) light up.
  const activePath = (body.activePath ?? '').trim();

  const sb = getSupabaseAdmin();
  const session = await ownSession(sb, sessionId, userId);
  if (!session) return c.json({ error: 'Session not found' }, 404);

  const modelId = body.modelId || session.model_id || undefined;

  // Persist the user turn.
  await sb.from('code_session_messages').insert({
    session_id: sessionId, user_id: userId, role: 'user', content: prompt, state: 'complete',
  });

  // Build file context + prior thread.
  const [{ data: priorMsgs }, { data: existingFiles }] = await Promise.all([
    sb.from('code_session_messages').select('role, content')
      .eq('session_id', sessionId).order('created_at', { ascending: true }).limit(30),
    sb.from('code_session_files').select('path, content').eq('session_id', sessionId),
  ]);

  const activeExists = activePath && (existingFiles ?? []).some(f => f.path === activePath);
  const fileContext = (existingFiles ?? []).length
    ? (existingFiles ?? []).map(f => {
        const marker = (activeExists && f.path === activePath) ? `### ${f.path}  ⟵ AKTUELL GEÖFFNET` : `### ${f.path}`;
        return `${marker}\n\`\`\`\n${f.content.slice(0, 8000)}\n\`\`\``;
      }).join('\n\n')
    : '(noch keine Dateien)';

  // 10.8-8: when a file is open, instruct edit-in-place so the response targets
  // the SAME path (→ live diff + draft review) rather than dumping a new file.
  const editInPlace = activeExists
    ? `\n\n## Wichtig\nDie aktuell geöffnete Datei ist \`${activePath}\`. Wenn die Aufgabe eine Änderung am aktuellen Code beschreibt (z.B. "mach den Hintergrund blau"), gib die KOMPLETTE aktualisierte Datei unter EXAKT demselben Pfad \`${activePath}\` zurück — leg KEINE neue Datei an. Nur wenn ausdrücklich eine neue Datei verlangt wird, verwende einen neuen Pfad.`
    : '';

  // The history excludes the just-inserted user turn (we pass it as `message`).
  const history = (priorMsgs ?? []).slice(0, -1).map(m => ({ role: m.role, content: m.content }));
  const augmented = `${CODE_SYSTEM_PREAMBLE}\n\n## Aktuelle Dateien\n${fileContext}${editInPlace}\n\n## Aufgabe\n${prompt}`;

  return streamSSE(c, async (stream) => {
    let full = '';
    let modelUsed = modelId || 'unknown';
    const abort = new AbortController();
    c.req.raw.signal.addEventListener('abort', () => abort.abort());

    try {
      for await (const jsonToken of streamCompletion({
        userId, projectId: session.project_id, message: augmented,
        chatHistory: history, modelPreference: modelId, supabase: sb, signal: abort.signal,
      })) {
        if (abort.signal.aborted) break;
        const parsed = JSON.parse(jsonToken);
        if (parsed.type === 'meta') { modelUsed = parsed.model || modelUsed; await stream.writeSSE({ data: jsonToken }); continue; }
        if (parsed.type === 'delta') { full += parsed.content; await stream.writeSSE({ data: jsonToken }); continue; }
        if (parsed.type === 'done') break;
        // pass through fallback_notice etc.
        await stream.writeSSE({ data: jsonToken });
      }

      // Parse code blocks → upsert as draft files.
      const blocks = parseCodeBlocks(full);
      const draftFiles: Array<{ path: string; content: string }> = [];
      if (blocks.length === 0 && full.trim()) {
        // Graceful fallback: no parseable code → keep as scratch note, do not crash.
        // (Only persist a scratch file if the response looks like code-ish, else just the message.)
      }
      for (const b of blocks) {
        await sb.from('code_session_files').upsert({
          session_id: sessionId, user_id: userId, path: b.path, content: b.content,
          change_state: 'draft', updated_at: new Date().toISOString(),
        }, { onConflict: 'session_id,path' });
        draftFiles.push({ path: b.path, content: b.content });
      }

      await sb.from('code_session_messages').insert({
        session_id: sessionId, user_id: userId, role: 'assistant', content: full,
        model_used: modelUsed, state: 'complete',
      });
      await sb.from('code_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId);

      await stream.writeSSE({ data: JSON.stringify({ type: 'done', files: draftFiles.map(f => f.path), model_used: modelUsed }) });
    } catch (err) {
      // Persist the partial as an error turn so the thread reflects reality.
      await sb.from('code_session_messages').insert({
        session_id: sessionId, user_id: userId, role: 'assistant', content: full,
        model_used: modelUsed, state: 'error',
      }).then(() => {}, () => {});
      await stream.writeSSE({ data: JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : 'Stream failed' }) });
    }
  });
});

export { codeSessions };
