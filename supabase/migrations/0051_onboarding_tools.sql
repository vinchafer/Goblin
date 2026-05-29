-- TASK B: onboarding_steps.tools_selection
-- Stores the user's tool-toggle preset + per-tool selection from /welcome/tools.
-- Shape: { "preset": "indie"|"starter"|"all_on", "tools": ["web_search", ...] }
-- Nullable so existing rows are unaffected.
-- Apply MANUALLY via Supabase SQL editor — project does not auto-run migrations.

alter table public.onboarding_steps
  add column if not exists tools_selection jsonb;

comment on column public.onboarding_steps.tools_selection is
  'User tool toggles + preset from /welcome/tools. JSON: {preset, tools[]}. Storage-only today — no run-time consumer yet.';
