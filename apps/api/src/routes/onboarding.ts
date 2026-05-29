import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { getFallbackChain, saveFallbackChain } from '../services/model-router';

// Default fallback chain seeded once when onboarding completes.
// Matches the preview shown in /welcome/routing step 3:
//   01 — Anthropic (Claude Sonnet 4.6, BYOK)
//   02 — Google   (Gemini 2.5 Pro, BYOK)
//   03 — Block (stop here)
// Uses provider slugs from PROVIDER_OPTIONS in
// apps/web/app/dashboard/settings/routing/page.tsx.
const DEFAULT_FALLBACK_CHAIN = ['anthropic', 'google', '__block__'];

async function seedDefaultChainIfMissing(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  try {
    const existing = await getFallbackChain(userId, supabase);
    if (existing && existing.length > 0) return; // idempotent — never overwrite
    await saveFallbackChain(userId, DEFAULT_FALLBACK_CHAIN, supabase);
  } catch {
    // Non-blocking — user can configure manually from settings if seeding fails.
  }
}

type Variables = { userId: string };
const onboarding = new Hono<{ Variables: Variables }>();

onboarding.use('*', authMiddleware);

// Tools selection shape from /welcome/tools step. Storage-only; no run-time
// consumer wires this into chat/run behaviour yet — see TASK B scope note.
const toolsSelectionSchema = z.object({
  preset: z.enum(['indie', 'starter', 'all_on']),
  tools: z.array(z.string().max(40)).max(40),
}).nullable();

const stateSchema = z.object({
  current_step: z.number().min(0).max(5).optional(),
  completed: z.boolean().optional(),
  goal: z.string().max(200).nullable().optional(),
  ai_provider_choice: z.enum(['byok', 'no_key', 'free_tier']).nullable().optional(),
  code_hosting_choice: z.enum(['github', 'goblin_cloud']).nullable().optional(),
  deploy_choice: z.enum(['vercel', 'preview_only', 'skip']).nullable().optional(),
  skipped_steps: z.array(z.number()).optional(),
  tools_selection: toolsSelectionSchema.optional(),
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

  // Mirror completion to users table (requires migration 0034) +
  // seed the default fallback chain idempotently.
  if (result.data.completed === true) {
    await supabase
      .from('users')
      .update({ onboarding_completed: true })
      .eq('id', userId);
    await seedDefaultChainIfMissing(userId);
  }

  return c.json(data);
});

export { onboarding };
