import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { trackEvent } from '../lib/platform-events';
import { sanitizeContext, sendImmediateFeedback, type FeedbackCategory } from '../services/feedback';

type Variables = { userId: string };
const feedback = new Hono<{ Variables: Variables }>();
feedback.use('*', authMiddleware);

const bodySchema = z.object({
  category: z.enum(['bug', 'idea', 'other']),
  body: z.string().min(1).max(4000),
  // Context is metadata-only; the server re-sanitizes regardless of what's sent.
  context: z.record(z.unknown()).optional(),
  surface: z.string().max(40).optional(),
});

// POST /api/feedback  → persists + emits feedback_submitted + (bug) immediate email
feedback.post('/', async (c) => {
  const userId = c.get('userId');
  const parsed = bodySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'invalid' }, 400);

  const category = parsed.data.category as FeedbackCategory;
  const context = sanitizeContext(parsed.data.context);
  const surface = parsed.data.surface ?? null;
  const supabase = getSupabaseAdmin();

  // feedback_submitted funnel signal — METADATA ONLY (category/surface), never the
  // free-text body. Fire-and-forget.
  trackEvent({ eventType: 'feedback_submitted', userId, meta: { category, surface: surface ?? undefined } });

  // Persist (pre-migration tolerant — silent-fail if the table isn't applied yet).
  const { error } = await supabase.from('feedback').insert({
    user_id: userId,
    category,
    body: parsed.data.body,
    context,
    surface,
  });
  if (error) {
    // Never surface a DB/migration state as a user error — the event already fired.
    // (Table absent pre-0087 or an RLS hiccup degrades to no-op.)
  }

  // Bug → immediate founder email; idea/other ride the daily digest (cron).
  if (category === 'bug') {
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const userEmail = userData?.user?.email ?? '';
    void sendImmediateFeedback({ userId, userEmail, category, body: parsed.data.body, context, surface: surface ?? undefined })
      .catch(() => {});
  }

  return c.json({ ok: true }, 201);
});

export { feedback };
