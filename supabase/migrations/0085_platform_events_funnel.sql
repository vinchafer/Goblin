-- I1 (WAVE-I insight): extend platform_events from the two internal-accounting
-- producers (0078: platform_cogs, context_retry) into the canonical BEHAVIOUR
-- funnel + product-signal sink.
--
-- Privacy law of this wave: events carry METADATA ONLY — which function, when —
-- never message content, never file contents, never generated code. Events are
-- personal data (they join the account-deletion purge; see account-deletion.ts,
-- which now deletes platform_events by user_id — the table has NO FK to
-- auth.users, so it does NOT cascade and MUST be purged explicitly).
--
-- What this changes vs 0078:
--   1. Drops the restrictive CHECK on event_type (which allowed only
--      'platform_cogs' / 'context_retry'). Without this, every funnel insert
--      would violate the constraint and silent-fail into a no-op (the emitter
--      swallows the error), so no behaviour would ever be recorded. event_type
--      is now free-form text, governed at the application layer by the
--      PlatformEventType union in apps/api/src/lib/platform-events.ts.
--   2. Adds two funnel-shaped indexes: the dashboard's core query is
--      "first occurrence per user per event_type" (funnel conversion) and
--      "all events for one user, newest first" (journeys).
--
-- NOT applied automatically — founder applies via Supabase SQL Editor.
-- Idempotent + pre-migration tolerant: the emitter (insertPlatformEvent) already
-- silent-fails when the table/constraint shape is older, so funnel measurement
-- simply defers until this is applied — it never blocks or slows a user flow.

-- 1) Retire the closed CHECK. The constraint name from 0078 is the Postgres
--    default (<table>_<column>_check); drop defensively either way.
do $$
begin
  if exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'platform_events' and column_name = 'event_type'
  ) then
    execute (
      select 'alter table public.platform_events drop constraint if exists ' || quote_ident(tc.constraint_name)
      from information_schema.table_constraints tc
      where tc.table_name = 'platform_events'
        and tc.constraint_type = 'CHECK'
        and tc.constraint_name like '%event_type%'
      limit 1
    );
  end if;
exception when others then
  -- Best-effort: if the constraint is already gone or the lookup shape differs,
  -- proceed — the explicit drop below is the real guarantee.
  null;
end $$;

alter table public.platform_events
  drop constraint if exists platform_events_event_type_check;

-- 2) Funnel + journeys indexes.
-- Funnel: min(created_at) per (event_type, user_id) → conversion per stage.
create index if not exists platform_events_funnel_idx
  on public.platform_events(event_type, user_id, created_at);

-- Journeys: every event for one user, newest first (per-user timeline + last event).
create index if not exists platform_events_user_idx
  on public.platform_events(user_id, created_at desc);
