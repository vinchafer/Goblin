# L2 Go-Live + Telemetry Hardening + Cleanup — Session 4

Date: 2026-06-16 · Branch: master · Flag `GOBLIN_HOSTED_API` ON in prod (Session 2/3)

Status by workstream below. **One open gate: WS2 push/deploy awaits founder "push it"**
(checkpoint (b) — first prod-flip beyond Session 2/3). All code is committed locally,
green, and ready. **No migration was needed** (see WS3-d), so no HR-6 migration gate.

---

## WS1 — Trial allowance → $0.80 (4.9M / 1.0M)

`apps/api/src/lib/goblin-cap.ts`:
- `GOBLIN_MONTHLY_ALLOWANCE.trial` 3,100,000 → **4,900,000**
- `GOBLIN_DAILY_GUARD.trial` 600,000 → **1,000,000**
- `GOBLIN_DEFAULT_ALLOWANCE` / `GOBLIN_DEFAULT_DAILY_GUARD` (mirror "unknown plan = trial") → **4.9M / 1.0M**
- Header rationale updated: "$0.80 acquisition; ≈5× Bolt's free 1M + Forge access."
- Build / Pro / Power **unchanged** (17.4M / 30.0M / 61.7M; guards 3.5M / 6.0M / 12.0M). FORGE_WEIGHT 4.4 unchanged. Warn 0.8 unchanged. Per-request 8096 unchanged.

Tests recalibrated to the new numbers (`goblin-cap.test.ts`, `goblin-hosted.test.ts`):
the warn/over/daily-guard trial fixtures now use 1.1M Forge (warn), 5.0M Swift / 1.2M
Forge (over), 230K Forge (daily guard). No web hardcoded trial number existed (the bar
shows %). **API tests green (162).**

---

## WS2 — Push Live  ✅ DONE

Founder approved ("push it"). Pushed to `master`:
- `6725c03` — trial $0.80 + telemetry hardening + founder view (+ Session-3 bundle)
- `189f950` — policy re-audit + E2E root-cause fixes  ← **deployed HEAD**

`origin/master == HEAD == 189f950` (0 ahead / 0 behind).

**Prod verified (Railway API):**
- `GET /version` → `gitCommit: 189f9500…`, `env: production`, `apiReady: true` — the
  deployed commit is exactly Session-4 HEAD.
- `GET /health/deep` → `goblin_hosted: { status: "ok", state: "active", enabled: true }`;
  supabase / storage / stripe all `ok`; fresh build (uptime ~166s, buildTime 19:37Z).

Vercel (web) auto-deploys the same commit; local `pnpm --filter @goblin/web build`
exit 0 (all routes incl. `/admin/telemetry`, `/privacy`).

---

## WS3 — Telemetry Hardening + Founder View  *(the priority — "must hold 1000%")*

### a) What is tracked (audit → gaps closed)
Every Goblin-hosted call already writes ONE `completion_costs` row (via
`trackCompletion`, mig 0038) carrying: `user_id`, `created_at` (ts → date/month
derivable), `source_tier='goblin_hosted'`, `model` (= the tier id
`goblin/efficient`=Swift | `goblin/premium`=Forge → **tier derivable**), `tokens_in`,
`tokens_out`, `cost_usd`. So per-call user/ts/tier/in/out are all present. **Zero/unknown
provider tokens are never dropped** — `trackCompletion` always inserts, even at 0 tokens;
the new aggregator surfaces them explicitly as `zeroTokenCompletions` (recorded-and-flagged).

### b) Reconciliation — the 1000% guarantee
New pure module `apps/api/src/lib/goblin-telemetry.ts` (`aggregateTelemetry`) re-aggregates
the SAME rows the cap reads and proves three independent paths agree:

```
completion_costs raw tokens  ==  telemetry per-user rollup  ==  cap weighted rollup
```

`reconciliation.consistent` is false only if a row was dropped, double-counted, or
mis-tiered. The cap (`goblin-cap.ts`) and the telemetry rollup use the SAME
`weightedCostUnits` (Swift + Forge×4.4) on the SAME source, so the number the user
sees in the bar == the spend the founder pays. The founder view surfaces a red
**DIVERGENCE** banner if it ever breaks. Covered by `goblin-telemetry.test.ts`
(11 tests, incl. a 50-row mixed-traffic reconciliation and the empty-month case).

### c) Founder view — read-only, auth-gated (HR-2)
- **Endpoint:** `GET /api/admin/telemetry` (`apps/api/src/routes/admin.ts`) — read-only,
  no mutation. Gated by the EXISTING admin middleware (`x-admin-key` / `ADMIN_API_KEY`);
  no new auth scheme invented.
