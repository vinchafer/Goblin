import type { ByokProvider, CreateByokKey, ByokKey } from '@goblin/shared/src/schemas';
import { getSupabaseAdmin } from '../lib/supabase';
import {
  encryptData, decryptData,
  encryptUserData, decryptUserData, generateUserSalt
} from './encryption';
import { encryptApiKeyV2, decryptApiKey } from '../lib/byok-encryption';

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

export async function validateKey(
  provider: ByokProvider,
  rawKey: string,
  baseURL?: string,
): Promise<ValidationResult> {
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

      case 'custom': {
        // OpenAI-compatible endpoint supplied by the user. Probe /models.
        if (!baseURL) return 'invalid';
        const base = baseURL.replace(/\/$/, '');
        const url = `${base}/models`;
        const response = await fetchWithTimeout(
          url,
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

// Keep testKey for backwards compatibility with existing callers.
// baseURL is required when provider === 'custom'; ignored otherwise.
async function testKey(
  provider: ByokProvider,
  rawKey: string,
  baseURL?: string,
): Promise<{ valid: boolean; error?: string }> {
  if (provider === 'custom' && !baseURL) {
    return { valid: false, error: 'Base URL required for a custom provider' };
  }
  const result = await validateKey(provider, rawKey, baseURL);
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

async function getOrCreateUserSalt(userId: string): Promise<string> {
  const supabase = getSupabaseAdmin();

  const { data: user } = await supabase
    .from('users')
    .select('encryption_salt')
    .eq('id', userId)
    .single();

  if (user?.encryption_salt) {
    return user.encryption_salt as string;
  }

  const salt = generateUserSalt();
  await supabase
    .from('users')
    .update({ encryption_salt: salt })
    .eq('id', userId);

  return salt;
}

export async function createKey(
  userId: string,
  provider: ByokProvider,
  label: string | undefined,
  rawKey: string,
  baseURL?: string,
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
  const testResult = await testKey(provider, rawKey, baseURL);
  if (!testResult.valid) {
    throw new Error(testResult.error || 'Invalid key');
  }

  // 11B-1: New keys go straight to v2 (Vault-managed KEK). Existing v1 rows
  // lazy-migrate on first decrypt via decryptApiKey().
  let encryptedBlob: string;
  let vaultSecretId: string | null = null;
  let encryptionVersion = 1;
  try {
    const v2 = await encryptApiKeyV2(userId, rawKey);
    encryptedBlob = v2.ciphertextB64;
    vaultSecretId = v2.vaultSecretId;
    encryptionVersion = v2.version;
  } catch {
    // Vault not yet provisioned / RPC missing — fall back to v1 (legacy).
    const userSalt = await getOrCreateUserSalt(userId);
    encryptedBlob = encryptUserData(rawKey, userSalt);
  }
  // Store last 4 chars for display — never more
  const keyHint = rawKey.slice(-4);
  const resolvedLabel = label?.trim() || provider;

  const insertData: Record<string, unknown> = {
    user_id: userId,
    provider,
    key_encrypted: encryptedBlob,
    key_hint: keyHint,
    validated_at: new Date().toISOString(),
    encryption_version: encryptionVersion,
    vault_secret_id: vaultSecretId,
  };
  if (provider === 'custom' && baseURL) {
    insertData.base_url = baseURL;
  }

  const { data } = await supabase
    .from('byok_keys')
    .insert(insertData)
    .select('id, user_id, provider, key_hint, status, last_used, created_at, validated_at')
    .single()
    .throwOnError();

  // Backfill label in a separate update — tolerates schema cache lag
  if (data) {
    try {
      await supabase
        .from('byok_keys')
        .update({ label: resolvedLabel })
        .eq('id', (data as { id: string }).id);
    } catch { /* label column may not exist yet — non-fatal */ }
  }

  return data as ByokKey;
}

export async function listKeys(userId: string): Promise<ByokKey[]> {
  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from('byok_keys')
    .select('id, user_id, provider, key_hint, status, last_used, created_at, validated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return (data ?? []) as ByokKey[];
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
  return getActiveKeyByProvider(userId, provider);
}

/**
 * Like getActiveKey but accepts any provider string (incl. connection providers such as
 * 'vercel' that are not LLM ByokProviders). Shares the canonical v1/v2 decryption so tokens
 * stored via the BYOK encryption flow are decryptable everywhere.
 */
export async function getActiveKeyByProvider(userId: string, provider: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();

  const [keyResult, userResult] = await Promise.all([
    supabase
      .from('byok_keys')
      .select('id, key_encrypted, encryption_version, vault_secret_id')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('status', 'active')
      .order('last_used', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('users')
      .select('encryption_salt')
      .eq('id', userId)
      .single(),
  ]);

  if (!keyResult.data) return null;

  const userSalt = (userResult.data?.encryption_salt as string | null) ?? null;
  const row = keyResult.data as {
    id: string;
    key_encrypted: string;
    encryption_version: number | null;
    vault_secret_id: string | null;
  };

  try {
    const { plaintext } = await decryptApiKey(
      userId,
      row.id,
      {
        ciphertextB64: row.key_encrypted,
        version: row.encryption_version ?? 1,
        vaultSecretId: row.vault_secret_id,
        userSaltB64: userSalt,
      },
      { provider },
    );
    return plaintext;
  } catch {
    throw new Error('API key needs to be re-entered. Please go to Settings → API Keys.');
  }
}

// ── Vercel connection (deploy token) ──────────────────────────────────────────
// 'vercel' is a CONNECTION provider, deliberately kept out of the LLM ByokProviderSchema so
// it never pollutes model lists. Stored in byok_keys (provider='vercel') with the same
// canonical v1/v2 encryption, so vercel-service can decrypt it via getActiveKeyByProvider.

export interface VercelAccount { username: string; email?: string }

export async function validateVercelToken(
  token: string,
): Promise<{ valid: boolean; account?: VercelAccount; error?: string }> {
  try {
    const res = await fetchWithTimeout(
      'https://api.vercel.com/v2/user',
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
      VALIDATION_TIMEOUT_MS,
    );
    if (res.ok) {
      const j = (await res.json()) as { user?: { username?: string; email?: string }; username?: string; email?: string };
      const u = j.user ?? j;
      return { valid: true, account: { username: u.username ?? 'unknown', email: u.email } };
    }
    if (res.status === 401 || res.status === 403) return { valid: false, error: 'Invalid token' };
    return { valid: false, error: `Vercel API error ${res.status}` };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return { valid: false, error: 'Validation timed out' };
    return { valid: false, error: 'Validation failed' };
  }
}

export async function storeVercelToken(userId: string, token: string): Promise<{ account: VercelAccount }> {
  const v = await validateVercelToken(token);
  if (!v.valid) throw new Error(v.error || 'Invalid Vercel token');

  const supabase = getSupabaseAdmin();
  // Single active connection: revoke any existing active vercel key first.
  await supabase
    .from('byok_keys')
    .update({ status: 'revoked' })
    .eq('user_id', userId)
    .eq('provider', 'vercel')
    .eq('status', 'active');

  let encryptedBlob: string;
  let vaultSecretId: string | null = null;
  let encryptionVersion = 1;
  try {
    const v2 = await encryptApiKeyV2(userId, token);
    encryptedBlob = v2.ciphertextB64;
    vaultSecretId = v2.vaultSecretId;
    encryptionVersion = v2.version;
  } catch {
    const userSalt = await getOrCreateUserSalt(userId);
    encryptedBlob = encryptUserData(token, userSalt);
  }

  await supabase
    .from('byok_keys')
    .insert({
      user_id: userId,
      provider: 'vercel',
      key_encrypted: encryptedBlob,
      key_hint: token.slice(-4),
      validated_at: new Date().toISOString(),
      encryption_version: encryptionVersion,
      vault_secret_id: vaultSecretId,
    })
    .throwOnError();

  return { account: v.account! };
}

export async function getVercelConnection(userId: string): Promise<{ connected: boolean; account?: VercelAccount }> {
  const token = await getActiveKeyByProvider(userId, 'vercel');
  if (!token) return { connected: false };
  const v = await validateVercelToken(token);
  return v.valid ? { connected: true, account: v.account } : { connected: false };
}

export async function disconnectVercel(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    .from('byok_keys')
    .update({ status: 'revoked' })
    .eq('user_id', userId)
    .eq('provider', 'vercel')
    .eq('status', 'active')
    .throwOnError();
}

export { testKey };