-- 0073_user_storage_bytes.sql — per-user storage counter for the enforced storage cap.
--
-- Storage becomes a REAL second plan axis (trial 2 / build 10 / pro 40 / power 100 GB,
-- enforced server-side in apps/api/src/lib/storage-cap.ts + file-storage.ts). This
-- column is the running per-user total of object-storage bytes (Backblaze B2): every
-- footprint write adds its delta, every delete subtracts it, and a nightly reconcile
-- (jobs/reconcile-storage.ts) walks B2 to correct drift.
--
-- Idempotent: safe to re-run. After applying, run the one-time backfill
--   pnpm --filter @goblin/api exec tsx src/scripts/backfill-storage.ts
-- to populate accurate counters immediately rather than waiting for the first nightly run.

-- 1. The counter. BIGINT (a power user's 100 GB = ~1.07e11 bytes, well within bigint).
alter table public.users
  add column if not exists storage_bytes bigint not null default 0;

-- 2. Atomic, clamped delta helper. Adds p_delta (may be negative on delete) and floors
--    at 0 so a transient over-decrement can never drive the counter negative. Service
--    role only (writes come from the API). search_path pinned per the 0053 advisor fix.
create or replace function public.increment_user_storage_bytes(
  p_user_id uuid,
  p_delta bigint
) returns bigint
language sql
security definer
set search_path = ''
as $$
  update public.users
     set storage_bytes = greatest(0, storage_bytes + p_delta)
   where id = p_user_id
  returning storage_bytes;
$$;

revoke all on function public.increment_user_storage_bytes(uuid, bigint) from public;
grant execute on function public.increment_user_storage_bytes(uuid, bigint) to service_role;

-- 3. Absolute setter used by the reconcile job to overwrite drift with the true B2 sum.
create or replace function public.set_user_storage_bytes(
  p_user_id uuid,
  p_bytes bigint
) returns void
language sql
security definer
set search_path = ''
as $$
  update public.users
     set storage_bytes = greatest(0, p_bytes)
   where id = p_user_id;
$$;

revoke all on function public.set_user_storage_bytes(uuid, bigint) from public;
grant execute on function public.set_user_storage_bytes(uuid, bigint) to service_role;
