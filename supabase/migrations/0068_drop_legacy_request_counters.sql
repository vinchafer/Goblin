-- 0068_drop_legacy_request_counters.sql
-- Retire the legacy request-count limit system (DD §A — the coupled change-set that
-- unifies all limits on the WEIGHTED Goblin token allowance, lib/goblin-cap.ts).
--
-- After this session, NOTHING in application code reads or writes these columns or
-- this function:
--   • users.monthly_requests_used  (added 0001)  — was incremented only by the now-
--                                                   deleted middleware/usage-limit.ts
--   • users.monthly_limit          (added 0004)  — was the per-plan request cap
--   • increment_request_count()    (added 0005)  — atomic incrementer, now unused
-- The only limit is the weighted monthly allowance + per-day guard, keyed off
-- users.plan (no per-user counter column needed; it resets by calendar month).
--
-- HR-7 / HR-10: migration FILE ONLY. The founder applies it manually via the Supabase
-- SQL Editor. Until then the columns are harmless dead weight — application code no
-- longer selects or writes them, so master is safe both BEFORE and AFTER apply. Run
-- AFTER this session's API is deployed (so nothing still selects the columns).
--
-- Idempotent (IF EXISTS) and reversible by re-adding the columns with their old
-- defaults if ever needed (they would simply read 0 / NULL).

-- 1. Drop the dead atomic-incrementer first (it references monthly_requests_used).
drop function if exists public.increment_request_count(uuid);

-- 2. Drop the retired counter + cap columns.
alter table public.users drop column if exists monthly_requests_used;
alter table public.users drop column if exists monthly_limit;
