-- 11B-2: 2FA TOTP + recovery codes
-- 11B-3: Account lockout (login_attempts)
-- 11B-4: User-visible sessions

-- 1. 2FA settings per user. TOTP secret is sealed with the user's KEK
--    (same Vault pattern as BYOK), stored as a single base64 blob in
--    totp_secret_encrypted with iv||authTag||ciphertext layout.
create table if not exists public.user_2fa (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  totp_secret_encrypted text,
  totp_secret_vault_id uuid references vault.secrets(id) on delete set null,
  enabled_at timestamptz,
  last_used_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Recovery codes — bcrypt-hashed, single-use.
create table if not exists public.user_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  used boolean not null default false,
  used_at timestamptz,
  used_from_ip inet,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_recovery_codes_user_id
  on public.user_recovery_codes(user_id) where used = false;

-- 3. Login attempts — feeds account lockout. service-role-only.
create table if not exists public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ip_address inet,
  success boolean not null,
  failure_reason text,
  user_agent text,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_login_attempts_email_attempted
  on public.login_attempts(email, attempted_at desc);

-- 4. User-visible sessions. session_token_hash is SHA-256 of the Supabase
--    access_token; we never store plaintext tokens.
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_token_hash text not null,
  device_label text,
  ip_address inet,
  user_agent text,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked boolean not null default false,
  revoked_at timestamptz
);

create index if not exists idx_user_sessions_user_active
  on public.user_sessions(user_id, last_active_at desc) where revoked = false;
create index if not exists idx_user_sessions_token_hash
  on public.user_sessions(session_token_hash);
create index if not exists idx_user_sessions_expires
  on public.user_sessions(expires_at) where revoked = false;

alter table public.user_2fa enable row level security;
alter table public.user_recovery_codes enable row level security;
alter table public.user_sessions enable row level security;
-- login_attempts: no RLS, service-role only.

drop policy if exists "Users can view own 2fa status" on public.user_2fa;
create policy "Users can view own 2fa status"
  on public.user_2fa for select
  using (auth.uid() = user_id);

drop policy if exists "Users can view own sessions" on public.user_sessions;
create policy "Users can view own sessions"
  on public.user_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can revoke own sessions" on public.user_sessions;
create policy "Users can revoke own sessions"
  on public.user_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.user_2fa is 'TOTP setup. Secret sealed with per-user Vault KEK (same pattern as BYOK).';
comment on table public.user_recovery_codes is 'Single-use bcrypt-hashed 2FA backup codes.';
comment on table public.login_attempts is '5 failed attempts within 15 min triggers account lockout.';
comment on table public.user_sessions is 'User-visible session list with revoke UI.';
