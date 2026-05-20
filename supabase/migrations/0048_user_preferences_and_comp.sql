-- Session 15: User preferences + Comp flag + Invite codes

-- ─── Phase H: user preferences ────────────────────────────────────────────────
alter table public.users
  add column if not exists custom_instructions text,
  add column if not exists locale text default 'de',
  add column if not exists timezone text,
  add column if not exists notify_build_complete boolean not null default true,
  add column if not exists notify_important_updates boolean not null default true,
  add column if not exists notify_email boolean not null default false,
  add column if not exists memory_enabled boolean not null default false;

-- ─── Phase J: comp flag ───────────────────────────────────────────────────────
alter table public.users
  add column if not exists is_comped boolean not null default false,
  add column if not exists comp_reason text,
  add column if not exists comped_at timestamptz;

create index if not exists idx_users_is_comped on public.users(is_comped) where is_comped = true;

-- ─── Phase J: invite codes ────────────────────────────────────────────────────
create table if not exists public.invite_codes (
  code text primary key,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  max_uses int not null default 1,
  use_count int not null default 0,
  expires_at timestamptz,
  note text,
  grants_comp boolean not null default true
);

create index if not exists idx_invite_codes_redeemed
  on public.invite_codes(redeemed_by);

alter table public.invite_codes enable row level security;

-- Service role full access only. No public read/write — invite codes are validated server-side.
create policy "invite_codes service role" on public.invite_codes
  for all using (auth.role() = 'service_role');
