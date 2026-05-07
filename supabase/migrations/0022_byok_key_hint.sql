-- Add key_hint (last 4 chars, displayed in UI) and validated_at to byok_keys
ALTER TABLE byok_keys
  ADD COLUMN IF NOT EXISTS key_hint VARCHAR(8),
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;
