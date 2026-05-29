-- TASK C: oauth_states.return_to
-- Lets the OAuth callback drop the user back where they started (e.g.
-- /welcome/integrations) instead of always /dashboard.
-- Nullable so existing flows fall back to the prior /dashboard target.
-- Apply MANUALLY via Supabase SQL editor.

alter table public.oauth_states
  add column if not exists return_to text;

comment on column public.oauth_states.return_to is
  'Relative same-origin path to redirect to after callback. Validated at write + read time. NULL = default /dashboard.';
