-- WAVE-J (J2): support-agent escalation + abuse rows.
--
-- Written ONLY on a structured handoff (the "Goblin Hilfe" agent hands a user to a
-- human) or an abuse flag (prompt-injection / repeat-spam). This is NOT a
-- per-message chat log — the support agent bills as platform COGS and its daily
-- message cap is an in-memory guard (mirrors M8 dictation / M11 search), so the
-- vast majority of support turns never touch this table.
--
-- Content note: an escalation legitimately carries a bounded transcript so the
-- founder can actually help (the wave's "structured handoff"). That is the sole
-- content-bearing column here; it is PII-stripped before it is emailed, and the
-- whole row joins the account-deletion purge (WAVE-J I3, account-deletion.ts).
-- No FK to auth.users (like platform_events) → it does NOT cascade on delete and
-- MUST be purged explicitly.
--
-- FULLY IDEMPOTENT + SELF-UPGRADING. Safe to run more than once, and safe to run
-- when an OLDER support_tickets table already exists (the pre-Wave-J scaffold wrote
-- to a table with different columns). `create table if not exists` only makes the
-- base table; each column is then added with `add column if not exists`, so a
-- pre-existing/partial table is upgraded to the full shape instead of being left
-- incomplete. NOT applied automatically — founder applies via Supabase SQL Editor.
-- The API is pre-migration tolerant (every insert is fire-and-forget silent-fail).

-- 1) Base table (only the always-present columns; the rest are added below so this
--    also upgrades an older table that already exists with a different shape).
create table if not exists public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,
  created_at  timestamptz not null default now()
);

-- 2) Complete/upgrade the column set. `add column if not exists` is a no-op when the
--    column is already there, so this works on a fresh table and on the old scaffold
--    table alike. NOT NULL columns carry a default so existing rows backfill cleanly.
alter table public.support_tickets add column if not exists user_id          uuid;
alter table public.support_tickets add column if not exists kind             text not null default 'escalation';
alter table public.support_tickets add column if not exists category         text;
alter table public.support_tickets add column if not exists reason           text;
alter table public.support_tickets add column if not exists transcript       jsonb not null default '[]'::jsonb;
alter table public.support_tickets add column if not exists context_snapshot jsonb not null default '{}'::jsonb;
alter table public.support_tickets add column if not exists email_sent       boolean;
alter table public.support_tickets add column if not exists email_error      text;
alter table public.support_tickets add column if not exists abuse_flag       boolean;
alter table public.support_tickets add column if not exists created_at       timestamptz not null default now();

-- 3) kind CHECK — added guarded so re-runs / pre-existing constraints don't abort.
do $$ begin
  alter table public.support_tickets
    add constraint support_tickets_kind_chk check (kind in ('escalation', 'abuse'));
exception
  when duplicate_object then null;   -- constraint already present
  when others then null;             -- never let the check block the migration
end $$;

-- 4) Indexes (idempotent).
create index if not exists support_tickets_user_idx
  on public.support_tickets(user_id, created_at desc);
create index if not exists support_tickets_kind_idx
  on public.support_tickets(kind, created_at desc);

-- 5) RLS: service-role only. Enabling RLS with no user-facing policy is already
--    default-deny for anon/authenticated; the service role (the API) bypasses RLS
--    entirely, so the server keeps working regardless. The policy is added
--    tolerantly so a project without the auth.role() helper still completes the
--    migration (the table + default-deny RLS is what matters for safety).
alter table public.support_tickets enable row level security;
do $$ begin
  drop policy if exists "Service role full access" on public.support_tickets;
  create policy "Service role full access"
    on public.support_tickets for all
    using (auth.role() = 'service_role');
exception
  when others then null;             -- e.g. auth.role() absent → RLS stays default-deny
end $$;
