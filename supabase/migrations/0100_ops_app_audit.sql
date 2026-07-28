-- AKT 2 · PHASE 2 · U2.5 — the operator audit trail for hosted apps.
--
-- AUTHORED, NOT APPLIED (Law 4 / sprint hard rule): the founder applies this via the
-- Supabase SQL Editor. Nothing breaks before it is applied — `ops-audit.ts` FEATURE-
-- DETECTS the table exactly like the 0099 reader, and an operator action on a
-- pre-0100 database still happens and is still logged to the application log; the
-- response says `audit: "unavailable"` instead of claiming a row was written.
-- Additive and idempotent. It touches no existing table.
--
-- ── WHY A NEW TABLE, HAVING CHECKED FOR ONE ─────────────────────────────────────────
-- Two existing tables were considered and both are wrong for this:
--
--   • `platform_events` (0078/0085) is the behaviour funnel. It is METADATA-ONLY by
--     law (WAVE-I), it carries no free-text actor or reason, and — decisively — it is
--     PERSONAL DATA that joins the account-deletion purge (account-deletion.ts). An
--     audit trail that disappears when the account it documents is deleted is not an
--     audit trail. Suspension evidence has to outlive the account.
--
--   • `deletion_audit_log` (0042) is GDPR-deletion-specific: hashed subject ids and a
--     CHECK constraining event_type to requested/cancelled/completed/failed. Widening
--     it would blur two different retention stories into one table.
--
-- So: a small, purpose-built table. ABUSE_RESPONSE §8.7 asks for the actor, the
-- reason, the timestamp and enough context to reconstruct what was done — and a
-- 12-month retention, confirmed by the founder on 2026-07-28.

create table if not exists public.ops_app_audit (
  id uuid primary key default gen_random_uuid(),

  -- The app this happened to. NOT a foreign key on purpose: a teardown may be the
  -- very thing that removes the row, and the record of a takedown must survive the
  -- takedown. The id and name are kept verbatim so the trail reads on its own.
  app_id uuid not null,
  app_name text not null,
  -- Denormalised for the same reason: after a cascade there is nothing left to join to.
  user_id uuid,

  -- What was done. Deliberately not constrained by a CHECK: a new operator action in
  -- a later phase must not require a migration before it can be recorded, and an
  -- unrecognised action string is still better evidence than a lost row.
  action text not null,

  -- WHO. A human identifier (founder email) or 'system' for automated actions.
  -- Never a token, never a session id.
  actor text not null,

  -- WHY, in the founder's own words. §8.4 requires the user be told what happened;
  -- this is where that sentence comes from. Never a code.
  reason text,

  -- Context that would otherwise be lost: which KV/R2 steps succeeded, how many
  -- objects a teardown removed, whether the orphan check came back clean.
  -- METADATA ONLY — never file contents, never user data.
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

alter table public.ops_app_audit enable row level security;

-- No policy is granted to authenticated users, deliberately: this table is operator
-- evidence, not user-visible history. The service-role API path bypasses RLS; with
-- RLS on and no policy, an anon/authenticated client reaches nothing.

-- "What happened to this app?" — the per-app history in an appeal (§8.5).
create index if not exists idx_ops_app_audit_app
  on public.ops_app_audit (app_id, created_at desc);

-- "What did we do last week?" — the review pass and the retention sweep.
create index if not exists idx_ops_app_audit_time
  on public.ops_app_audit (created_at desc);

comment on table public.ops_app_audit is
  'AKT 2 — operator actions on Goblin-hosted apps (suspend/unsuspend/teardown). Evidence per ABUSE_RESPONSE 8.7. RETENTION: 12 months, then delete (founder decision 2026-07-28). Not covered by the account-deletion purge on purpose: the record must outlive the account it documents.';
