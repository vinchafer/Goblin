import { createClient } from '@supabase/supabase-js';
import type { ByokProvider, CreateByokKey, ByokKey } from '@goblin/shared/src/schemas';
import { encryptKey, decryptKey } from './encryption';

async function testKey(provider: ByokProvider, rawKey: string): Promise<{ valid: boolean; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    let url: string;
    let headers: Record<string, string>;

    if (provider === 'anthropic') {
      url = 'https://api.anthropic.com/v1/models';
      headers = {
        'x-api-key': rawKey,
        'anthropic-version': '2023-06-01'
      };
    } else if (provider === 'openai') {
      url = 'https://api.openai.com/v1/models';
      headers = {
        'Authorization': `Bearer ${rawKey}`
      };
    } else {
      return { valid: false, error: 'Unsupported provider' };
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal
    });

    clearTimeout(timeout);
    return response.ok
      ? { valid: true }
      : { valid: false, error: 'Invalid API key' };
  } catch {
    clearTimeout(timeout);
    return { valid: false, error: 'Failed to validate key' };
  }
}

export async function createKey(
  userId: string,
  provider: ByokProvider,
  label: string,
  rawKey: string
): Promise<ByokKey> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check rate limit: max 5 keys per provider
  const { count } = await supabase
    .from('byok_keys')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('status', 'active');

  if (count && count >= 5) {
    throw new Error('Maximum 5 keys per provider');
  }

  // Test key before storing
  const testResult = await testKey(provider, rawKey);
  if (!testResult.valid) {
    throw new Error(testResult.error || 'Invalid key');
  }

  const encrypted = await encryptKey(rawKey);

  const { data } = await supabase
    .from('byok_keys')
    .insert({
      user_id: userId,
      provider,
      label,
      key_encrypted: encrypted
    })
    .select('id, user_id, provider, label, status, last_used, created_at')
    .single()
    .throwOnError();

  return data as ByokKey;
}

export async function listKeys(userId: string): Promise<ByokKey[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('byok_keys')
    .select('id, user_id, provider, label, status, last_used, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return data as ByokKey[];
}

export async function revokeKey(userId: string, keyId: string): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase
    .from('byok_keys')
    .update({ status: 'revoked' })
    .eq('id', keyId)
    .eq('user_id', userId)
    .throwOnError();
}

export async function getActiveKey(userId: string, provider: ByokProvider): Promise<string | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('byok_keys')
    .select('key_encrypted')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('status', 'active')
    .order('last_used', { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;

  return decryptKey(data.key_encrypted);
}

export { testKey };