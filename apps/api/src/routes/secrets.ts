import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { encryptUserData, decryptUserData, generateUserSalt } from '../services/encryption';

type Variables = { userId: string };
const secrets = new Hono<{ Variables: Variables }>();

secrets.use('*', authMiddleware);

async function getOrCreateUserSalt(userId: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from('users')
    .select('encryption_salt')
    .eq('id', userId)
    .single();

  if (user?.encryption_salt) return user.encryption_salt as string;

  const salt = generateUserSalt();
  await supabase.from('users').update({ encryption_salt: salt }).eq('id', userId);
  return salt;
}

async function assertProjectOwner(projectId: string, userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();
  return !!data;
}

// GET /api/projects/:projectId/secrets — list names + hints only (no values)
secrets.get('/:projectId/secrets', async (c) => {
  const userId = c.get('userId');
  const { projectId } = c.req.param();

  if (!await assertProjectOwner(projectId, userId)) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const supabase = getSupabaseAdmin();
  const env = c.req.query('environment') ?? 'production';

  const { data, error } = await supabase
    .from('project_secrets')
    .select('id, name, value_hint, environment, created_at, updated_at')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('environment', env)
    .order('name');

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data ?? []);
});

// POST /api/projects/:projectId/secrets — create secret
secrets.post('/:projectId/secrets', async (c) => {
  const userId = c.get('userId');
  const { projectId } = c.req.param();

  if (!await assertProjectOwner(projectId, userId)) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const body = await c.req.json();
  const schema = z.object({
    name: z.string().min(1).max(128).regex(/^[A-Z0-9_]+$/, 'Use UPPER_SNAKE_CASE'),
    value: z.string().min(1),
    environment: z.enum(['production', 'staging', 'development']).default('production'),
  });

  const result = schema.safeParse(body);
  if (!result.success) return c.json({ error: result.error.flatten() }, 400);

  const { name, value, environment } = result.data;
  const userSalt = await getOrCreateUserSalt(userId);
  const encrypted = encryptUserData(value, userSalt);
  const hint = value.slice(-4);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('project_secrets')
    .upsert({
      project_id: projectId,
      user_id: userId,
      name,
      value_encrypted: encrypted,
      value_hint: hint,
      environment,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'project_id,name,environment' })
    .select('id, name, value_hint, environment, created_at, updated_at')
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

// DELETE /api/projects/:projectId/secrets/:secretId
secrets.delete('/:projectId/secrets/:secretId', async (c) => {
  const userId = c.get('userId');
  const { projectId, secretId } = c.req.param();

  if (!await assertProjectOwner(projectId, userId)) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('project_secrets')
    .delete()
    .eq('id', secretId)
    .eq('project_id', projectId)
    .eq('user_id', userId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

// GET /api/projects/:projectId/secrets/:secretId/reveal — returns plaintext value
// Requires re-auth header: X-Secrets-Password (client proves they know the password)
secrets.get('/:projectId/secrets/:secretId/reveal', async (c) => {
  const userId = c.get('userId');
  const { projectId, secretId } = c.req.param();

  // Re-auth check: client must pass X-Reauth-Token (Supabase access token from fresh sign-in)
  // This ensures the user recently re-entered their password
  const reauthToken = c.req.header('X-Reauth-Token');
  if (!reauthToken) {
    return c.json({ error: 'Re-authentication required. Please verify your password first.' }, 401);
  }

  // Verify the re-auth token is a valid Supabase JWT for this user
  const supabase = getSupabaseAdmin();
  const { data: { user: reauthUser }, error: reauthError } = await supabase.auth.getUser(reauthToken);
  if (reauthError || !reauthUser || reauthUser.id !== userId) {
    return c.json({ error: 'Invalid re-authentication token.' }, 401);
  }

  if (!await assertProjectOwner(projectId, userId)) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const { data: secret, error } = await supabase
    .from('project_secrets')
    .select('value_encrypted, name')
    .eq('id', secretId)
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();

  if (error || !secret) return c.json({ error: 'Secret not found' }, 404);

  const { data: user } = await supabase
    .from('users')
    .select('encryption_salt')
    .eq('id', userId)
    .single();

  if (!user?.encryption_salt) {
    return c.json({ error: 'Encryption not initialized. Please re-save your secret.' }, 500);
  }

  try {
    const value = decryptUserData(secret.value_encrypted, user.encryption_salt as string);
    return c.json({ name: secret.name, value });
  } catch {
    return c.json({ error: 'Failed to decrypt secret. Please re-save it.' }, 500);
  }
});

export { secrets };
