import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { streamSupportAgent, type SupportMessage } from '../services/support-agent';

type Variables = { userId: string };
const support = new Hono<{ Variables: Variables }>();

support.use('*', authMiddleware);

// Rate limit: 30 messages/user/hour (tracked in support_tickets)
async function checkRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number; resetInMinutes: number }> {
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - 3600000).toISOString();
  const { count } = await supabase
    .from('support_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since)
    .is('abuse_flag', null);

  const used = count ?? 0;
  const limit = 30;
  const allowed = used < limit;
  return { allowed, remaining: Math.max(0, limit - used), resetInMinutes: 60 };
}

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

  const rateCheck = await checkRateLimit(userId);
  if (!rateCheck.allowed) {
    return c.json({
      error: 'rate_limited',
      message: `I'm taking a quick break. Try again in ${rateCheck.resetInMinutes} minutes or drop us a line on Discord →`,
      resetInMinutes: rateCheck.resetInMinutes,
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
