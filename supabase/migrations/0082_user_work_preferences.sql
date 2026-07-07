-- FEEL-4 F4.2 — Nutzer-Präferenzen ("Wie Goblin arbeitet").
--
-- AUTHORED, NOT APPLIED (sprint hard rule): the founder applies this to the
-- shared Supabase after the feel-4 merge. Until then the API reads these columns
-- through a tolerant loader (services/user-preferences.ts) that returns null on a
-- missing-column error, and account.ts PUT retries without the pref_* fields — so
-- the feature ships dark and inert, never breaking preferences saves. Once applied,
-- the three controls become behavioral globally (all chats + agent runs). Probe 6.3
-- (Knapp + name → greeting uses name, report omits why; flip → flips) verifies live
-- at that point; pre-apply it is proven by the prompt-builder unit test.
--
-- All additive + nullable → zero risk to existing rows.

alter table public.users add column if not exists pref_address_name text;
alter table public.users add column if not exists pref_response_style text
  check (pref_response_style in ('knapp', 'ausfuehrlich'));
alter table public.users add column if not exists pref_explain_changes boolean;
