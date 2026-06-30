-- Sprint 11: onboarding_steps.experience_level
-- Stores the Experience-fork answer from /welcome ("Kennst du dich mit Vibe
-- Coding aus?"). 'new' shows the explainer step; 'experienced' skips it. Lets
-- the Preference Flow adapt when re-run from Settings.
-- Nullable so existing rows are unaffected.
-- Apply MANUALLY via the Supabase SQL editor — project does not auto-run
-- migrations. SAFE: additive column only, no data migration, fully reversible
-- (drop column to revert).

alter table public.onboarding_steps
  add column if not exists experience_level text
    check (experience_level in ('new', 'experienced'));

comment on column public.onboarding_steps.experience_level is
  'Experience fork from /welcome: new (show vibe-coding explainer) | experienced (skip). Sprint 11.';
