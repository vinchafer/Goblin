-- P1.8 (speed measurement): add per-completion timing to completion_costs so we
-- can measure Swift latency BEFORE tuning it (founder reports Swift feels slow).
--
-- Two raw wall-clock measurements per streamed completion:
--   ttft_ms     = time to first token (ms): first streamed chunk − request start.
--                 The number the founder actually feels — how long the reply hangs
--                 before ANYTHING appears.
--   duration_ms = total generation wall time (ms): stream end − request start.
--                 tokens/sec is derivable (tokens_out ÷ duration_ms), so we do NOT
--                 store a redundant rate column.
--
-- Both nullable integers: non-streaming / BYOK sites where ttft is not meaningful
-- leave them NULL, and pre-migration rows stay NULL. These are per-completion
-- measurements, NOT monthly rollups — the monthly_costs_per_user view (0077) is
-- deliberately left untouched (timing does not sum across a month).
--
-- Idempotent (ADD COLUMN IF NOT EXISTS). NOT applied automatically — founder
-- applies via Supabase SQL Editor. The API write is pre-migration tolerant:
-- trackCompletion retries the insert without these timing columns (and without
-- project_id) if they are absent, so a pre-0080 (or pre-0077) DB never crashes and
-- never drops a cost row.

alter table public.completion_costs
  add column if not exists ttft_ms integer;

alter table public.completion_costs
  add column if not exists duration_ms integer;
