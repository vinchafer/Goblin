-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION STATUS PROBE — which authored migrations are actually in this database?
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- WHY THIS EXISTS. Goblin's migrations are "authored, never applied" (Methodik Gesetz 4):
-- the repo holds the SQL, the founder applies it by hand. Nothing tracked which ones had
-- actually landed, so the only answers available were inference from old wave reports —
-- and those go stale the moment a migration is applied. This file replaces guessing with
-- a reading.
--
-- It is READ-ONLY. It creates nothing, changes nothing, and can be run any number of times.
--
-- HOW TO USE
--   1. Supabase Studio → SQL Editor → New query.
--   2. Paste this whole file, Run.
--   3. Every row marked *** MISSING *** names a migration that has not been applied.
--      Apply those files from supabase/migrations/ in ASCENDING NUMERIC ORDER.
--   4. Re-run this probe afterwards; a clean run is all APPLIED.
--
-- WHAT IT CHECKS. One decisive object per migration — the table, column, index or function
-- that migration exists to create. A migration that is half-applied would show as APPLIED
-- here; the probe answers "did this land", not "is every statement in it present".
--
-- Coverage: 0076–0100. Earlier migrations (0001–0075) are the pre-launch schema; if they
-- were missing the app would not start or would fail loudly on first use, so they are not
-- the silent-risk class this probe is for. Note there is NO 0058 — that number was never
-- authored, so a gap in the file list at 0058 is expected and not a missing migration.
--
-- 0089 is INVERTED on purpose: it DROPS users.memory_enabled, so "applied" means the
-- column is gone.

with checks(migration, what, applied, note) as (values

  -- ── Core telemetry / context ────────────────────────────────────────────────
  ('0076', 'table project_state',
     to_regclass('public.project_state') is not null, ''),
  ('0077', 'completion_costs.project_id',
     exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='completion_costs' and column_name='project_id'),
     'silent if missing — cost rows lose project attribution'),
  ('0078', 'table platform_events',
     to_regclass('public.platform_events') is not null,
     'silent if missing — funnel + platform_cogs events are no-ops'),
  ('0079', 'users.achievement_upgrade_card_seen_at',
     exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='users' and column_name='achievement_upgrade_card_seen_at'), ''),
  ('0080', 'completion_costs.ttft_ms',
     exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='completion_costs' and column_name='ttft_ms'), ''),
  ('0081', 'agent_runs.step_log',
     exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='agent_runs' and column_name='step_log'),
     'silent if missing — run step log not persisted'),
  ('0082', 'users.pref_address_name',
     exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='users' and column_name='pref_address_name'),
     'silent if missing — structured work preferences stay dark'),
  ('0083', 'byok_keys allows provider=brave',
     exists (select 1 from pg_constraint
              where conname = 'byok_keys_provider_check'
                and pg_get_constraintdef(oid) ilike '%brave%'), ''),
  ('0084', 'index idx_stripe_processed_events_recovery',
     to_regclass('public.idx_stripe_processed_events_recovery') is not null, ''),
  ('0085', 'index platform_events_funnel_idx',
     to_regclass('public.platform_events_funnel_idx') is not null, ''),
  ('0086', 'table support_tickets',
     to_regclass('public.support_tickets') is not null,
     'silent if missing — support escalation degrades'),
  ('0087', 'table feedback',
     to_regclass('public.feedback') is not null,
     'silent if missing — feedback submissions degrade'),
  ('0088', 'agent_runs.report',
     exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='agent_runs' and column_name='report'),
     'silent if missing — the report card cannot be recovered after a stop'),
  ('0089', 'users.memory_enabled REMOVED (inverted check)',
     not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='users' and column_name='memory_enabled'),
     'applied == the column is GONE'),
  ('0090', 'function delete_user_kek',
     to_regprocedure('public.delete_user_kek(uuid)') is not null, ''),

  -- ── F-40 resumable runs — the pair behind "does my build survive the lock" ──
  ('0091', 'table agent_run_events',
     to_regclass('public.agent_run_events') is not null,
     'silent if missing — no durable run log; cross-replica re-attach degrades'),
  ('0092', 'agent_runs.session_id',
     exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='agent_runs' and column_name='session_id'),
     'SILENT if missing — findActiveRun returns null, agent re-attach is never offered'),

  -- ── Billing / money ─────────────────────────────────────────────────────────
  ('0093', 'users.last_confirmed_plan',
     exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='users' and column_name='last_confirmed_plan'), ''),
  ('0094', 'table refund_jobs',
     to_regclass('public.refund_jobs') is not null, ''),

  -- ── Checkpoints ─────────────────────────────────────────────────────────────
  ('0095', 'table project_checkpoints',
     to_regclass('public.project_checkpoints') is not null,
     'silent if missing — undo/restore degrades to a no-op'),
  ('0097', 'index idx_project_checkpoints_agentrun_created',
     to_regclass('public.idx_project_checkpoints_agentrun_created') is not null,
     'performance only — prune cron falls back to a sequential scan'),

  -- ── Full-stack backends (WAVE-B) ────────────────────────────────────────────
  ('0096', 'table supabase_backends',
     to_regclass('public.supabase_backends') is not null,
     'needed for the B3 founder proof (provision_backend)'),

  -- ── Promo codes (the invite flow) ───────────────────────────────────────────
  ('0098a', 'table promo_codes',
     to_regclass('public.promo_codes') is not null, ''),
  ('0098b', 'function redeem_promo_code',
     to_regprocedure('public.redeem_promo_code(text, uuid)') is not null,
     'without this the API answers an honest "not available yet"'),
  ('0098c', 'users.comped_until',
     exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='users' and column_name='comped_until'), ''),

  -- ── Act 2 (ops plane) — NOT required by this wave ───────────────────────────
  ('0099', 'table ops_apps',
     to_regclass('public.ops_apps') is not null, 'Act-2 only'),
  ('0100', 'table ops_app_audit',
     to_regclass('public.ops_app_audit') is not null, 'Act-2 only')
)
select
  migration,
  case when applied then 'APPLIED' else '*** MISSING ***' end as status,
  what,
  note
from checks
order by (case when applied then 1 else 0 end), migration;
