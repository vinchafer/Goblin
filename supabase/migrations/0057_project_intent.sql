-- 0057_project_intent.sql — Sprint 10, Slice 1 (Convergence keystone)
-- Adds project "intent": the one question asked at creation that sets the
-- DEFAULT FOREGROUND of the Code Tab (One Canvas, Progressive Reach). It is a
-- default layout hint, never a mode/toggle — capabilities are identical across
-- all intents. Existing projects default to 'exploring' (Max-default layout),
-- so no behaviour regresses.
--
-- Idempotent. NOT applied to prod by this migration run — founder applies via
-- `supabase db push`.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS intent TEXT
    DEFAULT 'exploring';

-- Constraint added separately so re-running is safe even if the column exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_intent_check'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_intent_check
      CHECK (intent IN ('landing_page','web_app','import_repo','exploring'));
  END IF;
END $$;

-- Backfill any NULLs (defensive; the DEFAULT handles new rows).
UPDATE projects SET intent = 'exploring' WHERE intent IS NULL;
