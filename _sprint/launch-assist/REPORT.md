# LAUNCH-ASSIST — Merge Report (PWA-Install-Block + Promo-Codes)

**Branch:** `claude/launch-assist-bbbq5s` (from master `ee0ae0e`) · **Status:** PR + HALT — merge founder-granted.
**Unit commits:** U1 `4147396` · U2 `a2084f0` · report (this) as a follow-up docs commit.

State-first (Phase 0): read `docs/GOBLIN_ARBEITSMETHODIK.md`; verified every file the prompt
named. Key finding that shaped U1 — the PR-#41 install affordance (`InstallAppHint`,
`lib/pwa-install.ts`) is real but mounted **only inside the authenticated `/dashboard`**, so a
logged-out visitor on the landing page never saw it. U1 fixes exactly that and REUSES that
detection lib. Next free migration was **0098** (matches the prompt's ≥0098).

---

## UNIT 1 — PWA-install block on the landing page (`4147396`)
A warm block mounted right under the Hero (`apps/web/app/page.tsx`), doing the MAXIMUM each
platform honestly allows, reusing `apps/web/lib/pwa-install.ts` (extended additively — the
dashboard hint and its tests are untouched):

| Platform | Affordance | Honest rule |
|---|---|---|
| Android / Desktop Chromium (Chrome/Edge/Opera) | real **"App installieren"** button → native dialog (captured `beforeinstallprompt`) | button only when the event fired; else an honest menu-route line — never a dead button |
| iOS / iPadOS Safari | two Share steps with the real share glyph | **no button** (Apple has no programmatic prompt) |
| macOS Safari | "Ablage → Zum Dock hinzufügen" | instruction, no button |
| Firefox / no install path | one honest line ("läuft voll im Tab") | no affordance |
| Already installed (standalone) | block hides entirely | — |

DE default + EN (`useLang`/`t`); landing-scoped tokens → dark+light auto; 375px reflow.

**Gate (numeric):** `lib/pwa-install.test.ts` **29/29** green (mode selection + the no-phantom-button
rule, incl. Edge/Chrome/Safari/Firefox/macOS UA cases). Evidence:
`evidence/launch-assist/install-block-harness.html` + `install-block-states.png` (all 5 states,
light+dark) + `install-block-375.png` (mobile reflow).

## UNIT 2 — Promo-Codes: 30 days top tier, single-use, no Stripe (`a2084f0`)
Built by **extending the existing comp mechanism** — `is_comped` already grants `power` with zero
Stripe; the only thing missing was an expiry, so U2 adds `users.comped_until` and one date check in
`derivePlanTruth`. A promo grant never creates a Stripe object → **no charge at expiry, by
construction**; degradation is lazy on read (like trial expiry, no cron).

- **Migration 0098 (authored, NOT applied):** `promo_codes` (+ service-role RLS), `users.comped_until`,
  and `redeem_promo_code()` — one transaction: per-account `FOR UPDATE` lock → v1 policy
  (free/trial/expired only) → **atomic conditional single-use claim** → grant. `SECURITY DEFINER`
  with `EXECUTE` locked to `service_role` (no escalation via `p_user`). Seeds **30** crypto-random
  `launch-1` codes (power, 30 days).
- **Enforcement (money-adjacent):** comp expiry threaded into the paywall gate, allowance
  enforcement, and billing/status through `withCompExpiry` — a best-effort `comped_until` read
  **gated on `is_comped`**, so the 99% non-comped path is byte-identical and a pre-0098 DB never
  errors (mirrors the 0093 pattern).
- **Redemption (both surfaces):** `POST /api/promo/redeem` (atomic, honest DE+EN, pre-migration
  tolerant, trial-gate-exempt) from the **settings/billing** field and the **signup** form (code
  carried past email confirmation and redeemed on first authed load by `PendingPromoRedeemer`).
- **Founder page `/admin/promo`** (reuses the `/admin` founder-gate + key-proxy; iPhone-first): code
  table with inline "wem gegeben" labels, **"Liste kopieren"** (unredeemed codes as plain text), and
  a batch generator (defaults 10/power/30).
- **Ledger M16** (same commit): promo tokens are **platform COGS**, bounded by the unchanged `power`
  allowance + Wave-D/K caps. Cost band from existing figures: **~$2.5/user·30d typical, ~$11 heavy,
  20-user batch $50 (typ) / $220 (heavy) / ≤$350 ceiling**.

**Gates (numeric):**
- Real-Stripe **money suites 17/17** (account-deletion 6 + change-plan 7 + change-plan-immediate 3 +
  guard 1) — RAN (not skipped), green **after** the entitlement change.
- Full **API suite 1018/1018**; `plan-truth` **21/21** (incl. 7 new expiry cases); `promo-code` **10/10**.
- **Migration applied to a real Postgres 16** and driven end-to-end (`evidence/launch-assist/promo-lifecycle-gate.md`):
  lifecycle (ok → single-use → one-per-account → already_paying → invalid → revoked) and **20-way
  concurrency race** → exactly **one** grant per code (19 `already_redeemed`) and exactly **one** per
  account (19 `already_redeemed_account`).

---

## Honest Limitations (mandatory)
1. **Migration 0098 is authored, not applied.** No promo exists in prod until the founder applies it.
   The lifecycle/race gate ran against a **local Postgres 16** with Supabase's `auth.role()`/`auth.uid()`
   stubbed and minimal `users`/`auth.users` shapes — faithful to the function logic, but not prod. The
   founder should do one real end-to-end redeem with a test account after applying (see actions).
2. **U1 screenshots are from a render harness** (mirrors the component markup + landing tokens), not a
   live Next render, and macOS-Safari / Firefox / device states are **simulated via UA** — the same
   evidence pattern as the existing `evidence/pwa-safearea` harness. The *mode-selection* logic is
   unit-tested deterministically; the *visual* proof is the harness.
3. **Web unit tests aren't wired into CI** (CI runs only API vitest). U1's tests pass via `npx vitest`;
   one **pre-existing** web suite (`lib/project-files.test.ts`) fails under vitest 4 with a JSX
   import-analysis error on `FileCardList.tsx` — **not touched by this wave**, flagged as a Finding.
4. **"One redemption per account" is strict in v1:** a user whose promo expired cannot redeem a second
   code (extend-not-stack and re-redeem-after-expiry are v2, as the prompt recommended). Copy is honest
   ("Du hast bereits einen Code eingelöst").
5. **Seeded codes are visible in the private repo** (and in `CODES_BATCH_1.txt`). Accepted for low-value
   single-use 30-day trial codes; the first claim burns each, and the founder can revoke leaks in
   `/admin/promo`. Future batches are generated at runtime and never touch the repo.
6. **Two secondary paths still read the comp without the expiry:** `services/storage-usage.ts` (storage
   cap) and `lib/achievement-card.ts` (celebration card) call `derivePlanTruth` on their own selects, so
   an *expired* promo user keeps the `power` **storage cap** (not a charge, not access) until they act.
   The access/enforcement/billing paths (paywall, allowance, status) DO honor expiry. Threading the
   remaining two is a small v2 cleanup (documented, not silently dropped).
7. **`billing/status.isComped` is now derived** (`truth.state==='comped'`) rather than the raw column —
   an expired promo correctly reports `isComped:false`. Intended, but a behavior change worth noting.

## Founder actions (iPhone-only — NO terminal anywhere)
1. **Apply migration 0098** in Supabase Studio → SQL Editor: paste `supabase/migrations/0098_promo_codes.sql`,
   Run. The 30 `launch-1` codes exist immediately.
2. **Copy `_sprint/launch-assist/CODES_BATCH_1.txt`** into iPhone Notes (30 codes, one per line) — ready
   before you even open the admin page.
3. **Open `/admin/promo`** on your iPhone → label each code ("wem gegeben"), or tap **"Liste kopieren"**
   to grab all unredeemed codes of a batch, or **generate a new batch** (count/tier/days).
4. **WhatsApp text suggestion** to a test user:
   > „Hey! Hier ist dein Goblin-Code für 30 Tage die beste Version, gratis: **GOBLIN-XXXX-XXXX**
   > — einlösen bei der Anmeldung im Code-Feld, oder später unter Einstellungen → Abo → „Hast du einen
   > Goblin-Code?". Viel Spaß!"
5. **Verify once** (recommended, per Honest-Limitation 1): with a test account (`vinc.hafner3@gmail.com`),
   redeem one code, confirm the plan shows `power` + the countdown, then move on.
