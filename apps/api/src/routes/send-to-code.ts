import { Hono } from 'hono';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth';

type Variables = { userId: string }
const sendToCode = new Hono<{ Variables: Variables }>();

sendToCode.use('*', authMiddleware);

const SendToCodeSchema = z.object({
  projectId: z.string().uuid(),
  messageId: z.string().uuid(),
  payload: z.string().min(1),
  payloadType: z.enum(['code', 'prompt', 'mixed']),
});

sendToCode.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const result = SendToCodeSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid request', details: result.error.flatten() }, 400);
  }

  const { projectId, messageId, payload, payloadType } = result.data;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify project ownership
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (projectError || !project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Insert code injection
  const { data: injection, error: insertError } = await supabase
    .from('code_injections')
    .insert({
      project_id: projectId,
      message_id: messageId,
      payload,
      payload_type: payloadType,
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