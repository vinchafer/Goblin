import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { authMiddleware } from '../middleware/auth.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { streamCompletion } from '../services/model-router.js';

type Variables = { userId: string };
const chatSessions = new Hono<{ Variables: Variables }>();
chatSessions.use('*', authMiddleware);

// GET /api/chat-sessions — list user sessions
chatSessions.get('/', async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id, title, model_slug, created_at, updated_at, project_id, projects(id, name)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) return c.json({ error: 'Failed to fetch sessions' }, 500);

  // Flatten joined project into project_name field
  const flat = (data ?? []).map((s: Record<string, unknown>) => {
    const proj = s.projects as { name?: string } | null;
    const { projects: _omit, ...rest } = s;
    void _omit;
    return { ...rest, project_name: proj?.name ?? null };
  });
  return c.json(flat);
});

// POST /api/chat-sessions — create new session
chatSessions.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({})) as { projectId?: string };
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({ user_id: userId, project_id: body.projectId ?? null })
    .select()
    .single();

  if (error) return c.json({ error: 'Failed to create session' }, 500);
  return c.json(data, 201);
});

// GET /api/chat-sessions/:id — session + messages
chatSessions.get('/:id', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const supabase = getSupabaseAdmin();

  const { data: session, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (error || !session) return c.json({ error: 'Session not found' }, 404);

  const { data: messages } = await supabase
    .from('standalone_messages')
    .select('id, role, content, has_code, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(50);

  return c.json({ session, messages: messages ?? [] });
});

// POST /api/chat-sessions/:id/stream — stream a message (SSE)
chatSessions.post('/:id/stream', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const { message, modelSlug } = await c.req.json() as { message: string; modelSlug?: string };

  if (!message?.trim()) return c.json({ error: 'Missing message' }, 400);

  const supabase = getSupabaseAdmin();

  const { data: session } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (!session) return c.json({ error: 'Session not found' }, 404);

  // Save user message
  await supabase.from('standalone_messages').insert({
    session_id: sessionId,
    role: 'user',
    content: message,
  });

  // Auto-title from first user message
  const { count } = await supabase
    .from('standalone_messages')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('role', 'user');

  if ((count ?? 0) <= 1) {
    const title = message.trim().slice(0, 60);
    await supabase.from('chat_sessions')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', sessionId);
  } else {
    await supabase.from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);
  }

  // Get conversation history
  const { data: history } = await supabase
    .from('standalone_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(50);

  const chatHistory = (history ?? [])
    .slice(0, -1) // exclude the message we just inserted
    .map(m => ({ role: m.role, content: m.content }));

  return streamSSE(c, async (stream) => {
    let fullResponse = '';
    let currentModel = modelSlug ?? '';
    let currentSourceTier = '';

    const abortController = new AbortController();
    c.req.raw.signal.addEventListener('abort', () => abortController.abort());

    try {
      for await (const jsonToken of streamCompletion({
        userId,
        projectId: null,
        message,
        chatHistory,
        modelPreference: modelSlug,
        supabase,
      })) {
        if (abortController.signal.aborted) break;

        const parsed = JSON.parse(jsonToken) as Record<string, unknown>;

        if (parsed.type === 'meta') {
          currentModel = (parsed.model as string) || currentModel;
          currentSourceTier = (parsed.source_tier as string) || '';
          await stream.writeSSE({ data: JSON.stringify(parsed) });
          continue;
        }

        if (parsed.type === 'delta') {
          fullResponse += (parsed.content as string) ?? '';
          await stream.writeSSE({ data: JSON.stringify(parsed) });
          continue;
        }

        if (parsed.type === 'done' || parsed.type === 'fallback_notice' || parsed.type === 'error') {
          if (parsed.type === 'done' && fullResponse) {
            const hasCode = fullResponse.includes('```');
            const { data: savedMsg } = await supabase
              .from('standalone_messages')
              .insert({
                session_id: sessionId,
                role: 'assistant',
                content: fullResponse,
                has_code: hasCode,
              })
              .select('id')
              .single();

            await supabase.from('chat_sessions')
              .update({ model_slug: currentModel, updated_at: new Date().toISOString() })
              .eq('id', sessionId);

            await stream.writeSSE({
              data: JSON.stringify({
                ...parsed,
                messageId: savedMsg?.id,
                model_used: currentModel,
                source_tier: currentSourceTier,
              }),
            });
          } else {
            await stream.writeSSE({ data: JSON.stringify(parsed) });
          }
          return;
        }

        await stream.writeSSE({ data: JSON.stringify(parsed) });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Streaming failed';
      await stream.writeSSE({ data: JSON.stringify({ type: 'error', message: msg }) });
    }
  });
});

// PATCH /api/chat-sessions/:id — update title
chatSessions.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const { title } = await c.req.json() as { title: string };
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('chat_sessions')
    .update({ title })
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (error) return c.json({ error: 'Failed to update' }, 500);
  return c.json({ success: true });
});

// DELETE /api/chat-sessions/:id
chatSessions.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('chat_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (error) return c.json({ error: 'Failed to delete' }, 500);
  return c.json({ success: true });
});

export { chatSessions };
