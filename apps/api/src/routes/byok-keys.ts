import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { createKey, listKeys, revokeKey } from '../services/byok-service';
import { CreateByokKeySchema, UpdateByokKeySchema } from '@goblin/shared/src/schemas';
import { invalidateModelCache } from './models';

type Variables = { userId: string }
const byokKeys = new Hono<{ Variables: Variables }>();

byokKeys.use('*', authMiddleware);

byokKeys.get('/', async (c) => {
  try {
    const userId = c.get('userId');
    const keys = await listKeys(userId);
    return c.json(keys);
  } catch {
    return c.json({ error: 'Failed to fetch keys' }, 500);
  }
});

byokKeys.get('/has-any', async (c) => {
  try {
    const userId = c.get('userId');
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from('byok_keys')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (error) return c.json({ exists: false }, 200);
    return c.json({ exists: (count ?? 0) > 0 });
  } catch {
    return c.json({ exists: false }, 200);
  }
});

byokKeys.post('/', async (c) => {
  try {
    const userId = c.get('userId');
    const body = await c.req.json();
    const result = CreateByokKeySchema.safeParse(body);
    if (!result.success) {
      return c.json({ error: 'Invalid request', details: result.error.flatten() }, 400);
    }
    const key = await createKey(userId, result.data.provider, result.data.label, result.data.key);
    invalidateModelCache(userId);

    // 14-5: end trial when the user adds their first key. Only acts if no
    // trial-end has been recorded yet; ignored on subsequent key additions.
    try {
      const supabase = getSupabaseAdmin();
      await supabase
        .from('users')
        .update({ trial_ended_at: new Date().toISOString(), trial_end_reason: 'key_added' })
        .eq('id', userId)
        .is('trial_ended_at', null);
    } catch {
      /* non-blocking — soft-limit middleware re-evaluates on next request */
    }

    return c.json(key, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create key';
    // 400 for validation errors (invalid key, max keys reached), 500 for DB errors
    const isValidationError = msg.includes('Invalid') || msg.includes('Maximum') || msg.includes('timed out');
    return c.json({ error: msg }, isValidationError ? 400 : 500);
  }
});

byokKeys.delete('/:id', async (c) => {
  try {
    const userId = c.get('userId');
    const keyId = c.req.param('id');
    await revokeKey(userId, keyId);
    invalidateModelCache(userId);
    return c.json({ success: true });
  } catch {
    return c.json({ error: 'Failed to revoke key' }, 500);
  }
});

byokKeys.patch('/:id', async (c) => {
  try {
    const userId = c.get('userId');
    const keyId = c.req.param('id');
    const body = await c.req.json();
    const result = UpdateByokKeySchema.safeParse(body);
    if (!result.success) {
      return c.json({ error: 'Invalid request' }, 400);
    }

    const supabase = getSupabaseAdmin();
    const { data: updated, error } = await supabase
      .from('byok_keys')
      .update({ label: result.data.label })
      .eq('id', keyId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !updated) {
      return c.json({ error: 'Key not found' }, 404);
    }

    return c.json(updated);
  } catch {
    return c.json({ error: 'Failed to update key' }, 500);
  }
});

export { byokKeys };