- **Page:** `/admin/telemetry` (`apps/web/app/admin/telemetry/page.tsx`) — reached through
  the existing `/api/admin/[...path]` proxy that injects the admin key server-side and is
  gated by the admin layout (session `is_admin` / `ADMIN_EMAIL` fallback). Linked from the
  admin sidebar ("Telemetry"). Design-system compliant, **legible at 390px** (iPhone).
- **Shows (current month):** total tokens with Swift vs Forge split, weighted cost units,
  estimated $ (founder-only), active users, avg tokens/user, completions + zero-token
  flagged count, per-plan distribution (trial/build/pro/power/other), the heavy-tail top-10
  by weighted units (by **user id only — no PII**), and the reconciliation banner. Labeled
  **"live · not yet calibrated."**
- **No leak:** no provider name, no model slug anywhere; `$` and the ×4.4 weight appear
  ONLY on this founder-gated surface (verified, WS6).

**iPhone access:** sign in as the founder account → open `https://<app>/admin/telemetry`
(or admin sidebar → Telemetry). The admin layout + proxy enforce founder-only; a normal
user is redirected to `/dashboard`.

### d) Schema decision — NO new migration
Per HR-6 I prefer the lowest-risk path. The endpoint aggregates `completion_costs`
directly with the service-role client (same pattern as `/api/admin/cost-summary`), so
**no VIEW and no migration are required** — nothing to gate, nothing for the founder to
apply. The 0067 rollup views remain applied and harmless (see WS5 cleanup).

---

## WS4 — Policy & Settings Re-audit

| Surface | Claim | Verdict |
|---|---|---|
| `/privacy` (legal) — Sub-processors | DeepInfra (US), SOC2/ISO, zero-retention OSS, SCCs; storage Backblaze B2 EU eu-central-003 | **Accurate** — no change |
| `/privacy` (legal) — §3 AI Processing & Transfers | US inference under SCCs, zero-retention OSS; storage stays EU; BYOK goes direct | **Accurate** — no overclaim |
| `/terms` (legal) | Generic ToS, no data-location claim | **Accurate** — no change |
| Settings → Datenschutz (`PrivacyPage.tsx`) | Tracking toggle, export, delete, links to /privacy + /terms | **Accurate** — no claims to fix |
| `/imprint` | Contact/legal entity only | **n.a.** — no data claims |
| Landing / FAQ | (Session 2 retired "Hetzner Frankfurt" → "EU") | **Accurate** — no remnants found |
| **Support bot KB** (`support-knowledge.ts`) | was "Hetzner Object Storage, Frankfurt. GDPR compliant." | **FIXED** — stale provider + overclaim; now states EU storage (Backblaze B2), US inference under SCCs/zero-retention, BYOK-direct; removed "GDPR compliant" overclaim |
| `apps/api/.env.example` storage header | "Hetzner Object Storage" | **FIXED** — naming → "Backblaze B2, EU eu-central-003 / S3-compatible" |
| `file-storage.ts` dev comment | "Hetzner Keys" | **FIXED** — naming → Backblaze B2 / S3-compatible |
| `PRODUCTION_CHECKLIST.md` | "Data stored in EU (Hetzner Germany) ✅"; "Hetzner storage bucket" | **FIXED** — mechanisms (EU storage + US-inference-under-SCCs), Backblaze B2 bucket; "fully compliant" wording avoided |

No "fully GDPR compliant" overclaim exists anywhere (repo-wide grep clean). No
"EU-first / EU-only inference" remnants. The arch doc compliance section lives in the
separate Pitch repo (`GOBLIN_ARCH_v6.md`), not this repo. EN/DE parity: the legal
`/privacy` + `/terms` are single-language legal documents (EN) by design; user-facing
settings copy is DE; the bilingual surfaces (e.g. `/help`) carry both — unchanged.

---

## WS5 — E2E Fix + Cleanup

### a) E2E — real failures root-caused and fixed (HR-7, no masking)
Local run: **@public-desktop 41/41 green.** @auth-desktop initially **11 passed / 2 failed**:

1. **`26-settings-structure` → "Profile: edit name, save, persists across reload"** — a
   **real product bug**, not a test problem. The "Vollständiger Name" field writes auth
   metadata `full_name`, but after FIX3-4 (canonical display name) `useUser.load` read
   BOTH `fullName` and `displayName` back from the `display_name`-priority resolver — so an
   edit to `full_name` was silently overwritten by `display_name` on reload (the field
   never persisted). **Fix:** `useUser.ts` now reads `fullName` from raw metadata
   `full_name` (falling back to the canonical name) while `displayName` stays canonical for
   the pill/ProfileCard. Founder-facing: editing your full name now sticks.

