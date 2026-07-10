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
-- Idempotent (CREATE TABLE / INDEX IF NOT EXISTS, drop-then-create policy). NOT
-- applied automatically — founder applies via Supabase SQL Editor. The API is
-- pre-migration tolerant: every insert is fire-and-forget silent-fail, so until
-- this is applied escalations still send their founder email, they just aren't
-- also persisted here.

create table if not exists public.support_tickets (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null,
  -- 'escalation' (handed to a human) | 'abuse' (injection / spam guard hit).
  kind              text not null default 'escalation' check (kind in ('escalation', 'abuse')),
  -- Why the agent escalated: 'human_requested' | 'stuck' | 'out_of_scope' | null.
  category          text,
  -- Short, PII-stripped reason line (≤200 chars) — NOT full message content.
  reason            text,
  -- Bounded, PII-stripped transcript (last turns) for the founder handoff. jsonb
  -- array of { role, content }. Purged on account deletion.
  transcript        jsonb not null default '[]'::jsonb,
  -- Content-free context snapshot: plan, project count, connector status, etc.
  context_snapshot  jsonb not null default '{}'::jsonb,
  email_sent        boolean,
  email_error       text,
  -- Legacy abuse marker kept for the pre-existing rate-limit query shape.
  abuse_flag        boolean,
  created_at        timestamptz not null default now()
);

create index if not exists support_tickets_user_idx
  on public.support_tickets(user_id, created_at desc);

create index if not exists support_tickets_kind_idx
  on public.support_tickets(kind, created_at desc);

alter table public.support_tickets enable row level security;

-- Service-role only — server writes/reads these; end users never see them. RLS
-- with no user-facing policy = default-deny for anon/authenticated.
drop policy if exists "Service role full access" on public.support_tickets;
create policy "Service role full access"
  on public.support_tickets for all
  using (auth.role() = 'service_role');
