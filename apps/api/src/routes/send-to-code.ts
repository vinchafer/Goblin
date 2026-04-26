import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';

type Variables = { userId: string }
const sendToCode = new Hono<{ Variables: Variables }>();

sendToCode.use('*', authMiddleware);

const SendToCodeSchema = z.object({
  projectId: z.string().uuid(),
  messageId: z.string().uuid().optional(),
  payload: z.string().min(1).max(50000),
  payloadType: z.enum(['code', 'prompt', 'mixed']),
  filename: z.string().optional(),
});

sendToCode.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const result = SendToCodeSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid request', details: result.error.flatten() }, 400);
  }

  const { projectId, messageId, payload, payloadType, filename } = result.data;
  const supabase = getSupabaseAdmin();

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (projectError || !project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const { data: injection, error: insertError } = await supabase
    .from('code_injections')
    .insert({
      project_id: projectId,
      message_id: messageId ?? null,
      payload,
      payload_type: payloadType,
      filename_hint: filename ?? null,
      user_id: userId,
    })
    .select('id')
    .single();

  if (insertError) {
    return c.json({ error: 'Failed to create injection' }, 500);
  }

  return c.json({ id: injection.id, success: true }, 201);
});

export { sendToCode };
