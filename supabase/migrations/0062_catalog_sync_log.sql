-- Sprint 10.9-2 — Catalog refresh audit log (OPTION B: per-user provider-discovery).
-- Additive + idempotent; founder applies in Supabase Studio.

CREATE TABLE IF NOT EXISTS catalog_sync_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_at    TIMESTAMPTZ DEFAULT now(),
  source       TEXT NOT NULL,            -- 'litellm' | 'provider-discovery' | 'manual' | 'cron'
  added        INTEGER DEFAULT 0,        -- models newly discovered across users
  updated      INTEGER DEFAULT 0,        -- keys re-validated
  deactivated  INTEGER DEFAULT 0,        -- keys now-invalid (NOT deleted)
  details      JSONB
);

CREATE INDEX IF NOT EXISTS idx_catalog_sync_log_synced_at
  ON catalog_sync_log (synced_at DESC);

-- Per-user discovery refresh records the validation outcome on the key so the
-- Settings UI can surface "Key ungültig — bitte prüfen" without deleting it.
ALTER TABLE byok_keys ADD COLUMN IF NOT EXISTS last_validation_result TEXT;
  -- 'valid' | 'invalid' | 'error' | 'rate_limited' | NULL (never checked)
