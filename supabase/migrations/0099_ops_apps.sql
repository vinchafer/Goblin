-- AKT 2 · PHASE 1 · U1.4 — the Living-App registry.
--
-- AUTHORED, NOT APPLIED (Law 4 / sprint hard rule): the founder applies this via the
-- Supabase SQL Editor when merging. Nothing in this PR reads or writes the table, and
-- the reader that exists (`apps/api/src/services/ops-apps-store.ts`) FEATURE-DETECTS it
-- and degrades to "not available" rather than throwing — so a pre-0099 database behaves
-- exactly as it does today, for the live Act-1 cohort and for the beta account alike.
-- Additive and idempotent (IF NOT EXISTS throughout); it touches no existing table.
--
-- WHAT A ROW IS. One row = one Living App on the LEAN Cloudflare plane (founder decision
-- 2026-07-27, amending D2 of docs/OPS_SPIKE_0_DECISION_TABLE.md): its static files live in
-- R2 under `apps/{app_id}/`, a KV record at `route:{app_name}` points the hostname
-- `{app_name}.justgoblin.app` at it, and ONE platform-owned router Worker (Phase 2) serves
-- it. There is no per-app Worker and no per-app D1 on the Free plan.
--
-- WHY THE SUBSTRATE COLUMNS ARE NULLABLE. `worker_script_name` and `d1_database_id` are the
-- documented upgrade trigger written into the schema: when the Free limit bites or an app
-- needs server-side code, that app moves to Workers Paid / WfP + D1 and fills these in.
-- Every app carries its own substrate facts, so the fleet can straddle both planes during a
-- migration instead of requiring a flag day. They are NULL for every app built in Phase 2.

create table if not exists public.ops_apps (
  -- app_id is the R2 prefix segment and the KV record's payload. Generated here so an app
  -- has an identity before any Cloudflare call is made (an interrupted publish leaves a
  -- row to clean up, never an orphaned R2 prefix nobody knows about).
  app_id uuid primary key default gen_random_uuid(),

  -- Owner. Denormalized onto every row so the RLS policy is byte-identical to agent_runs /
  -- project_checkpoints / supabase_backends, and so the account-deletion cascade reaches here.
  user_id uuid not null references public.users(id) on delete cascade,

  -- The Goblin project this app was published from. ON DELETE CASCADE so deleting a project
  -- removes its registry row.
  --   ⚠ PHASE-2 OBLIGATION: the cascade deletes the ROW, not the hosted content. Whoever
  --   builds project deletion in the ops world must delete the R2 prefix and the KV route
  --   FIRST (cf-deploy deleteAppFiles + deleteRoute) — otherwise a deleted project leaves a
  --   live public URL with no registry row pointing at it, which is both an abuse-SOP hole
  --   and unbounded storage COGS (ledger M-H1: there is no orphan sweep).
  project_id uuid references public.projects(id) on delete cascade,

  -- The hostname label: `{app_name}.justgoblin.app`. Hostnames are case-insensitive, so the
  -- column is constrained to lowercase and the uniqueness index is plain — no two apps can
  -- differ only in case. Shape only here (3–63 chars, [a-z0-9-], no leading/trailing hyphen,
  -- no `xn--`); the reserved-name list, brand-token blocking and homoglyph normalisation are
  -- the Phase-2 name-claim flow's job (OPS_SPIKE_0 §3.4), NOT a database constraint —
  -- policy that must produce an honest German error belongs in code that can produce one.
  app_name text not null unique
    check (app_name = lower(app_name))
    check (app_name ~ '^[a-z0-9]([a-z0-9-]{1,61})[a-z0-9]$')
    check (app_name not like 'xn--%'),

  -- Lifecycle. Every state a real app can be in, including the honest failure states — a
  -- half-finished publish is recorded as 'failed', never silently left as 'active' (the E-5
  -- lesson). 'suspended' is the abuse-SOP emergency stop (OPS_SPIKE_0 §3.3): the router
  -- refuses to serve a suspended app, which is instantly reversible in one UPDATE — the
  -- opposite of deleting the content, which is not.
  status text not null default 'provisioning'
    check (status in ('provisioning', 'active', 'suspended', 'failed', 'deleted')),

  -- Which cap profile applies (request/CPU/storage ceilings). A NAME, not numbers: the
  -- numbers live in code so they can be tuned without a migration, and so one profile can be
  -- retuned for every app at once. v1 profile: 'free-static'.
  caps_profile text not null default 'free-static',

  -- ── Substrate facts, per app ────────────────────────────────────────────────────────
  -- The R2 key prefix. Denormalized (it is derivable from app_id) so that a future layout
  -- change does not orphan the objects of apps written under the old one.
  r2_prefix text not null,
  -- The KV key the router resolves. Same reasoning as r2_prefix.
  route_key text not null,
  -- NULL on the lean/Free plane — see the header note on the upgrade trigger.
  worker_script_name text,
  d1_database_id text,

  -- ── Honest telemetry ────────────────────────────────────────────────────────────────
  file_count int,
  total_bytes bigint,
  -- Set only by a VERIFIED publish (entry URL 200 + assets byte-checked), never by an upload
  -- that merely did not throw. An app that was never verified must not claim it was live.
  last_published_at timestamptz,
  suspended_at timestamptz,
  -- The founder's written reason, per the 24-hour takedown runbook. Never a code.
  suspension_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ops_apps enable row level security;

-- Same shape as agent_runs / project_checkpoints / supabase_backends: a user reaches only
-- their own rows. Every privileged write goes through the service-role API path; this policy
-- protects any future anon/authenticated read (there is none in Phase 1) and satisfies the
-- RLS-cross-account probe's expectation that no user can reach another's rows.
drop policy if exists "Users can view own ops apps" on public.ops_apps;
create policy "Users can view own ops apps" on public.ops_apps
  for all using (auth.uid() = user_id);

-- "Which apps does this user have?" — the dashboard list and the per-plan Living-App count.
create index if not exists idx_ops_apps_user
  on public.ops_apps (user_id, status);

-- "Does this project already have a Living App?" — publish idempotency.
create index if not exists idx_ops_apps_project
  on public.ops_apps (project_id);

-- The Keeper's fan-out (Phase 5) iterates the live fleet; this is the index it reads.
create index if not exists idx_ops_apps_status
  on public.ops_apps (status, last_published_at);

comment on table public.ops_apps is
  'AKT 2 — Living Apps on the lean Cloudflare plane (R2 static + KV route + one shared router Worker). Gated by OPS_HOSTING_ENABLED; empty until Phase 2.';
