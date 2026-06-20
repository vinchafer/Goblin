import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { createClient } from '@supabase/supabase-js';
import { streamCompletionGuarded } from '../services/model-router';
import { authMiddleware } from '../middleware/auth';
import { chatStreamRateLimit } from '../middleware/rate-limit';

type Variables = { userId: string }
const chat = new Hono<{ Variables: Variables }>();

chat.use('*', authMiddleware);

chat.get('/:projectId/history', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('projectId');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (!project) return c.json({ error: 'Project not found' }, 404);

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) return c.json({ error: 'Failed to fetch history' }, 500);

  return c.json(data || []);
});

// HR-3 (DD §A): the per-minute burst guard stays; the legacy monthly REQUEST-COUNT
// cap (usageLimitMiddleware) is retired. It wrongly 200-capped BYOK (the user's own
// key) and goblin_hosted (already governed by the weighted token allowance + daily
// guard in model-router.ts), and only ever applied here — standalone chat had no
// such cap, so it was bypassable theatre. Goblin spend stays capped by the weighted
// allowance; BYOK has no Goblin-imposed limit, matching the UI promise.
chat.post('/stream', chatStreamRateLimit, async (c) => {
  const userId = c.get('userId');
  const { projectId, message, modelSlug } = await c.req.json();

  if (!projectId || !message) {
    return c.json({ error: 'Missing parameters' }, 400);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify project ownership — prevents IDOR (any user writing to any project)
  const { data: projectCheck } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (!projectCheck) return c.json({ error: 'Project not found' }, 404);

  // Save user message
  const { error: userInsertErr } = await supabase.from('chat_messages').insert({
    project_id: projectId,
    role: 'user',
    content: message
  });
  if (userInsertErr) {
    // Persistence failure here means the next turn loses this message → broken
    // conversation memory. Surface it loudly instead of failing silently.
    console.error('[chat] failed to persist user message:', userInsertErr.message);
  }

  // Get chat history. We just inserted the user message above, so the most
  // recent row is THIS turn's message — drop it: the model-router appends
  // `message` itself, and including it here would duplicate the last user turn.
  const { data: chatHistoryRows, error: historyErr } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(50);
  if (historyErr) console.error('[chat] failed to load history:', historyErr.message);
  const chatHistory = (chatHistoryRows ?? []).slice(0, -1);

  return streamSSE(c, async (stream) => {
    let fullResponse = '';
    let currentModel = modelSlug || 'claude-sonnet-4-6';
    let currentSourceTier = 'byok';
    const abortController = new AbortController();

    c.req.raw.signal.addEventListener('abort', () => {
      abortController.abort();
    });

    try {
      for await (const jsonToken of streamCompletionGuarded({
        userId,
        projectId,
        message,
        chatHistory: chatHistory || [],
        modelPreference: modelSlug,
        supabase,
        signal: abortController.signal,
      })) {
        if (abortController.signal.aborted) break;

        const parsed = JSON.parse(jsonToken);

        // Meta event — routing info, send as-is
        if (parsed.type === 'meta') {
          currentModel = parsed.model;
          currentSourceTier = parsed.source_tier;
          await stream.writeSSE({
            data: JSON.stringify(parsed),
          });
          continue;
        }

        // Delta event — token content
        if (parsed.type === 'delta') {
          fullResponse += parsed.content;
          await stream.writeSSE({
            data: JSON.stringify({
              type: 'delta',
              content: parsed.content,
            }),
          });
          continue;
        }

        // Error / fallback_notice — forward verbatim so the client can surface
        // it instead of spinning forever (e.g. the first-token watchdog).
        if (parsed.type === 'error' || parsed.type === 'fallback_notice') {
          await stream.writeSSE({ data: JSON.stringify(parsed) });
          if (parsed.type === 'error') return;
          continue;
        }

        // Done event
        if (parsed.type === 'done') {
          // Save assistant message
          const { data: assistantMessage } = await supabase
            .from('chat_messages')
            .insert({
              project_id: projectId,
              role: 'assistant',
              content: fullResponse,
              model_used: currentModel,
              source_tier: currentSourceTier,
            })
            .select()
            .single();

          await stream.writeSSE({
            data: JSON.stringify({
              type: 'done',
              messageId: assistantMessage?.id,
              model_used: currentModel,
              source_tier: currentSourceTier,
            }),
          });
          return;
        }
      }

      // Fallback done if generator ends without explicit 'done'
      const { data: assistantMessage } = await supabase
        .from('chat_messages')
        .insert({
          project_id: projectId,
          role: 'assistant',
          content: fullResponse,
          model_used: currentModel,
          source_tier: currentSourceTier,
        })
        .select()
        .single();

      await stream.writeSSE({
        data: JSON.stringify({
          type: 'done',
          messageId: assistantMessage?.id,
          model_used: currentModel,
          source_tier: currentSourceTier,
        }),
      });
    } catch (err: unknown) {
      await stream.writeSSE({
        data: JSON.stringify({
          type: 'error',
          message: err instanceof Error ? err.message : 'Stream failed',
        }),
      });
    }
  });
});

export { chat };