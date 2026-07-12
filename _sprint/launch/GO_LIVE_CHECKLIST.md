# GO-LIVE CHECKLIST — the founder's pre-first-invite list

**Runbook 3 · Launch-readiness · branch `claude/launch-readiness-audit-spr8at`**
Tick each box before inviting the first stranger. Items marked **🔑 secret** or **🌐 wifi**
are founder-only — this cloud session holds no live keys and cannot drive an external
browser, so it cannot perform them (honest BLOCKED, per environment rule 3). Everything a
code/copy audit **could** verify is folded into the Part-2 commits and `COLD_WALK.md`.

Legend: ☐ founder action · **[BLOCKED-here]** cannot be done in this sandbox · **[done]** landed on branch.

---

## A. Environment keys (set in prod / Railway + Vercel)

**Required — the app will not function without these:**
- ☐ `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 🔑, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ☐ `ENCRYPTION_KEY` 🔑 (32-byte hex — AES-256-GCM for BYOK at rest; **rotating it orphans every stored key**)
- ☐ `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` 🔑 / `GITHUB_REDIRECT_URI` (prod callback `https://api.justgoblin.com/api/github/callback`)
- ☐ `STRIPE_SECRET_KEY` 🔑 **(live `sk_live_…`, not test)** + `STRIPE_WEBHOOK_SECRET` 🔑
- ☐ `STRIPE_PRICE_*_TIER1` (Build/Pro/Power — TIER1 required as checkout fallback; TIER2/3 optional) pointing at **live-mode** prices matching `apps/api/src/config/geo-pricing.ts`
- ☐ `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` 🔑 / `VAPID_CONTACT`, and web `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (push "your app is live")
- ☐ `STORAGE_ENDPOINT/KEY🔑/SECRET🔑/BUCKET/REGION` (Backblaze B2, EU)
- ☐ `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_API_URL` set to prod hosts
- ☐ `RESEND_API_KEY` 🔑 + `SUPPORT_EMAIL_TO` + `SUPPORT_EMAIL_FROM` (**support & escalation email — see §F**)

**Optional / feature-gated (confirm intended state):**
- ☐ `GOBLIN_HOSTED_API` + `DEEPINFRA_API_KEY` 🔑 (Goblin Swift/Forge server-keyed inference). **If unset, the built-in models are unreachable** — Pricing/FAQ promise "Goblin Swift + Forge included", so this must be **on** for those claims to be true at launch. Never name the provider on a public surface (see `.env.example` + `infra/GOBLIN_HOSTED_ACTIVATION.md`).
- ☐ `ADMIN_API_KEY` 🔑 / `ADMIN_USER_IDS` (for `/admin/*`), `CRON_SECRET` 🔑
- ☐ `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENVIRONMENT=production`
- ☐ `BETTERSTACK_HEARTBEAT_URL` (eval-suite heartbeat)
- ☐ `FREE_*_API_KEY` / `LITELLM_*` — leave unset unless deliberately enabling
- ☐ `NEXT_PUBLIC_FREE_POOL_ENABLED` — leave unset; enabling turns on `SoftLimitBanner` trial/quota copy (verify that copy before flipping)

## B. Migrations (authored here; **applied by founder** — OS Law 4)

- ☐ Apply pending Supabase migrations through **`0090_delete_user_kek.sql`** (`npx supabase db push`). Launch-relevant recent ones: `0084_stripe_webhook_jobs`, `0085_platform_events_funnel`, `0086_support_tickets`, `0087_feedback`, `0088_agent_run_report`, `0089_drop_memory_enabled_placebo`, `0090_delete_user_kek`.
- ☐ Confirm applied: API startup logs no `[SCHEMA] Missing columns` warning (`apps/api/src/startup-migrations.ts` validates, never crashes). **[BLOCKED-here — needs prod DB]**

## C. Monitoring live

- ☐ `GET /health` returns `{status:"ok"}`; `GET /health/deep` returns `supabase:ok` + `storage:ok` (`apps/api/src/routes/health.ts`). **[BLOCKED-here — needs prod URL]**
- ☐ UptimeRobot monitor pointed at `/health` per `_sprint/webhook/UPTIMEROBOT_SETUP.md`.
- ☐ Sentry receiving events (throw a test error, confirm it lands).
- ☐ Both `/api/version` (api + web) return the merged SHA after deploy. **[BLOCKED-here]**

## D. Stripe live-mode sanity

- ☐ Keys are **live**, not test (`sk_live_`, `whsec_` from the live endpoint).
- ☐ Webhook endpoint registered at the live URL; `0084_stripe_webhook_jobs` applied so events durably queue.
- ☐ One **real** end-to-end checkout with a live card on the test account → subscription active, plan reflects, then cancel/refund. **[BLOCKED-here — live money, founder-only]** (proof pattern: `apps/api/scripts/prove-checkout-test.mts`, `verify-prices-live.mjs`).
- ☐ Trial → paid transition and `?reason=limit-hit` upgrade path show correct geo-tier price.

## E. Known-defect register (user-facing triage — from BUG_REGISTRY.md + this audit)

**Acceptable at launch (documented, non-blocking):**
- i18n single-language surfaces (LAUNCH_DECISIONS D-3) — acceptable **if** the launch cohort's locale matches each surface. Confirm cohort locale.
- `friendly-error.ts` names a raw model on a provider outage (D-4) — cheap fix pending founder word; low exposure.
- "What's new → /help" stand-in (D-5) — non-blocking.
- Preview-tab / dashboard jargon (D-2) — beginner friction, not breakage.

**Should-fix before invite (cheap, high-value):**
- ☐ D-2 first-run jargon gloss and D-4 model-name white-label — one commit each, founder to greenlight wording.
- ☐ D-1 agent selling section — Option A gated on the 375px beauty check.

**Already fixed on this branch (verify in the merged build):** L1 model label, L2 agent framing, L3 deploy-time claim, L4 builds-estimate label, L5 model sufficiency, L6 desktop-year, F1 login DE-leak, F2 chat empty-state, F3 explainer jargon.

## F. First-user support (surface exists — verify it's wired)

- The path exists: `/help` FAQ + `mailto:support@justgoblin.com` + `FeedbackModal` + `support_tickets` with Resend escalation. **This is the cheapest highest-value pre-launch safety net — confirm it actually delivers:**
- ☐ Send a test support message → escalation email arrives at `SUPPORT_EMAIL_TO`, and someone monitors that inbox on day one. **[BLOCKED-here — needs live Resend + inbox]**
- ☐ **Goblin-Hilfe 3-question gate + escalation email** end-to-end (ask 3 questions → correct answers → escalation on the 3rd). **[wifi]**

---

## G. Founder wifi-gate list (the human half — none of these are sandbox-doable)

- ☐ 🌐 **Real cold-start walk** on a fresh `vinc.hafner4@` account at **375px, prod**: signup → onboarding → empty dashboard → first build → Vercel JIT publish → live URL. Capture the tap-count and every dead end. (This audit did the *code/copy* half; the lived walk is yours — COLD_WALK.md is the map.)
- ☐ 🌐 **/admin/insight journey check** — funnel events firing (`publish_verified`, `upgraded`, `agent_run_finished`).
- ☐ 🌐 **Webhook live upgrade** — flip the Stripe webhook from test to live endpoint and confirm a live event processes (`_sprint/webhook/REPORT.md`).
- ☐ 🌐 **D + K prod adversarial probes** — run `_sprint/wave-d/SECURITY_AUDIT.md` steps against prod, plus: one **phishing/abuse fixture publish is blocked** (Wave-K publish-time scan) and a **legitimate own-app login flow passes** (no false-positive block).
- ☐ 🌐 **A-2 beauty check at 375px** — landing (post L1–L6) + first-run surfaces render clean on a real phone; needed before D-1 Option A merges.
- ☐ 🌐 **Walk-2 scenarios** — the standard multi-step user walkthroughs on prod.
- ☐ 🌐 **Act-II pitch walk + citation verification** — investor/pitch deployment paths and that every cited number resolves.

---

**HALT posture:** this session opened a PR and stopped. Merge is founder-granted (CLOUD RIDER rule 1). The blocked items above are blocked by *this environment*, not by the work — they are real launch gates that only a founder with keys and a phone can clear.
