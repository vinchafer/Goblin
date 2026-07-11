import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { streamSupportAgent, consumeSupportQuota, type SupportMessage } from '../services/support-agent';

type Variables = { userId: string };
const support = new Hono<{ Variables: Variables }>();

support.use('*', authMiddleware);

const messageSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(4000),
  })).max(30).default([]),
});

// POST /api/support/chat — SSE stream
support.post('/chat', async (c) => {
  const userId = c.get('userId');

  // Per-user daily message cap (in-memory abuse guard, WAVE-J J2). Honest limit
  // message, no fabricated reset time, no "Discord".
  const quota = consumeSupportQuota(userId);
  if (!quota.allowed) {
    return c.json({
      error: 'rate_limited',
      message: 'Du hast das heutige Limit für den Hilfe-Agenten erreicht. Schau solange in die Hilfe-Artikel oder schreib uns an support@justgoblin.com. / You\'ve reached today\'s help-agent limit — see the help articles, or email support@justgoblin.com.',
    }, 429);
  }

  const body = await c.req.json();
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);

  const { message, history } = parsed.data;
  const supabase = getSupabaseAdmin();

  // Fetch user email for escalation reply-to
  const { data: userData } = await supabase.auth.admin.getUserById(userId);
  const userEmail = userData?.user?.email ?? '';

  return streamSSE(c, async (stream) => {
    for await (const chunk of streamSupportAgent({
      userId,
      userEmail,
      userMessage: message,
      history: history as SupportMessage[],
      supabase,
    })) {
      await stream.writeSSE({ data: chunk });
    }
  });
});

export { support };
