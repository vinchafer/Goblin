-- WAVE-F (Versionierung & Zeit) F1 — the project-checkpoint registry: the "undo" backbone.
--
-- The gap: an agent run (M10) mutates a project's files in B2 with NO way back except manual
-- editing. For a user to trust an autonomous agent, "undo" must be a first-class, safe,
-- visible primitive. This table is the DB half of Goblin's internal safety net — a
-- content-snapshot checkpoint taken before each agent run (auto), on an explicit "Stand
-- sichern", and on a VERIFIED publish, so the user can travel back and history is legible.
--
-- Storage model (F1, storage-efficient by DESIGN — see checkpoint-store.ts): the file BYTES
-- are NOT copied into this row. They live once-per-unique-content as content-addressed blobs
-- in object storage (`checkpoints/<projectId>/blobs/<sha256>`), so 10 checkpoints of a 20-file
-- project that never changes cost ~20 blobs, not 200. This row carries only the lightweight
-- MANIFEST — the {path → {hash, size}} map that names which blobs reconstitute the snapshot.
-- That makes a checkpoint cheap (a small jsonb) and a restore a byte-exact blob replay.
--
--   project_id  = the project this checkpoint belongs to (FK, ON DELETE CASCADE so the
--                 account-deletion purge reaches these rows; the B2 blobs are purged
--                 separately by purgeProjectCheckpoints, joined to the FW6-U3 teardown).
--   user_id     = denormalized owner (like agent_run_events) so the RLS policy is byte-
--                 identical to agent_runs (auth.uid() = user_id) and the cascade reaches here.
--   label       = the human, German, honest checkpoint name ("Vor: <run summary>",
--                 "Stand gesichert", "Veröffentlicht", "Wiederhergestellt: <label>").
--   created_by  = provenance enum, drives the F3 timeline source icon AND the F5 retention
--                 policy (only 'agent-run' auto-checkpoints are ever auto-pruned):
--                   agent-run | user | publish
--   run_id      = the F-40 agent_runs row this checkpoint was taken for (nullable; only
--                 'agent-run' checkpoints set it). ON DELETE SET NULL — deleting/aging a run
--                 must not vaporize the pre-run snapshot the user may still want to restore.
--   manifest    = jsonb { files: [{ path, hash, size }], byteTotal, fileCount } — the snapshot
--                 index. Never carries file bodies (those are blobs), never secrets.
--   deployed_url= F4: the VERIFIED-live URL a 'publish' checkpoint recorded (nullable; only
--                 set on created_by='publish' after the deploy truth-gate passed). This is
--                 what the "frühere Versionen" publish-history list reads — never an
--                 unverified claim.
--   created_at  = when the snapshot was taken (the F3 timeline order + the F5 age clock).
--
-- Idempotent (IF NOT EXISTS). NOT applied automatically — the founder applies it via the
-- Supabase SQL Editor. Every API path is PRE-MIGRATION TOLERANT: the checkpoint store probes
-- for the table and silently no-ops (feature-detect: the F3 UI honest-hides, the restore tool
-- degrades honestly) before the founder applies this, so a pre-0095 DB never crashes, never
-- blocks a run, and never disrupts an active user session (LIVE-USERS safety).

create table if not exists public.project_checkpoints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  label text not null,
  created_by text not null check (created_by in ('agent-run', 'user', 'publish')),
  run_id uuid references public.agent_runs(id) on delete set null,
  manifest jsonb not null default '{}'::jsonb,
  deployed_url text,
  created_at timestamptz not null default now()
);

alter table public.project_checkpoints enable row level security;

-- Same shape as agent_runs' policy: a user reads/writes only their own checkpoints.
create policy "Users can view own project checkpoints" on public.project_checkpoints
  for all using (auth.uid() = user_id);

-- The F3 timeline read is always "checkpoints for this project, newest first"; the F5 prune
-- read is "agent-run checkpoints older than N days". This index serves both.
create index if not exists idx_project_checkpoints_project_created
  on public.project_checkpoints (project_id, created_at desc);

-- The F4 publish-history read filters created_by='publish' for a project — a partial index
-- keeps that list cheap without scanning agent-run/user checkpoints.
create index if not exists idx_project_checkpoints_publish
  on public.project_checkpoints (project_id, created_at desc)
  where created_by = 'publish';
