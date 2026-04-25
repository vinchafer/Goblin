import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const masterKey = process.env.ENCRYPTION_KEY;
if (!masterKey) {
  throw new Error('ENCRYPTION_KEY environment variable is required');
}

const key = scryptSync(masterKey, 'goblin-salt-v1', 32);

export function encryptData(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, ciphertext]);

  return combined.toString('base64');
}

export function decryptData(encryptedBase64: string): string {
  try {
    const combined = Buffer.from(encryptedBase64, 'base64');

    const iv = combined.subarray(0, 16);
    const authTag = combined.subarray(16, 32);
    const ciphertext = combined.subarray(32);

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);

    return plaintext.toString('utf8');
  } catch (error) {
    throw new Error('Decryption failed — key may be invalid or data is corrupted');
  }
}