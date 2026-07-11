-- WAVE-D · D-5 — account-deletion completeness: purge the per-user BYOK KEK.
--
-- Each user gets a Key Encryption Key stored in Supabase Vault under the name
-- `byok_kek_user_<uuid>` (see 0043 get_or_create_user_kek). When an account is hard-
-- deleted, byok_keys rows cascade from auth.users but the Vault secret does NOT — it is
-- referenced by byok_keys.vault_secret_id with ON DELETE SET NULL, so the KEK is left
-- orphaned in vault.secrets after the purge. Low sensitivity (a KEK is useless once the
-- ciphertext it wrapped is gone) but it is residual per-user material, so GDPR-Art.17
-- completeness means removing it too.
--
-- SECURITY DEFINER + service_role-only, matching the other KEK RPCs. Idempotent: a
-- missing secret is a no-op. Returns the number of secrets removed (0 or 1).

create or replace function public.delete_user_kek(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = vault, public
as $$
declare
  v_secret_name text;
  v_deleted integer;
begin
  v_secret_name := format('byok_kek_user_%s', p_user_id::text);

  delete from vault.secrets
  where name = v_secret_name;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.delete_user_kek(uuid) from public;
grant execute on function public.delete_user_kek(uuid) to service_role;

comment on function public.delete_user_kek(uuid) is
  'Removes a user''s BYOK KEK from vault.secrets on account deletion. service_role only, idempotent.';
