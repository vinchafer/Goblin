-- WAVE-B (Full-Stack: Apps mit Datenbank & Login) B1 — the provisioned-backend registry.
--
-- AUTHORED, NOT APPLIED (sprint hard rule / Law 4): the founder applies this via the
-- Supabase SQL Editor after merge. Every API path is PRE-MIGRATION TOLERANT — the
-- provisioning service feature-detects this table and degrades honestly (the tool
-- reports "noch nicht verfügbar", the connectors entry honest-hides) before the founder
-- applies it, so a pre-0096 DB never crashes, never blocks a run, and never disrupts an
-- active user session (LIVE-USERS safety). Additive + idempotent (IF NOT EXISTS).
--
-- Two parts:
--   1) Widen byok_keys' provider CHECK to allow 'supabase' — the user's OAuth Management
--      API token (D-B1 = user-connected shape) is a CONNECTION provider stored in byok_keys
--      exactly like 'vercel'/'brave' (0083), never an LLM provider, never in the model catalog.
--   2) The supabase_backends table — one row per backend Goblin PROVISIONED inside the
--      user's own Supabase account. This is what teardown (FW6 purge) enumerates, what the
--      trial cap counts (D-B2 = 2/trial), and where the provisioned project's service_role
--      key lives ENCRYPTED (per-user Vault KEK, same envelope as byok_keys — R5). The anon
--      key is public (it may enter generated client code) so it is stored in plaintext.
--
-- Provider-agnostic BY DESIGN (founder-ratified v1 = Supabase only): a `provider` column
-- (default 'supabase') lets a future wave add a second backend provider as its own row
-- type without a schema rewrite. v1 only ever writes 'supabase'. See docs/FULLSTACK.md.

-- ── 1) byok_keys provider widen (mirrors 0083; keeps every prior provider) ──────────
ALTER TABLE byok_keys DROP CONSTRAINT IF EXISTS byok_keys_provider_check;
ALTER TABLE byok_keys
  ADD CONSTRAINT byok_keys_provider_check
  CHECK (provider IN (
    'anthropic', 'openai', 'google', 'groq', 'mistral', 'deepseek', 'xai',
    'together', 'fireworks', 'custom', 'vercel', 'brave', 'supabase'
  ));

-- ── 2) provisioned-backend registry ─────────────────────────────────────────────────
--   project_id            = the Goblin project this backend belongs to (FK, ON DELETE
--                           CASCADE so the account-deletion purge reaches these rows).
--   user_id               = denormalized owner so the RLS policy is byte-identical to
--                           agent_runs (auth.uid() = user_id) and the cascade reaches here.
--   provider              = backend provider id (v1: always 'supabase'). The v2 extension point.
--   supabase_project_ref  = the provisioned project's ref (e.g. 'abcdefghijklmnop'); the
--                           teardown + api-key + query calls key off it. Attested from the
--                           create-project API response, never fabricated.
--   project_url           = https://<ref>.supabase.co — public; safe in generated client code.
--   region                = the provisioned region (default Frankfurt eu-central-1).
--   anon_key              = the project's public anon/publishable key. PUBLIC by design (it
--                           is designed to ship in client code behind RLS), so plaintext.
--   service_role_encrypted= the project's service_role/secret key, SEALED with the user's
--                           Vault KEK (v2 envelope, same as byok_keys). NEVER plaintext,
--                           NEVER in generated code / logs / reports (R5, Wave-D scrubbing).
--   vault_secret_id       = the Vault KEK id used to seal service_role_encrypted (v2).
--   encryption_version    = 2 (Vault KEK). 1 would be the legacy scrypt path (unused here).
--   status                = provisioning | active | failed | torn_down. A failed/half
--                           provisioning is recorded HONESTLY (E-5 lesson) so it is never a
--                           silent half-state; teardown targets active|failed rows.
--   provision_latency_ms  = MEASURED wall-clock of the create-project call (honest telemetry;
--                           the spike could not verify a figure, so this is where the real
--                           number is recorded — never invented).
--   created_at            = when the backend was provisioned.

create table if not exists public.supabase_backends (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null default 'supabase' check (provider in ('supabase')),
  supabase_project_ref text not null,
  project_url text not null,
  region text not null default 'eu-central-1',
  anon_key text,
  service_role_encrypted text,
  vault_secret_id uuid references vault.secrets(id) on delete set null,
  encryption_version int not null default 2,
  status text not null default 'provisioning'
    check (status in ('provisioning', 'active', 'failed', 'torn_down')),
  provision_latency_ms int,
  created_at timestamptz not null default now()
);

alter table public.supabase_backends enable row level security;

-- Same shape as agent_runs / project_checkpoints: a user reads/writes only their own rows.
-- All privileged writes go through the service-role API path; this policy protects any
-- future anon/authenticated read (there is none in v1) and matches the RLS-cross-account
-- probe's expectation that no user can reach another's rows.
create policy "Users can view own provisioned backends" on public.supabase_backends
  for all using (auth.uid() = user_id);

-- Teardown enumerates a user's active|failed backends; the trial cap counts a user's live
-- backends. Both read by user_id; this index serves them.
create index if not exists idx_supabase_backends_user
  on public.supabase_backends (user_id, status);

-- The per-project lookup ("does this project already have a backend?") for idempotency.
create index if not exists idx_supabase_backends_project
  on public.supabase_backends (project_id);
