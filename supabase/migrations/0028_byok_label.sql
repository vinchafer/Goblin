-- Add label and validation_error columns to byok_keys if not present
ALTER TABLE byok_keys ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE byok_keys ADD COLUMN IF NOT EXISTS validation_error TEXT;
