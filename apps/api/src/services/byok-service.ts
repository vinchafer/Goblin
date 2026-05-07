import type { ByokProvider, CreateByokKey, ByokKey } from '@goblin/shared/src/schemas';
import { getSupabaseAdmin } from '../lib/supabase';
import { encryptData, decryptData } from './encryption';

export type ValidationResult = 'valid' | 'invalid' | 'timeout' | 'unsupported' | 'error';

const VALIDATION_TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export async function validateKey(provider: ByokProvider, rawKey: string): Promise<ValidationResult> {
  try {
    switch (provider) {
      case 'anthropic': {
        // Use messages.create with claude-haiku-3-5 + max_tokens: 1 (cheapest validation)
        const response = await fetchWithTimeout(
          'https://api.anthropic.com/v1/messages',
          {
            method: 'POST',
            headers: {
              'x-api-key': rawKey,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-3-5-haiku-latest',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'hi' }],
            }),
          },
          VALIDATION_TIMEOUT_MS
        );
        if (response.ok) return 'valid';
        if (response.status === 401 || response.status === 403) return 'invalid';
        return 'error';
      }

      case 'openai': {
        // Use models.list() — no token consumption
        const response = await fetchWithTimeout(
          'https://api.openai.com/v1/models',
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${rawKey}`,
            },
          },
          VALIDATION_TIMEOUT_MS
        );
        if (response.ok) return 'valid';
        if (response.status === 401 || response.status === 403) return 'invalid';
        return 'error';
      }

      case 'google': {
        const response = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${rawKey}`,
          { method: 'GET' },
          VALIDATION_TIMEOUT_MS
        );
        if (response.ok) return 'valid';
        if (response.status === 401 || response.status === 403) return 'invalid';
        return 'error';
      }

      case 'groq': {
        const response = await fetchWithTimeout(
          'https://api.groq.com/openai/v1/models',
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${rawKey}`,
            },
          },
          VALIDATION_TIMEOUT_MS
        );
        if (response.ok) return 'valid';
        if (response.status === 401 || response.status === 403) return 'invalid';
        return 'error';
      }

      case 'mistral': {
        const response = await fetchWithTimeout(
          'https://api.mistral.ai/v1/models',
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${rawKey}`,
            },
          },
          VALIDATION_TIMEOUT_MS
        );
        if (response.ok) return 'valid';
        if (response.status === 401 || response.status === 403) return 'invalid';
        return 'error';
      }

      case 'deepseek': {
        const response = await fetchWithTimeout(
          'https://api.deepseek.com/models',
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${rawKey}`,
            },
          },
          VALIDATION_TIMEOUT_MS
        );
        if (response.ok) return 'valid';
        if (response.status === 401 || response.status === 403) return 'invalid';
        return 'error';
      }

      case 'xai': {
        const response = await fetchWithTimeout(
          'https://api.x.ai/v1/models',
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${rawKey}`,
            },
          },
          VALIDATION_TIMEOUT_MS
        );
        if (response.ok) return 'valid';
        if (response.status === 401 || response.status === 403) return 'invalid';
        return 'error';
      }

      case 'together': {
        const response = await fetchWithTimeout(
          'https://api.together.xyz/v1/models',
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${rawKey}`,
            },
          },
          VALIDATION_TIMEOUT_MS
        );
        if (response.ok) return 'valid';
        if (response.status === 401 || response.status === 403) return 'invalid';
        return 'error';
      }

      default:
        return 'unsupported';
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return 'timeout';
    }
    return 'error';
  }
}

// Keep testKey for backwards compatibility with existing callers
async function testKey(provider: ByokProvider, rawKey: string): Promise<{ valid: boolean; error?: string }> {
  const result = await validateKey(provider, rawKey);
  switch (result) {
    case 'valid':
      return { valid: true };
    case 'invalid':
      return { valid: false, error: 'Invalid API key' };
    case 'timeout':
      return { valid: false, error: 'Key validation timed out' };
    case 'unsupported':
      return { valid: false, error: 'Unsupported provider' };
    case 'error':
    default:
      return { valid: false, error: 'Failed to validate key' };
  }
}

export async function createKey(
  userId: string,
  provider: ByokProvider,
  label: string | undefined,
  rawKey: string
): Promise<ByokKey> {
  const supabase = getSupabaseAdmin();

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

  // Validate key before storing
  const testResult = await testKey(provider, rawKey);
  if (!testResult.valid) {
    throw new Error(testResult.error || 'Invalid key');
  }

  const encrypted = encryptData(rawKey);
  // Store last 4 chars for display — never more
  const keyHint = rawKey.slice(-4);
  const resolvedLabel = label?.trim() || provider;

  const { data } = await supabase
    .from('byok_keys')
    .insert({
      user_id: userId,
      provider,
      label: resolvedLabel,
      key_encrypted: encrypted,
      key_hint: keyHint,
      validated_at: new Date().toISOString(),
    })
    .select('id, user_id, provider, label, key_hint, status, last_used, created_at, validated_at')
    .single()
    .throwOnError();

  return data as ByokKey;
}

export async function listKeys(userId: string): Promise<ByokKey[]> {
  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from('byok_keys')
    .select('id, user_id, provider, label, key_hint, status, last_used, created_at, validated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return data as ByokKey[];
}

export async function revokeKey(userId: string, keyId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  await supabase
    .from('byok_keys')
    .update({ status: 'revoked' })
    .eq('id', keyId)
    .eq('user_id', userId)
    .throwOnError();
}

export async function getActiveKey(userId: string, provider: ByokProvider): Promise<string | null> {
  const supabase = getSupabaseAdmin();

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

  return decryptData(data.key_encrypted);
}

export { testKey };