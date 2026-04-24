import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createKey, listKeys, revokeKey } from '../services/byok-service';
import { CreateByokKeySchema, UpdateByokKeySchema } from '@goblin/shared/src/schemas';

const byokKeys = new Hono();

byokKeys.use('*', authMiddleware);

byokKeys.get('/', async (c) => {
  const userId = c.get('userId');
  const keys = await listKeys(userId);
  return c.json(keys);
});

byokKeys.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const result = CreateByokKeySchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid request' }, 400);
  }

  try {
    const key = await createKey(userId, result.data.provider, result.data.label, result.data.key);
    return c.json(key, 201);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed to add key' }, 400);
  }
});

byokKeys.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const keyId = c.req.param('id');

  try {
    await revokeKey(userId, keyId);
    return c.json({ success: true });
  } catch {
    return c.json({ error: 'Failed to revoke key' }, 400);
  }
});

byokKeys.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const keyId = c.req.param('id');
  const body = await c.req.json();

  const result = UpdateByokKeySchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid request' }, 400);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('byok_keys')
    .update({ label: result.data.label })
    .eq('id', keyId)
    .eq('user_id', userId)
    .select('id, user_id, provider, label, status, last_used, created_at')
    .single()
    .throwOnError();

  return c.json(data);
});

export { byokKeys };