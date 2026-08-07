-- 0101_users_deleted_at.sql
--
-- FOUNDER-WALK-5 · U2 — the column six read sites depend on, which no migration ever created.
--
-- ── What was actually wrong ──────────────────────────────────────────────────
--
-- `/admin/users` answered "Fehler 500 — column users.deleted_at does not exist". The table
-- is fine; one column is missing. It is missing because it was never authored, anywhere:
-- `grep -rn deleted_at supabase/migrations/` matches NOTHING across 0001–0100.
--
-- This is not a migration that was applied out of band and lost. 0042 (GDPR account
-- deletion) is where the soft-delete design landed, and it deliberately put the deletion
-- STATE in its own table — `account_deletions.status` — with `deleted_at` nowhere in it.
-- The `users.deleted_at` marker was added to the CODE afterwards, as a convenience flag for
-- the admin lists, with no companion DDL. The founder's own 500 proves it was never applied
-- to production either: an out-of-band column would still be there.
--
-- Writers:  services/account-deletion.ts:186 (set on request), :288 (cleared on reactivate)
-- Readers:  routes/admin.ts:42, :159, :164, :171 · services/insight.ts:90
--
-- Because the writes go through `.update()` without `throwOnError()`, the failure was
-- silent on the write side and loud only on the read side — which is why this surfaced as
-- "one admin page 500s" rather than "account deletion is broken".
--
-- ── The shape ────────────────────────────────────────────────────────────────
--
-- NULLABLE with no default. NULL is the "live user" state every reader already filters on
-- (`.is('deleted_at', null)`), so every existing row is valid the instant this lands and no
-- user disappears from an admin list. A NOT NULL column or a non-null default would do the
-- opposite.
--
-- The backfill matters and is not cosmetic: `account_deletions` is the older, authoritative
-- record. Without it, applying this migration would add the column with every row NULL and
-- silently RESURRECT every pending-deletion user into `/admin/users`, `/admin/stats` and the
-- Insight funnel — a worse state than the 500, because it would look like it worked. The
-- backfill reconciles the new marker with the truth that already exists.
--
-- ── Applied by hand (Methodik Gesetz 4) ──────────────────────────────────────
-- Authored, NOT applied. Run it in the Supabase SQL Editor, then re-run
-- supabase/checks/migration_status.sql to confirm.
--
-- Idempotent and safe to re-run.

alter table public.users
  add column if not exists deleted_at timestamptz;

comment on column public.users.deleted_at is
  'Soft-delete marker. NULL = live. Written by services/account-deletion.ts (set on '
  'request, cleared on reactivate); read by /admin/users, /admin/stats and the Insight '
  'funnel, all of which filter `.is(deleted_at, null)`. The authoritative deletion record '
  'is public.account_deletions (0042) — this column is the denormalised flag those list '
  'reads filter on.';

-- Backfill from the authoritative record: anyone with a still-pending deletion request was
-- already soft-deleted, and must not reappear as a live user just because the flag is new.
-- `requested_at` (not now()) so the marker matches when the deletion was actually requested.
update public.users u
   set deleted_at = ad.requested_at
  from public.account_deletions ad
 where ad.user_id = u.id
   and ad.status = 'pending'
   and u.deleted_at is null;

-- The list reads are all "live users, newest first". A partial index on exactly that
-- predicate keeps them off a sequential scan as the table grows, and costs nothing for the
-- soft-deleted minority.
create index if not exists idx_users_live_created_at
  on public.users (created_at desc)
  where deleted_at is null;
