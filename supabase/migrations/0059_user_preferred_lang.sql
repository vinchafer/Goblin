-- 0059_user_preferred_lang.sql
-- Sprint 10.5 A-S1: persist the user's onboarding language choice.
-- App strings remain DE-hardcoded for now (no i18n infra in 10.5); this
-- column records the preference so marketing locale-routing and future
-- translations can honour it. Defaults to 'de'.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_lang TEXT
    CHECK (preferred_lang IN ('en', 'de'))
    DEFAULT 'de';
