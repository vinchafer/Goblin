import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createClient } from '@supabase/supabase-js';
import { createKey, listKeys, revokeKey } from '../services/byok-service';
import { CreateByokKeySchema, UpdateByokKeySchema } from '@goblin/shared/src/schemas';

type Variables = { userId: string }
const byokKeys = new Hono<{ Variables: Variables }>();

byokKeys.use('*', authMiddleware);

byokKeys.get('/', async (c) => {
  const userId = c.get('userId');
  const keys = await listKeys(userId);
  return c.json(keys);
});

byokKeys.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const data = CreateByokKeySchema.parse(body);
  
  const key = await createKey(userId, data.provider, data.label, data.key);
  return c.json(key, 201);
});

byokKeys.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const keyId = c.req.param('id');
  
  await revokeKey(userId, keyId);
  return c.json({ success: true });
});

byokKeys.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const keyId = c.req.param('id');
  const body = await c.req.json();
  const data = UpdateByokKeySchema.parse(body);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: updated } = await supabase
    .from('byok_keys')
    .update({ label: data.label })
    .eq('id', keyId)
    .eq('user_id', userId)
    .select()
    .single();

  return c.json(updated);
});

export { byokKeys };