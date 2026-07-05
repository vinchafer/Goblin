-- TRIAL-7 T2 — achievement-triggered upgrade card, shown ONCE per user.
-- Stamped the moment the user first sees the card (after their first truth-gated
-- successful publish). NULL = never shown; a timestamp = seen (never re-shown).
-- No behavioural gate — purely records the one-time celebratory upgrade moment.
ALTER TABLE users ADD COLUMN IF NOT EXISTS achievement_upgrade_card_seen_at TIMESTAMPTZ;
