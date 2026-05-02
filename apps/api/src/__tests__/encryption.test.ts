import { describe, it, expect, beforeAll } from 'vitest';
import { encryptData, decryptData } from '../services/encryption.js';

beforeAll(() => {
  // 32-char key required by scryptSync → AES-256 key derivation
  process.env.ENCRYPTION_KEY = 'test-key-32-chars-padding-here-xx';
});

describe('encryption.ts — encryptData / decryptData', () => {
  describe('roundtrip', () => {
    it('decrypts back to the original plaintext', () => {
      const original = 'Hello, Goblin!';
      const ciphertext = encryptData(original);
      expect(decryptData(ciphertext)).toBe(original);
    });

    it('roundtrip works for a single-character string', () => {
      const original = 'X';
      expect(decryptData(encryptData(original))).toBe(original);
    });

    it('roundtrip works for a 1000-character string', () => {
      const original = 'a'.repeat(1000);
      expect(decryptData(encryptData(original))).toBe(original);
    });

    it('roundtrip preserves unicode characters', () => {
      const original = '🦄 こんにちは Ünïcödé';
      expect(decryptData(encryptData(original))).toBe(original);
    });
  });

  describe('encryptData output format', () => {
    it('returns a non-empty base64 string', () => {
      const result = encryptData('test');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      // Valid base64: only A-Z a-z 0-9 + / and optional = padding
      expect(result).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('two encryptions of the same plaintext produce different ciphertexts (random IV)', () => {
      const plaintext = 'same-input';
      const first = encryptData(plaintext);
      const second = encryptData(plaintext);
      expect(first).not.toBe(second);
    });
  });

  describe('decryptData error handling', () => {
    it('throws when ciphertext is tampered (auth tag mismatch)', () => {
      const ciphertext = encryptData('sensitive-data');
      // Flip the last byte of the base64-decoded buffer and re-encode
      const buf = Buffer.from(ciphertext, 'base64');
      buf[buf.length - 1]! ^= 0xff;
      const tampered = buf.toString('base64');
      expect(() => decryptData(tampered)).toThrow('Decryption failed');
    });

    it('throws when given a completely invalid base64 payload', () => {
      // A string that decodes to fewer than 32 bytes (no room for IV + authTag)
      const tooShort = Buffer.from('short').toString('base64');
      expect(() => decryptData(tooShort)).toThrow('Decryption failed');
    });

    it('throws when given an empty string', () => {
      expect(() => decryptData('')).toThrow('Decryption failed');
    });

    it('throws when given random base64 garbage', () => {
      const garbage = Buffer.alloc(64, 0xff).toString('base64');
      expect(() => decryptData(garbage)).toThrow('Decryption failed');
    });
  });

  describe('missing ENCRYPTION_KEY', () => {
    it('throws when ENCRYPTION_KEY is not set', () => {
      const saved = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;
      try {
        expect(() => encryptData('test')).toThrow('ENCRYPTION_KEY');
      } finally {
        process.env.ENCRYPTION_KEY = saved;
      }
    });
  });
});
