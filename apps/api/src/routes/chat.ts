import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { createClient } from '@supabase/supabase-js';
import { streamCompletion } from '../services/model-router';
import { authMiddleware } from '../middleware/auth';
import { usageLimitMiddleware } from '../middleware/usage-limit';

type Variables = { userId: string }
const chat = new Hono<{ Variables: Variables }>();

chat.use('*', authMiddleware);

chat.post('/stream', usageLimitMiddleware, async (c) => {
  const userId = c.get('userId');
  const { projectId, message } = await c.req.json();

  if (!projectId || !message) {
    return c.json({ error: 'Missing parameters' }, 400);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Save user message
  await supabase.from('chat_messages').insert({
    project_id: projectId,
    role: 'user',
    content: message
  });

  // Get chat history
  const { data: chatHistory } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(50);

  return streamSSE(c, async (stream) => {
    let fullResponse = '';
    const abortController = new AbortController();

    c.req.raw.signal.addEventListener('abort', () => {
      abortController.abort();
    });

    try {
      for await (const token of streamCompletion({
        userId,
        projectId,
        message,
        chatHistory: chatHistory || []
      })) {
        if (abortController.signal.aborted) break;
        
        fullResponse += token;
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'token',
            content: token
          })
        });
      }

      if (!abortController.signal.aborted) {
        // Save assistant message
        const { data: assistantMessage } = await supabase
          .from('chat_messages')
          .insert({
            project_id: projectId,
            role: 'assistant',
            content: fullResponse,
            model_used: 'claude-sonnet-4-6',
            source_tier: 'byok'
          })
          .select()
          .single();

        await stream.writeSSE({
          data: JSON.stringify({
            type: 'message_end',
            messageId: assistantMessage.id,
            model_used: 'claude-sonnet-4-6',
            source_tier: 'byok'
          })
        });
      }
    } catch (err: unknown) {
      await stream.writeSSE({
        data: JSON.stringify({
          type: 'error',
          message: err instanceof Error ? err.message : 'Stream failed'
        })
      });
    }
  });
});

export { chat };