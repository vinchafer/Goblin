-- WAVE-A settings rider: drop the memory_enabled placebo column.
--
-- users.memory_enabled (added 0048) was a placebo: it was stored and returned by
-- /api/account/preferences but NEVER read to gate any behavior — the rolling project
-- memory (project_state / U3) and the per-project instructions (FEEL-4) run regardless
-- of it. Founder decision (ratified): remove the toggle; it is superseded by the real
-- per-project memory control. The API surface and the Personalisierung UI already stopped
-- referencing it in the same wave; this drops the now-dead column so no store lingers.
--
-- Idempotent (DROP COLUMN IF EXISTS). NOT applied automatically — founder applies via the
-- Supabase SQL Editor. Safe to apply after the WAVE-A code is live (nothing reads/writes
-- the column anymore); harmless to leave unapplied (the column simply sits unused).

alter table public.users
  drop column if exists memory_enabled;
