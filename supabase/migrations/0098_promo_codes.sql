-- LAUNCH-ASSIST U2 — Promo-Codes: 30 days of the TOP tier, single-use, no Stripe.
--
-- AUTHORED, NOT APPLIED (Law 4): the founder applies this in Supabase Studio after
-- merge. The moment it is applied, the 30 seeded "launch-1" codes EXIST and can be
-- redeemed. Every API path is PRE-MIGRATION TOLERANT: before this migration is applied
--   • POST /api/promo/redeem calls redeem_promo_code() → the function is absent →
--     the route returns an honest "noch nicht verfügbar" (never a 500), and
--   • the entitlement resolver reads users.comped_until through a SEPARATE best-effort
--     query (see apps/api/src/lib/comp-expiry.ts, mirroring the 0093 pattern) that is
--     only issued for already-comped users, so a pre-0098 DB never errors and the
--     paywall/enforcement paths are byte-identical for the 99% non-comped case.
-- Additive + idempotent (IF NOT EXISTS / CREATE OR REPLACE).
--
-- WHY reuse the comp mechanism: is_comped already grants the top tier ('power'
-- allowance) with ZERO Stripe involvement (no customer, no subscription, no card) —
-- derivePlanTruth checks it first (apps/api/src/lib/plan-truth.ts). The ONLY thing it
-- lacked was an EXPIRY. So this adds one nullable column, users.comped_until, and the
-- resolver degrades honestly on read once it passes (no cron needed — exactly how
-- trial expiry already works via cloud_trial_ends_at). A promo grant therefore can
-- never trigger a charge (there is no card to charge) and degrades to the free tier
-- at expiry. Existing permanent founder comps keep comped_until = NULL → unchanged.

