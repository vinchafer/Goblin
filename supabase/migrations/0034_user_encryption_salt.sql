-- Phase Z2: Per-User-Salt for BYOK Encryption (C-3 fix)

-- 1. Add encryption_salt column (base64-encoded 32-byte random salt)
ALTER TABLE users ADD COLUMN IF NOT EXISTS encryption_salt TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS encryption_migrated_at TIMESTAMPTZ;

-- 2. Add legacy backup for rollback safety
ALTER TABLE byok_keys ADD COLUMN IF NOT EXISTS key_encrypted_legacy TEXT;
