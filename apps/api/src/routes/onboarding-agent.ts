import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { chatStreamRateLimit } from '../middleware/rate-limit';
import { getSupabaseAdmin } from '../lib/supabase';
import { streamSetupBuddy, type BuddyMessage, type OnboardingState } from '../services/setup-buddy-agent';

type Variables = { userId: string };
const onboardingAgent = new Hono<{ Variables: Variables }>();

onboardingAgent.use('*', authMiddleware);

const messageSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(4000),
  })).max(50).default([]),
});

// POST /api/onboarding-agent/chat — SSE stream
onboardingAgent.post('/chat', chatStreamRateLimit, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);

  const { message, history } = parsed.data;
  const supabase = getSupabaseAdmin();

  // Load current onboarding state
  const { data: stateRow } = await supabase
    .from('onboarding_steps')
    .select('goal, ai_provider_choice, code_hosting_choice, deploy_choice, completed')
    .eq('user_id', userId)
    .single();

  const onboardingState: OnboardingState = stateRow ?? {};

  return streamSSE(c, async (stream) => {
    for await (const chunk of streamSetupBuddy({
      userId,
      userMessage: message,
      history: history as BuddyMessage[],
      onboardingState,
      supabase,
    })) {
      await stream.writeSSE({ data: chunk });
    }
  });
});

// POST /api/onboarding-agent/confirm — user confirms a recommendation
onboardingAgent.post('/confirm', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json() as { category: string; choice: string };
  const { category, choice } = body;

  if (!category || !choice) return c.json({ error: 'Missing category or choice' }, 400);

  const supabase = getSupabaseAdmin();
  const fieldMap: Record<string, string> = {
    ai_provider: 'ai_provider_choice',
    code_hosting: 'code_hosting_choice',
    deploy_target: 'deploy_choice',
  };

  const field = fieldMap[category];
  if (!field) return c.json({ error: 'Unknown category' }, 400);

  await supabase
    .from('onboarding_steps')
    .upsert({
      user_id: userId,
      [field]: choice,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  return c.json({ success: true });
});

export { onboardingAgent };
