import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { getSupabaseAdmin } from './supabase';
import logger from './logger';
import {
  encryptUserData,
  decryptUserData,
  decryptData,
} from '../services/encryption';

// Tier 2 BYOK encryption — per-user KEK in Supabase Vault.
//
// Storage layout (byok_keys.key_encrypted, base64-encoded blob):
//   iv (16 bytes) || authTag (16 bytes) || ciphertext
//
// The byok_keys.encryption_version column selects the key derivation path:
//   v1 — legacy scrypt(ENCRYPTION_KEY, users.encryption_salt). Stays readable
//         until every v1 row has lazy-migrated to v2.
//   v2 — AES-256-GCM with the user's KEK read from vault.secrets via the
//         get_or_create_user_kek / read_user_kek RPCs.

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
export const CURRENT_ENCRYPTION_VERSION = 2;

export interface EncryptResult {
  ciphertextB64: string;
  vaultSecretId: string;
  version: number;
}

export interface DecryptInput {
  ciphertextB64: string;
  version: number;
  vaultSecretId?: string | null;
  userSaltB64?: string | null;
}

export interface DecryptContext {
  ipAddress?: string;
  userAgent?: string;
  provider: string;
}

async function getOrCreateKekId(userId: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('get_or_create_user_kek', { p_user_id: userId });
  if (error || !data) {
    throw new Error(`Could not resolve user KEK: ${error?.message ?? 'unknown'}`);
  }
  return data as string;
}

async function readKekPlaintext(secretId: string): Promise<Buffer> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('read_user_kek', { p_secret_id: secretId });
  if (error || !data) {
    throw new Error(`Could not read user KEK: ${error?.message ?? 'unknown'}`);
  }
  const buf = Buffer.from(data as string, 'base64');
  if (buf.length !== 32) {
    throw new Error(`Invalid KEK length: ${buf.length}, expected 32`);
  }
  return buf;
}

/**
 * Seal plaintext with the user's KEK from Vault. Produces a v2 blob that
 * lives in byok_keys.key_encrypted alongside vault_secret_id and
 * encryption_version=2.
 */
export async function encryptApiKeyV2(userId: string, plaintext: string): Promise<EncryptResult> {
  const vaultSecretId = await getOrCreateKekId(userId);
  const kek = await readKekPlaintext(vaultSecretId);

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, kek, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertextB64: Buffer.concat([iv, authTag, ciphertext]).toString('base64'),
    vaultSecretId,
    version: CURRENT_ENCRYPTION_VERSION,
  };
}

function unsealV2Blob(kek: Buffer, blobB64: string): string {
  let normalized = blobB64;
  if (normalized.startsWith('\\x')) {
    normalized = Buffer.from(normalized.slice(2), 'hex').toString('utf-8');
  }
  const data = Buffer.from(normalized, 'base64');
  const iv = data.subarray(0, 16);
  const authTag = data.subarray(16, 32);
  const ciphertext = data.subarray(32);
  const decipher = createDecipheriv(ALGORITHM, kek, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8');
}

/**
 * Decrypt v1 or v2. v1 hits the legacy scrypt path; v2 hits Vault. After a
 * successful v1 decrypt we re-encrypt to v2 lazily and persist the new blob
 * back to byok_keys (best-effort — a re-encrypt failure does not block the
 * caller's read).
 */
export async function decryptApiKey(
  userId: string,
  byokKeyId: string | null,
  input: DecryptInput,
  context: DecryptContext,
): Promise<{ plaintext: string; reencrypted: boolean }> {
  let plaintext = '';
  let reencrypted = false;

  try {
    if (input.version === 2) {
      if (!input.vaultSecretId) {
        throw new Error('v2 blob is missing vault_secret_id');
      }
      const kek = await readKekPlaintext(input.vaultSecretId);
      plaintext = unsealV2Blob(kek, input.ciphertextB64);
    } else {
      // v1 — scrypt-derived key, optionally with user salt.
      try {
        if (input.userSaltB64) {
          plaintext = decryptUserData(input.ciphertextB64, input.userSaltB64);
        } else {
          plaintext = decryptData(input.ciphertextB64);
        }
      } catch {
        // Some pre-Z2 rows have no user salt — try the global path.
        plaintext = decryptData(input.ciphertextB64);
      }

      try {
        if (byokKeyId) {
          const v2 = await encryptApiKeyV2(userId, plaintext);
          const supabase = getSupabaseAdmin();
          await supabase
            .from('byok_keys')
            .update({
              key_encrypted: v2.ciphertextB64,
              vault_secret_id: v2.vaultSecretId,
              encryption_version: v2.version,
            })
            .eq('id', byokKeyId);
          reencrypted = true;
          await logDecrypt(userId, byokKeyId, context, 'reencrypt');
        }
      } catch (e) {
        logger.warn(
          { userIdHash: hashId(userId), error: (e as Error).message },
          'byok: lazy v1->v2 reencrypt failed (read still succeeded)',
        );
      }
    }

    await logDecrypt(userId, byokKeyId, context, 'decrypt_success');
    return { plaintext, reencrypted };
  } catch (e) {
    await logDecrypt(userId, byokKeyId, context, 'decrypt_fail', (e as Error).message);
    throw e;
  }
}

async function logDecrypt(
  userId: string,
  byokKeyId: string | null,
  context: DecryptContext,
  operation: 'decrypt_success' | 'decrypt_fail' | 'reencrypt',
  errorMsg?: string,
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('byok_decrypt_log').insert({
      user_id: userId,
      byok_key_id: byokKeyId,
      provider: context.provider,
      operation,
      ip_address: context.ipAddress ?? null,
      user_agent: context.userAgent ?? null,
      metadata: errorMsg ? { error: errorMsg } : {},
    });
  } catch (e) {
    logger.warn({ error: (e as Error).message }, 'byok decrypt log insert failed');
  }
}

function hashId(id: string): string {
  return createHash('sha256').update(id).digest('hex').slice(0, 12);
}
