-- 0054 — Fix search_path on Vault KEK functions (R4)
--
-- Root cause (see V2_VAULT_INFRA_2026-05-31.md): migration 0043 declares
-- get_or_create_user_kek / read_user_kek with `search_path = vault, public`,
-- but get_or_create_user_kek calls UNQUALIFIED gen_random_bytes(32) (0043 L65).
-- On Supabase, pgcrypto's gen_random_bytes lives in the `extensions` schema,
-- which is NOT on that search_path → "function gen_random_bytes(integer) does
-- not exist" → v2 (Vault KEK) encryption fails → silent v1 fallback.
--
-- This is a search-path bug, NOT a missing extension (pgcrypto ships in the
-- extensions schema on Supabase by default). Fix = add `extensions` to the
-- function search_path so the unqualified pgcrypto call resolves.
--
-- After this is applied, existing v1 rows lazily re-encrypt to v2 on next
-- decrypt (the code already attempts this; the "lazy v1->v2 reencrypt failed"
-- log line is exactly this path failing on the same root cause).
--
-- Safe / idempotent: ALTER FUNCTION ... SET search_path only changes the
-- function's resolution path; it does not rewrite the function body and can be
-- re-run without side effects. No data is touched.

ALTER FUNCTION public.get_or_create_user_kek(uuid)
  SET search_path = vault, public, extensions;

ALTER FUNCTION public.read_user_kek(uuid)
  SET search_path = vault, public, extensions;
