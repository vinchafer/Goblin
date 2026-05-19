-- 12-5: Per-project system instructions + project files index.

alter table public.projects
  add column if not exists instructions text;

create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  storage_key text not null,
  size_bytes bigint not null,
  mime_type text,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_project_files_project
  on public.project_files(project_id, uploaded_at desc);

alter table public.project_files enable row level security;

drop policy if exists "Users see own project files" on public.project_files;
create policy "Users see own project files"
  on public.project_files for select
  using (auth.uid() = user_id);
