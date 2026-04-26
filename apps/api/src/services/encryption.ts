import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

function deriveKey(): Buffer {
  const masterKey = process.env.ENCRYPTION_KEY;
  if (!masterKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  return scryptSync(masterKey, 'goblin-salt-v1', 32);
}

export function encryptData(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf-8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  // Concatenate: iv (16) + authTag (16) + ciphertext
  const result = Buffer.concat([iv, authTag, encrypted]);
  return result.toString('base64');
}

export function decryptData(encryptedBase64: string): string {
  try {
    const key = deriveKey();
    const data = Buffer.from(encryptedBase64, 'base64');

    const iv = data.subarray(0, 16);
    const authTag = data.subarray(16, 32);
    const ciphertext = data.subarray(32);

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);

    return decrypted.toString('utf-8');
  } catch {
    throw new Error('Decryption failed — key may be invalid or data is corrupted');
  }
}