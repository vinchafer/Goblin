import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';

type Variables = { userId: string };
const onboarding = new Hono<{ Variables: Variables }>();

onboarding.use('*', authMiddleware);

const stateSchema = z.object({
  current_step: z.number().min(0).max(5).optional(),
  completed: z.boolean().optional(),
  goal: z.string().max(200).nullable().optional(),
  ai_provider_choice: z.enum(['byok', 'no_key', 'free_tier']).nullable().optional(),
  code_hosting_choice: z.enum(['github', 'goblin_cloud']).nullable().optional(),
  deploy_choice: z.enum(['vercel', 'preview_only', 'skip']).nullable().optional(),
  skipped_steps: z.array(z.number()).optional(),
});

// GET /api/onboarding/state
onboarding.get('/state', async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('onboarding_steps')
    .select('*')
    .eq('user_id', userId)
    .single();
  return c.json(data ?? { current_step: 0, completed: false });
});

// PUT /api/onboarding/state
onboarding.put('/state', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const result = stateSchema.safeParse(body);
  if (!result.success) return c.json({ error: 'Invalid state' }, 400);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('onboarding_steps')
    .upsert({ user_id: userId, ...result.data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

export { onboarding };
