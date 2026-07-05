-- I0 (MOBILE-1 telemetry pre-unit): persist platform-COGS + degradation events to
-- the DB so they are measurable without Railway logs (defuses half of ticket #12,
-- the "no Railway CLI" log-blocker).
--
-- Two producers, both silent-fail no-ops when this table is absent (pre-migration):
--   'platform_cogs'  — the project-state summarizer (server-initiated, not user-
--                      billed). Mirrors the existing billing:platform_cogs log line.
--   'context_retry'  — the B2 reduced-context retry fired when a provider rejects a
--                      request as too large (U1 file-content injection over a small
--                      free-tier TPM cap). Mirrors the existing console.warn.
--
-- Both were previously log-only, so A20 (platform COGS) and B2 (retry frequency)
-- were invisible outside ephemeral Railway logs. This table makes them queryable.
--
-- Idempotent (CREATE TABLE IF NOT EXISTS, drop-then-create policy). NOT applied
-- automatically — founder applies via Supabase SQL Editor.

create table if not exists public.platform_events (
  id          uuid primary key default gen_random_uuid(),
  event_type  text not null check (event_type in ('platform_cogs', 'context_retry')),
  user_id     uuid,
  project_id  uuid,
  model       text,
  tokens_in   bigint,
  tokens_out  bigint,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists platform_events_type_idx
  on public.platform_events(event_type, created_at desc);

create index if not exists platform_events_project_idx
  on public.platform_events(project_id, created_at desc);

alter table public.platform_events enable row level security;

-- Service-role only — these are server-internal accounting rows, never read by
-- end users. RLS with no user-facing policy = default-deny for anon/authenticated.
drop policy if exists "Service role full access" on public.platform_events;
create policy "Service role full access"
  on public.platform_events for all
  using (auth.role() = 'service_role');
