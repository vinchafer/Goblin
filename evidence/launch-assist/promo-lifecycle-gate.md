# LAUNCH-ASSIST U2 — Promo lifecycle + race gate (deterministic, real Postgres 16)

The migration `supabase/migrations/0098_promo_codes.sql` is **authored, not applied** (Law 4),
so it cannot run against prod yet. To verify the atomic single-use claim + grant for real
(not just by reasoning), the migration was applied verbatim to a throwaway local Postgres 16
cluster (Supabase's `auth.role()`/`auth.uid()` stubbed; `public.users`/`auth.users` minimal
shapes) and exercised end-to-end. Re-run: the commands live in the PR description / sprint notes.

## Migration applies cleanly + idempotently
```
MIGRATION APPLIED CLEANLY   (second apply → only "already exists, skipping" NOTICEs)
seeded launch-1 codes: 30
tier/days sample: power/30
```

## Lifecycle gate
```
1. free user redeems a real seeded code → ok
   {"days": 30, "tier": "power", "status": "ok", "comped_until": "2026-08-18T03:45:16Z"}
   grant landed: is_comped=true comp_reason=promo:GOBLIN-VB3D-F2MK days_out=30
2. SAME code, different free user → {"status": "already_redeemed"}   (single-use enforced)
3. same account, DIFFERENT code → {"status": "already_redeemed_account"} (one per account)
4. paying account (stripe_subscription_id set) → {"status": "already_paying"} (v1 policy)
5. nonexistent code → {"status": "invalid"}
6. revoked code → {"status": "revoked"}
7. code still shows a single redeemer (no double-claim)
```

## Race gate A — 20 different users redeem the SAME code concurrently
20 parallel `redeem_promo_code()` calls for one fresh code:
```
      1 ok
     19 already_redeemed
      1 redeemers_on_code=1
```
Exactly one grant. The single-use guarantee rests on one conditional UPDATE
(`... WHERE code=? AND redeemed_by IS NULL AND revoked=false RETURNING ...`): under
READ COMMITTED the second concurrent writer re-checks the predicate against the
now-claimed row, matches 0 rows, and returns `already_redeemed`.

## Race gate B — ONE account redeems 20 DIFFERENT codes concurrently
20 parallel calls, same account, distinct codes:
```
      1 ok
     19 already_redeemed_account
      1 codes_claimed_by_account=1
```
Exactly one grant. The `SELECT 1 FROM users WHERE id=p_user FOR UPDATE` at the top of the
function serializes redemptions per account, so a burst cannot stack two active promos.

## No charge at expiry (by construction)
The grant writes only `users.is_comped/comped_until/comp_reason/comped_at` — it never creates
a Stripe customer, subscription, payment method, or invoice. A promo-only account has no
`stripe_customer_id`, so nothing can charge it. At expiry `derivePlanTruth` stops returning
`comped` (comped_until in the past) and the account degrades to trial/none on the next read —
verified in `apps/api/src/lib/plan-truth.test.ts`. The real-Stripe money suites stay **17/17**.
