-- FW5-U6 F-32 — server-side "purchase confirmation seen" flag.
--
-- AUTHORED, NOT APPLIED (sprint hard rule): the founder applies this to the shared
-- Supabase after the FW5 merge. Until then the API reads/writes this column through a
-- TOLERANT path: GET /api/billing/status reads it in a SEPARATE best-effort query (so a
-- missing column can never break /status), and POST /api/billing/confirm-plan returns
-- {ok:false} on a missing-column error rather than 500. The web PurchaseConfirmation
-- keeps the device-local localStorage as a fallback while the column is dark — so the
-- pre-migration behavior (per-device "show once") is preserved with zero regression.
--
-- Once applied, the flag becomes authoritative and per-user: the celebration shows once
-- per plan change and never re-fires on another device. It stores the resolved current
-- plan key (mirrors the old localStorage value `goblin_confirmed_plan`); a later plan
-- change makes last_confirmed_plan != plan again, so the next plan legitimately shows
-- once more.
--
-- Additive + nullable → zero risk to existing rows.

alter table public.users add column if not exists last_confirmed_plan text;
