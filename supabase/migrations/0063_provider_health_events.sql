-- Sprint 10.9-3 — Per-provider health / circuit-breaker state transitions.
-- Additive + idempotent; founder applies in Supabase Studio.

CREATE TABLE IF NOT EXISTS provider_health_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    TEXT NOT NULL,             -- 'anthropic' | 'openai' | 'google' | ...
  state       TEXT NOT NULL,             -- 'healthy' | 'degraded' | 'down'
  error_rate  NUMERIC,                   -- rolling-window error fraction at transition
  volume      INTEGER,                   -- request count in the window
  ts          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_health_events_provider_ts
  ON provider_health_events (provider, ts DESC);
