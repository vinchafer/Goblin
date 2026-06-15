-- 0066_project_file_meta.sql — WS-B.2: per-file timestamps for the explorer.
-- Object storage (S3) only exposes last-modified, so "Erstellt" and "Zuletzt
-- gepusht" cannot be derived from the bucket. This table tracks them per file:
--   created_at      — set when the file is first written (create / cross-project move)
--   last_pushed_at  — set when the file is included in a GitHub push
-- The API upserts via service role; reads are RLS-gated to the owner. Files with
-- no tracked row (everything created before this migration) simply show "—" in
-- the explorer — never a faked value.

create table if not exists public.project_file_meta (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  path            text not null,
  created_at      timestamptz not null default now(),
  last_pushed_at  timestamptz,
  unique (project_id, path)
);

create index if not exists project_file_meta_project_idx
  on public.project_file_meta (project_id);

alter table public.project_file_meta enable row level security;

-- Owner can read their own file metadata. Writes come from the API
-- (service role bypasses RLS), so no insert/update policy is required.
drop policy if exists "project_file_meta_select_own" on public.project_file_meta;
create policy "project_file_meta_select_own"
  on public.project_file_meta for select
  using (auth.uid() = user_id);
