import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// Legacy: global key with static salt — kept for backward compat (reading old encrypted data)
function deriveKey(): Buffer {
  const masterKey = process.env.ENCRYPTION_KEY;
  if (!masterKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  return scryptSync(masterKey, 'goblin-salt-v1', 32);
}

// Per-user key derived from master key + user-specific random salt (Phase Z2)
function deriveUserKey(userSalt: Buffer): Buffer {
  const masterKey = process.env.ENCRYPTION_KEY;
  if (!masterKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  return scryptSync(masterKey, userSalt, 32);
}

function aesGcmEncrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf-8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  // Layout: iv (16) + authTag (16) + ciphertext
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function aesGcmDecrypt(encryptedBase64: string, key: Buffer): string {
  // Handle PostgreSQL BYTEA hex-escape format (\x{hex}) returned by PostgREST
  let base64 = encryptedBase64;
  if (typeof encryptedBase64 === 'string' && encryptedBase64.startsWith('\\x')) {
    base64 = Buffer.from(encryptedBase64.slice(2), 'hex').toString('utf-8');
  }
  const data = Buffer.from(base64, 'base64');

  const iv = data.subarray(0, 16);
  const authTag = data.subarray(16, 32);
  const ciphertext = data.subarray(32);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8');
}

// ─── Legacy API (static salt) — backward compat for existing encrypted data ──

export function encryptData(plaintext: string): string {
  return aesGcmEncrypt(plaintext, deriveKey());
}

export function decryptData(encryptedBase64: string): string {
  try {
    return aesGcmDecrypt(encryptedBase64, deriveKey());
  } catch (err) {
    const inputType = typeof encryptedBase64 === 'string'
      ? (encryptedBase64.startsWith('\\x') ? 'bytea-hex' : 'base64')
      : typeof encryptedBase64;
    console.error('[encryption] decryptData failed', {
      inputType,
      inputLength: typeof encryptedBase64 === 'string' ? encryptedBase64.length : 0,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new Error('Decryption failed — key may be invalid or data is corrupted');
  }
}

// ─── Per-user-salt API (Phase Z2) ────────────────────────────────────────────

export function generateUserSalt(): string {
  return randomBytes(32).toString('base64');
}

export function encryptUserData(plaintext: string, userSaltBase64: string): string {
  const userSalt = Buffer.from(userSaltBase64, 'base64');
  return aesGcmEncrypt(plaintext, deriveUserKey(userSalt));
}

export function decryptUserData(encryptedBase64: string, userSaltBase64: string): string {
  try {
    const userSalt = Buffer.from(userSaltBase64, 'base64');
    return aesGcmDecrypt(encryptedBase64, deriveUserKey(userSalt));
  } catch (err) {
    const inputType = typeof encryptedBase64 === 'string'
      ? (encryptedBase64.startsWith('\\x') ? 'bytea-hex' : 'base64')
      : typeof encryptedBase64;
    console.error('[encryption] decryptUserData failed', {
      inputType,
      inputLength: typeof encryptedBase64 === 'string' ? encryptedBase64.length : 0,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new Error('Decryption failed — key may be invalid or data is corrupted');
  }
}
