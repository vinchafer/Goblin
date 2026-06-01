-- 0056_deployments.sql — Sprint 8: persistent deploy history per project.
-- Each successful Vercel deploy logs a row so the project hub + Code Tab can
-- list ALL live URLs (not just the latest projects.preview_url snapshot).
-- API inserts via service role; reads are RLS-gated to the owner.

create table if not exists public.deployments (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects(id) on delete cascade,
  user_id              uuid not null references auth.users(id) on delete cascade,
  url                  text not null,
  vercel_deployment_id text,
  session_id           uuid references public.code_sessions(id) on delete set null,
  created_at           timestamptz not null default now()
);

create index if not exists deployments_project_created_idx
  on public.deployments (project_id, created_at desc);

alter table public.deployments enable row level security;

-- Owner can read their own deploy history. Inserts come from the API
-- (service role bypasses RLS), so no insert policy is required.
drop policy if exists "deployments_select_own" on public.deployments;
create policy "deployments_select_own"
  on public.deployments for select
  using (auth.uid() = user_id);