2. **`23-help-cleanup` → "/help renders FAQ + email CTA"** — obsolete assertion. `/help`
   became bilingual (EN→DE i18n); an unauthenticated visit defaults to German, so the
   English-only `What is Goblin?` matcher failed. **Fix:** assertion made language-agnostic
   (`Was ist Goblin?|What is Goblin?`) — asserts the FAQ contract in either language. No
   test deleted, skipped, or weakened in intent.

Re-run of both specs on auth-desktop: **6/6 green.** No `.skip`/`.only`/`fixme`, no timeout
bumps, no loosened matchers beyond the faithful bilingual one.

### b) Cleanup
- **goblin/* pricing (real $ for the founder view):** `model-pricing.ts` goblin rows were
  $-real already but Forge's blend overstated cost (~$1.20/M vs the locked $0.715/M). Re-set
  to match the LOCKED blended COGS from the financial model — Swift `0.147/0.294` (≈$0.162/M
  @9:1), Forge `0.650/1.300` (≈$0.715/M @9:1; out≈2×in). Marked **provisional**. This feeds
  `completion_costs.cost_usd` → the founder telemetry $ only; never a user surface.
  `FORGE_WEIGHT 4.4 = 0.715/0.162` stays consistent.
- **0067 rollup views:** there is **no code read path** to remove — the cap and the new
  telemetry endpoint both read `completion_costs` directly. The 0067 views
  (`goblin_hosted_monthly_tokens`, `goblin_hosted_current_month_tokens`) remain applied,
  `security_invoker`, and harmless (no reads, no PII). Documented as kept; a drop migration
  would be higher-risk churn for zero benefit.

### c) Build / test
API vitest **162/162**, API tsc clean, web tsc clean, `@goblin/web` build exit 0.

---

## WS6 — Self-audit

- **Two-level truth:** repo-wide grep — no provider name / model slug / "cost unit" / ×4.4 /
  `$` for Goblin on any NON-founder surface. DeepInfra appears ONLY in the `/privacy`
  sub-processor disclosure (required, allowed) and DeepSeek only as a user BYOK provider
  (unrelated to the bundled tiers). `$`/×4.4 appear only on `/admin/telemetry` (founder).
- **Secret hygiene (HR-4):** `DEEPINFRA_API_KEY` absent from the tree — only `.env.example`
  placeholder + Railway-only references; no real key value anywhere.
- **EN/DE parity:** user-facing policy copy unchanged where bilingual; legal docs are
  single-language by design.
- **Flag:** ON in prod (unchanged). **Migrations:** none added, none applied this session.

---

## Definition of Done — status

1. Trial 4.9M/1.0M ($0.80), others unchanged — **DONE** (live after WS2 push).
2. Session-3 work merged + deployed — **READY, gated on founder "push it".**
3. Telemetry records every call fully + reconciles exactly (proven by a check); zero
   tokens flagged not dropped — **DONE.**
4. Founder-only read-only auth-gated telemetry view, iPhone-legible, no leak, Swift/Forge +
   plan distribution + heavy tail — **DONE.**
5. Policy/settings re-audit with verdict table; truthful, no overclaim — **DONE.**
6. E2E root-caused + fixed (no masking); cleanup done — **DONE.**
7. Tests/build green, key absent, EN/DE parity — **DONE.**
8. This report + iPhone checklist; SHAs recorded — **after push.**

---

## Founder iPhone checklist (after WS2 push + deploy)

1. **Models live:** trial account → Model Hub shows **Goblin Swift + Goblin Forge**; both stream.
2. **Bar feels generous:** usage bar moves a little on Swift, ~4.4× faster on Forge; trial
   headroom feels generous (≈5× Bolt's free tier).
3. **At allowance:** the run that crosses the line finishes; the NEXT run is calmly refused
   with the reset date (no mid-build cut).
4. **Telemetry:** open `/admin/telemetry` → live tokens/users/plan split, Swift vs Forge,
   heavy-tail list, **Reconciled** banner green; numbers reconcile.
5. **Policy reads true:** `/privacy` + support answers say US inference under SCCs, EU storage,
   zero-retention OSS — no "Hetzner", no "fully GDPR compliant".
6. **Untouched:** BYOK + free-pool "Coming Soon" unchanged.
