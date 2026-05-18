-- 11B-1: BYOK Tier 2 Encryption — per-user KEK via Supabase Vault.
-- Coexists with the existing v1 (scrypt-derived from ENCRYPTION_KEY) blob layout.
-- byok_keys.key_encrypted stays the storage column for both versions; format is
-- iv || authTag || ciphertext base64. The encryption_version column tells
-- decrypt which key derivation path to use; vault_secret_id points at the
-- per-user KEK row in vault.secrets for v2.

alter table public.byok_keys
  add column if not exists vault_secret_id uuid references vault.secrets(id) on delete set null,
  add column if not exists encryption_version int not null default 1;

create index if not exists idx_byok_keys_encryption_version
  on public.byok_keys(encryption_version);

-- Decrypt audit log — keeps PII out (only provider + ip + ua are recorded,
-- and entries cascade-delete with the user via FK on user_id).
create table if not exists public.byok_decrypt_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  byok_key_id uuid references public.byok_keys(id) on delete set null,
  provider text not null,
  operation text not null check (operation in ('decrypt_success', 'decrypt_fail', 'reencrypt')),
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_byok_decrypt_log_user_id_created
  on public.byok_decrypt_log(user_id, created_at desc);

alter table public.byok_decrypt_log enable row level security;

drop policy if exists "Users can view own decrypt log" on public.byok_decrypt_log;
create policy "Users can view own decrypt log"
  on public.byok_decrypt_log for select
  using (auth.uid() = user_id and created_at > now() - interval '90 days');

-- Vault helpers — service-role-only. Generate-or-fetch a per-user KEK, and
-- read its plaintext for the API to seal/unseal API keys with AES-256-GCM.
create or replace function public.get_or_create_user_kek(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = vault, public
as $$
declare
  v_secret_id uuid;
  v_secret_name text;
begin
  v_secret_name := format('byok_kek_user_%s', p_user_id::text);

  select id into v_secret_id
  from vault.secrets
  where name = v_secret_name
  limit 1;

  if v_secret_id is not null then
    return v_secret_id;
  end if;

  insert into vault.secrets (name, secret, description)
  values (
    v_secret_name,
    encode(gen_random_bytes(32), 'base64'),
    format('BYOK Key Encryption Key for user %s', p_user_id::text)
  )
  returning id into v_secret_id;

  return v_secret_id;
end;
$$;

revoke all on function public.get_or_create_user_kek(uuid) from public;
grant execute on function public.get_or_create_user_kek(uuid) to service_role;

create or replace function public.read_user_kek(p_secret_id uuid)
returns text
language plpgsql
security definer
set search_path = vault, public
as $$
declare
  v_kek text;
begin
  select decrypted_secret into v_kek
  from vault.decrypted_secrets
  where id = p_secret_id;

  return v_kek;
end;
$$;

revoke all on function public.read_user_kek(uuid) from public;
grant execute on function public.read_user_kek(uuid) to service_role;

comment on table public.byok_decrypt_log is
  'Audit log for BYOK key decrypt operations. Used for forensics. 90-day RLS read window.';
comment on function public.get_or_create_user_kek(uuid) is
  'Returns vault.secrets.id for a user''s KEK; creates the secret if missing. service_role only.';
comment on function public.read_user_kek(uuid) is
  'Returns the plaintext KEK for a vault.secrets.id. service_role only.';
