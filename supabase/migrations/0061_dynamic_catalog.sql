-- Sprint 10.8 — Dynamic catalog: models table becomes a cache, BYOK keys carry
-- the per-user discovered model list. All additive + idempotent; founder applies.

-- ── models table: provenance + freshness + capabilities ──────────────────────
ALTER TABLE models ADD COLUMN IF NOT EXISTS discovered_via TEXT
  DEFAULT 'manual';                       -- 'litellm' | 'provider_api' | 'manual'
ALTER TABLE models ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE models ADD COLUMN IF NOT EXISTS capabilities JSONB
  DEFAULT '{}'::jsonb;                     -- { chat, vision, function_calling, ... }

-- Constrain provenance to known values without breaking existing rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'models_discovered_via_check'
  ) THEN
    ALTER TABLE models
      ADD CONSTRAINT models_discovered_via_check
      CHECK (discovered_via IN ('litellm', 'provider_api', 'manual'));
  END IF;
END $$;

-- ── byok_keys: per-user discovered model list + validation freshness ─────────
ALTER TABLE byok_keys ADD COLUMN IF NOT EXISTS discovered_models JSONB
  DEFAULT '[]'::jsonb;                     -- ["llama-3.3-70b-versatile", ...]
ALTER TABLE byok_keys ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ;

-- Helpful index: catalog reads filter on availability + provenance freshness.
CREATE INDEX IF NOT EXISTS idx_models_available_provider
  ON models (available, provider);