-- ── 1) the comp-expiry column ───────────────────────────────────────────────────────
--   NULL  = permanent comp (today's founder-comp semantics, untouched).
--   value = access ends at this instant; derivePlanTruth stops returning 'comped' then.
alter table public.users add column if not exists comped_until timestamptz;

-- ── 2) the promo_codes table ────────────────────────────────────────────────────────
--   code           = the human code (PK, unique). Stored uppercase, GOBLIN-XXXX-XXXX.
--   tier           = the granted tier (v1: always 'power', the top paid tier).
--   duration_days  = grant length from the redemption moment (v1: 30).
--   created_batch  = batch label so the founder can copy/generate per batch ('launch-1').
--   label          = "wem gegeben" — free text the founder edits inline in /admin/promo.
--   redeemed_by    = the account that claimed it (NULL until claimed) — the single-use lock.
--   redeemed_at    = when it was claimed.
--   revoked        = founder kill-switch; a revoked code can never be claimed.
--   created_at     = when the row was created (seed time / batch time).
create table if not exists public.promo_codes (
  code          text primary key,
  tier          text not null default 'power' check (tier in ('build', 'pro', 'power')),
  duration_days int  not null default 30 check (duration_days > 0 and duration_days <= 365),
  created_batch text not null default 'launch-1',
  label         text,
  redeemed_by   uuid references auth.users(id) on delete set null,
  redeemed_at   timestamptz,
  revoked       boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.promo_codes enable row level security;

-- Service-role only — exactly like invite_codes (0048). All reads/writes go through the
-- server (the founder page via the admin key-guard, redemption via the SECURITY DEFINER
-- function below). No anon/authenticated policy → no user can read the code table.
drop policy if exists "promo_codes service role" on public.promo_codes;
create policy "promo_codes service role" on public.promo_codes
  for all using (auth.role() = 'service_role');

-- Founder page lists by batch; the "one redemption per account" check reads by redeemer.
create index if not exists idx_promo_codes_batch on public.promo_codes (created_batch, created_at);
create index if not exists idx_promo_codes_redeemed_by on public.promo_codes (redeemed_by);

-- ── 3) atomic single-use redemption + grant ─────────────────────────────────────────
-- One transaction does the WHOLE thing so there is no race and no partial state:
--   • locks the user row (per-account serialization — two concurrent redeems by the
--     same account cannot both grant),
--   • enforces the v1 policy (free/trial/expired accounts only; never a paying account,
--     never a permanent comp, one redemption per account),
--   • claims the code with a CONDITIONAL update (`redeemed_by IS NULL AND NOT revoked`)
--     that only the first concurrent caller can satisfy — this is the single-use guard,
--   • grants is_comped + comped_until = now()+duration on success.
-- Returns a jsonb {status, ...}; the API maps status → honest DE+EN copy.
create or replace function public.redeem_promo_code(p_code text, p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code         text := upper(trim(p_code));
  v_tier         text;
  v_days         int;
  v_is_comped    boolean;
  v_comped_until timestamptz;
  v_sub          text;
  v_row_exists   boolean;
  v_revoked      boolean;
  v_until        timestamptz;
begin
  -- Per-account lock: serialize redemptions for this user.
  perform 1 from public.users where id = p_user for update;

  select is_comped, comped_until, stripe_subscription_id
    into v_is_comped, v_comped_until, v_sub
    from public.users where id = p_user;

  if not found then
    return jsonb_build_object('status', 'user_not_found');
  end if;

  -- v1 policy (extend-not-stack is v2): only free/trial/expired accounts.
  if v_sub is not null then
    return jsonb_build_object('status', 'already_paying');
  end if;
  -- A permanent founder comp (no expiry) must never be stamped with one.
  if v_is_comped and v_comped_until is null then
    return jsonb_build_object('status', 'already_comped');
  end if;
  -- One redemption per account (also blocks a second, stacked active promo).
  if exists (select 1 from public.promo_codes where redeemed_by = p_user) then
    return jsonb_build_object('status', 'already_redeemed_account');
  end if;

  -- Atomic single-use claim.
  update public.promo_codes
     set redeemed_by = p_user, redeemed_at = now()
   where code = v_code and redeemed_by is null and revoked = false
   returning tier, duration_days into v_tier, v_days;

  if not found then
    -- Why did the claim miss? Give an honest reason.
    select true, revoked into v_row_exists, v_revoked
      from public.promo_codes where code = v_code;
    if v_row_exists is null then
      return jsonb_build_object('status', 'invalid');
    elsif v_revoked then
      return jsonb_build_object('status', 'revoked');
    else
      return jsonb_build_object('status', 'already_redeemed');
    end if;
  end if;

  v_until := now() + make_interval(days => v_days);

  update public.users
     set is_comped    = true,
         comped_until = v_until,
         comp_reason  = 'promo:' || v_code,
         comped_at    = now()
   where id = p_user;

  return jsonb_build_object('status', 'ok', 'tier', v_tier, 'days', v_days, 'comped_until', v_until);
end;
$$;

-- SECURITY: this function is SECURITY DEFINER and takes p_user, so it must NEVER be
-- callable directly by anon/authenticated PostgREST clients — that would let a user
-- grant comp to an arbitrary account (privilege escalation, RLS bypass). Only the
-- service role (our server, which passes the JWT-verified userId) may execute it.
revoke all on function public.redeem_promo_code(text, uuid) from public;
revoke all on function public.redeem_promo_code(text, uuid) from anon;
revoke all on function public.redeem_promo_code(text, uuid) from authenticated;
grant execute on function public.redeem_promo_code(text, uuid) to service_role;

-- ── 4) seed the first batch (launch-1): 30 crypto-random codes, top tier, 30 days ────
-- HONEST CAVEAT (report): these 30 codes are visible in this private repo. That is
-- acceptable for low-value, single-use, 30-day trial codes — the first claim burns each
-- one, and the founder revokes any that leak via /admin/promo. Future batches are
-- generated at runtime from /admin/promo and never touch the repo. The same 30 codes are
-- also in _sprint/launch-assist/CODES_BATCH_1.txt (one per line) for immediate copy.
-- ON CONFLICT DO NOTHING so re-applying the migration never duplicates or resets a code.
insert into public.promo_codes (code, tier, duration_days, created_batch) values
  ('GOBLIN-VB3D-F2MK', 'power', 30, 'launch-1'),
  ('GOBLIN-K28X-YXE7', 'power', 30, 'launch-1'),
  ('GOBLIN-KZJZ-VZVF', 'power', 30, 'launch-1'),
  ('GOBLIN-WQ8Z-3JP7', 'power', 30, 'launch-1'),
  ('GOBLIN-KUBP-KNKG', 'power', 30, 'launch-1'),
  ('GOBLIN-X8M9-B2DX', 'power', 30, 'launch-1'),
  ('GOBLIN-VDTS-J5HM', 'power', 30, 'launch-1'),
  ('GOBLIN-JDHB-WCXB', 'power', 30, 'launch-1'),
  ('GOBLIN-CV5D-7BZ8', 'power', 30, 'launch-1'),
  ('GOBLIN-MEXB-CGNX', 'power', 30, 'launch-1'),
  ('GOBLIN-MWSC-H87J', 'power', 30, 'launch-1'),
  ('GOBLIN-85M6-THA5', 'power', 30, 'launch-1'),
  ('GOBLIN-MJGW-8RU8', 'power', 30, 'launch-1'),
  ('GOBLIN-9CSG-PP6Y', 'power', 30, 'launch-1'),
  ('GOBLIN-YPTC-3DWA', 'power', 30, 'launch-1'),
  ('GOBLIN-VC7P-YW78', 'power', 30, 'launch-1'),
  ('GOBLIN-VNVJ-CRTX', 'power', 30, 'launch-1'),
  ('GOBLIN-NAYS-KJFG', 'power', 30, 'launch-1'),
  ('GOBLIN-Y4PB-N6SJ', 'power', 30, 'launch-1'),
  ('GOBLIN-5PH8-HSB7', 'power', 30, 'launch-1'),
  ('GOBLIN-EH5H-PNPF', 'power', 30, 'launch-1'),
  ('GOBLIN-REAZ-4SMX', 'power', 30, 'launch-1'),
  ('GOBLIN-RQA5-RWW7', 'power', 30, 'launch-1'),
  ('GOBLIN-XBAE-X2NX', 'power', 30, 'launch-1'),
  ('GOBLIN-JF8R-8WEA', 'power', 30, 'launch-1'),
  ('GOBLIN-2WH3-VJJJ', 'power', 30, 'launch-1'),
  ('GOBLIN-GKV2-6ZH5', 'power', 30, 'launch-1'),
  ('GOBLIN-CF5S-C7V9', 'power', 30, 'launch-1'),
  ('GOBLIN-Y483-2JCZ', 'power', 30, 'launch-1'),
  ('GOBLIN-QEW3-YG75', 'power', 30, 'launch-1')
on conflict (code) do nothing;
