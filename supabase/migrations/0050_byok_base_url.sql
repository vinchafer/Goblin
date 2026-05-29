-- FIX 1.2: byok_keys.base_url for the `custom` provider.
-- Nullable so existing rows + first-party providers are unaffected.
-- Apply MANUALLY via Supabase SQL editor — project does not auto-run migrations.

alter table public.byok_keys
  add column if not exists base_url text;

comment on column public.byok_keys.base_url is
  'OpenAI-compatible endpoint URL for provider=custom rows. Null for first-party providers.';
