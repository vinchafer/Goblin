# DD_FINDINGS — Master Register

Buyer-side technical due-diligence on Goblin. Skeptical, evidence-backed. Every PASS
cites an artifact; every FAIL cites file:line + repro. Banned in verdicts: should/looks/
appears/probably. Status ∈ {FIXED, RECOMMENDED, UNVERIFIED}.

Severity: **P0** breaks the core product / data-loss / secret leak · **P1** wrong behaviour a
user hits on a core flow · **P2** correctness/consistency a user can hit on the long tail ·
**P3** polish / hygiene.

Branch `dd-hardening-2026-06-20`. Nothing merged to master. No migration applied. No real spend.

---

## Register

| ID | Phase | Sev | Surface | Root cause (file:line) | Status | Evidence |
|----|-------|-----|---------|------------------------|--------|----------|
| P0-1 | P0 | P0 | Dashboard start composer | `apps/web/app/dashboard/page.tsx:216` `.gobl-hero` had `overflow:'hidden'` → clipped the `ChatInput` `ModelHub` dropdown (opens downward in hero) | FIXED | Removed `overflow:hidden`; border-radius still clips the fill, popover escapes. Web typecheck PASS; build PASS; founder re-walk = DD_REWALK §1 |
| P0-2 | P0 | P0 | Model picker (all 3 composers) | `apps/web/components/chat/ChatInput.tsx:137,263` `ModelHub` rendered every `goblin_hosted` row as a static non-clickable `<div opacity:.5>` + hard "SOON", ignoring the live `available` flag. 2nd SOON source Session 5 missed (it fixed only `model-switcher.tsx`). Same `ChatInput` powers dashboard hero + standalone-chat + workspace chat-tab | FIXED | Hosted rows now use the availability `filter` + shared selectable `ModelRow` with "INKLUSIVE · KEIN KEY". `catalog.test.ts` proves data contract (avail:true/badge GOBLIN_HOSTED, all plans). API 185/0; web typecheck+build PASS; DD_REWALK §2 |
| P0-3 | P0 | P0 | Swift/Forge end-to-end | n/a (verification) | FIXED | `goblin-hosted.test.ts`: "Swift streams… never leaks slug", "Forge routes to Kimi", "Swift on TRIAL". `catalog.test.ts` badge contract. All green (185/0). Live real-provider stream = founder (P-COST: no autonomous spend) |
| F4-1 | 4 | P1 | Usage view "Pro Modell" | `apps/api/src/routes/users.ts:124` shipped raw `agent_runs.model_used` to the client → leaked tier id `goblin/efficient` + raw BYOK slugs on `/dashboard/usage` AND Settings usage tab | FIXED | New `lib/model-label.ts` scrubs server-side (Goblin→public name; defensive "Goblin" for any goblin_hosted non-tier-id; BYOK humanized). `lib/model-label.test.ts` (5 tests). API 190/0 |
| F4-2 | 4 | P1 | Project chat enforcement | `apps/api/src/middleware/usage-limit.ts` (wired `chat.ts:44`) caps ALL tiers at `monthly_limit` (200 default) — incl. BYOK (UI promises "kein Limit von Goblin") and goblin_hosted (already capped by the weighted allowance). Applied ONLY to `/api/chat/stream`; standalone chat `/api/chat-sessions/*` has NO such cap → trivially bypassable + wrong-blocks legit users | RECOMMENDED | Trace: `usage-limit.ts` is the sole incrementer of `monthly_requests_used`; `billing.ts`/`admin.ts`/`support-agent.ts` + 3 web surfaces READ it. Removing enforcement freezes the counter → stale billing numbers. Coupled → DD_RECOMMENDATIONS §A (one ordered change-set + migration). NOT executed unattended (billing blast radius unverifiable here) |
| F4-3 | 4 | P1 | Two limit systems shown | Settings `UsagePage.tsx:75` shows weighted `GoblinUsageBar` AND legacy "Goblin-Anfragen X/Y" (monthly_limit); `dashboard/usage/page.tsx:31` leads with "X von Y Anfragen"; `SidebarUsage.tsx:87` pct bar vs monthly_limit | RECOMMENDED | Same coupling as F4-2 (the counter goes stale once enforcement is retired). Full display rewire to `totalInPeriod`/`goblinCap` documented in DD_RECOMMENDATIONS §A |
| F4-4 | 4 | P1 | Public pricing copy | `geo-pricing-section.tsx:16` (+ `pricing-cards.tsx:11`) advertise "200/800/3,000 **AI requests / month**" — the legacy metric. Numbers are ascending (no Build>Pro inversion in current code). "BYOK unlimited" is only honest once F4-2 enforcement is removed | RECOMMENDED | Coupled to F4-2 (can't honestly say BYOK-unlimited while the 200-cap still hits BYOK). DD_RECOMMENDATIONS §A step 4 |
| S2-5 | 2 | P2 | `web/app/api/test-auth/route.ts` | Layer-3 origin/host check is header-spoofable (`Origin`/`Host` are attacker-controlled) | RECOMMENDED | Backstopped by Layer-1 prod hardblock (`NODE_ENV+VERCEL_ENV==production`) + Layer-4 secret `TEST_AUTH_TOKEN`. Recommend: never set `ENABLE_TEST_AUTH` outside CI; exclude the route from prod builds. Not exploitable without the token |
| S2-6 | 2 | P2 | Weighted cap concurrency | `model-router.ts` reads month usage → checks `isOverMonthlyAllowance` → streams → records cost AFTER. Two concurrent requests can both pass the check (TOCTOU) and overshoot | RECOMMENDED | Overshoot bounded: per-request output ceiling 8096 tok × concurrency, and the per-day guard (`isOverDailyGuard`, 1M–12M cost units) is the backstop. Acceptable for fair-use; note for buyer. A hard atomic reserve would remove it |
| S2-7 | 2 | P3 | `routes/shared.ts` | Public share is gated only by `share_token`; revocation = clearing the token | RECOMMENDED | Confirm `share_token` is generated with crypto-strength entropy (UUID/nanoid) and consider an explicit `is_shared` flag for clearer revocation. No PII/user_id leak in the response (verified) |

| F5-1 | 5 | P2 | Model picker (free tier) | `config/providers.ts:213` marks `free_api` Gemini/Llama `available:true`, but the free pool is OFF (`model-router.ts:67` `FREE_API_POOL = []` — disabled by design). So the picker offers "Gemini 2.0 Flash · FREE" / "Llama 3.3 70B · FREE"; selecting one resolves via `resolveFreeApi()`→null → silently falls through to Goblin Swift (flag on) or "No model" (flag off) — user doesn't get the model they picked | RECOMMENDED | Coupled: `model-switcher.tsx:128` keyless DEFAULT also targets `free_api`. Safe fix = gate `free_api` in the catalog on free-pool-enabled (mirror the goblin flag) AND make the keyless default prefer goblin_hosted. DB-cache override (`models` table seed) means the catalog guard, not the static flag, is the reliable lever. DD_RECOMMENDATIONS §C |

### Phase 5 — PASS / verdict (evidence)
- **Free pool (Layer 1) — NOT live, by design.** `model-router.ts:64-67`: `FREE_API_POOL = []` ("Goblin does not resell provider free tiers; users connect their own keys"). `resolveFreeApi()` (line 157) iterates the empty pool → always null. The "Coming Soon" UI is HONEST: `SoftLimitBanner.tsx:26,52` gated off by `NEXT_PUBLIC_FREE_POOL_ENABLED` (default false, explicit false-promise guard); `GoblinUsageBar` flag-off shows "Bald verfügbar". → Mandate's "verify free pool live-or-not": it is genuinely not ready; the gating is correct. Leave gated. (The keyless wedge is instead served by the live Layer-2 Goblin-hosted Swift/Forge.) Side-bug = F5-1.
- **Telemetry reconciliation re-proven.** `goblin-telemetry.test.ts` (green, part of 190): "completion_costs tokens == telemetry rollup == cap rollup" + empty-month reconciles at 0; zero-token completions FLAGGED not dropped; malformed tokens (NaN/neg→0, no throw, still consistent); Forge×4.4 weighting; heavy tail ranked with "no PII beyond user id"; est. $ is a founder-only field. View is founder-gated (admin shared-secret, Phase 2 S2-1) and leak-free (tier split swift/forge, never slugs).

### Phase 2 — PASS verdicts (evidence)
- **Admin + investor endpoints unforgeable.** `admin.ts:9` / `investor.ts:27` fail-closed shared-secret headers (`x-admin-key`==`ADMIN_API_KEY`, `x-investor-token`==`INVESTOR_MODELS_TOKEN`; unset secret ⇒ 401). Web admin proxy `app/api/admin/[...path]/route.ts` runs `isAdmin()` (Supabase session `is_admin` OR `ADMIN_EMAIL`) BEFORE injecting the key, else 403. `investor.test.ts` (4) green. No Supabase-session path reaches these.
- **Per-route authN consistent.** `authMiddleware` applied `use('*')` or per-handler across builds/byok/chat/chat-sessions/code-sessions/deploy/integrations/models/onboarding/projects/secrets/send-to-code/support/templates/users/account/auth-2fa/billing. Public-by-design: auth, rankings, shared, waitlist, health, version, billing/webhook, github/callback.
- **AuthZ / IDOR-safe.** Resource routes scope by the authenticated `userId` even with the service-role client, e.g. `chat-sessions.ts:86` `.eq('id',sessionId).eq('user_id',userId)` ⇒ 404 if not owned.
- **Stripe webhook secure.** `billing.ts:249` `Stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)` ⇒ 400 on bad sig; event-id idempotency guard. No self-grant of a paid plan via forged events.
- **Secret hygiene.** "DeepInfra" only in server-side API code/comments + the legal `/privacy` sub-processor list (G-5-allowed). DeepInfra key + `INVESTOR_MODELS_TOKEN` read from server env only, never logged/echoed; stream meta carries the tier id, not the slug. No secret under any `NEXT_PUBLIC_*`. Only `.env.example` git-tracked (placeholders); `.gitignore` covers all real env files.

---

## Notes carried forward (to be worked in later phases)
- **Usage view name leak** (Phase 4): prior reports say the usage "Pro Modell" view leaked
  `llama-3.3-70b-versatile` and showed `goblin/efficient` instead of "Goblin Swift". Re-verify
  against current code; grep-prove zero slug/tier-id leaks across the whole web surface.
- **Two limit systems** (Phase 4): legacy request-count ("Goblin-Anfragen 46/200") vs the new
  weighted token allowance. Decision is MADE: unify on the weighted allowance; retire the legacy
  request-count everywhere it surfaces; fix landing/pricing copy (no "AI requests"; no Build>Pro).
- **Free pool "Coming Soon"** (Phase 5): verify live-or-not; ungate if real, else document the gap.
- **No web component-test harness** (Phase 1): apps/web has zero unit/component tests (no vitest/
  RTL/jsdom). Render-level regressions (like P0-2) cannot be caught in CI. → DD_RECOMMENDATIONS.
