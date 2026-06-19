# DD_COVERAGE — coverage matrix

## Method (read this first — honesty about what "covered" means here)
This autonomous run had **no browser** (can't drive the user's Chrome without their
session) and a **no-spend** rule (no real DeepInfra calls). So coverage is by
**code-trace + runnable tests + a full production build**, NOT a 200-click pixel walk.
That is deliberate and matches the mandate ("COVERAGE not repetition; EVIDENCE not
opinion"): every route compiles and server-renders (build PASS, exit 0), the core
flows are traced end-to-end with their adversarial branches, and the security-critical
paths have tests. **Pixel-level layout at 390px and live click-through are deferred to
the founder re-walk (DD_REWALK)** — flagged per-row below, never claimed as verified.

Split rationale: depth on the CORE flows (model picker, streaming, usage, auth,
billing, telemetry, free-pool) where defects hide and money/secrets live; a single
evidence-backed compile+trace pass on the long tail.

Legend: ✓ verified (cited) · ◑ partial (compiles/traced, visual=rewalk) · ▢ rewalk-only
· n/a.

## Core user flows (the mandate's 10)
| # | Flow | Works? | Adversarial branches checked | Evidence |
|---|------|--------|------------------------------|----------|
| 1 | Sign-up → onboarding → first build | ◑ | unauth→login redirect; onboarding-trigger-fail → usage middleware allows (`usage-limit.ts:20-24`) | trace; build PASS; live=▢ |
| 2 | Model select (Swift/Forge) → stream → weighted bar | ✓ | flag off ⇒ no hosted rows; over-allowance ⇒ calm refuse; over-daily-guard ⇒ refuse | `catalog.test.ts`, `goblin-hosted.test.ts` (185-190/0); pixels=▢ (DD_REWALK 2-3) |
| 3 | Hit allowance → finish current → refuse next + reset | ✓ | monthly reached ⇒ `allowance_reached` calm copy + reset date | `goblin-hosted.test.ts` "refuses NEXT run once MONTHLY allowance reached" |
| 4 | Hit daily guard → same graceful behavior | ✓ | daily guard exceeded ⇒ next refused, resets tomorrow | `goblin-hosted.test.ts` "refuses NEXT run once DAILY guard exceeded" |
| 5 | BYOK → Layer-3 model → no Goblin allowance consumed | ◑ | key present ⇒ byok route; `free/` slug translated | trace `model-router.ts:347-367`; live=▢ |
| 6 | Free pool (Layer 1) | ✓ verdict | **OFF by design** (`FREE_API_POOL=[]`); UI coming-soon honest; F5-1 side-bug | `model-router.ts:64-67`; DD_FINDINGS Phase 5 |
| 7 | Publish/deploy loop (hydrate→save→deploy) | ◑ | edit→linked-asset reconcile is test-covered | `build-loop.test.ts` (4) green; live=▢ (DD_REWALK 7) |
| 8 | Billing: upgrade/downgrade/cancel; comped | ◑ | webhook bad-sig ⇒ 400; idempotent; comped skips limit | `billing.ts:249`; trace; live=▢ |
| 9 | Settings tabs (Profile/Billing/Usage/…/Models/Appearance) | ◑ | usage leak FIXED; usage shows weighted bar | `model-label.test.ts`; trace; visual=▢ |
| 10 | Project & chat lifecycle (create/rename/delete/switch) | ◑ | session ownership scoped by user_id ⇒ 404 if not owned | `chat-sessions.ts:86`; live=▢ |

## Route inventory (from the production build — all compile & SSR)
**Public/marketing:** `/`, `/pricing` ◑(copy F4-4), `/privacy` ✓(sub-processor list correct),
`/terms`, `/imprint`, `/manifesto`, `/help`, `/models`, `/models/[id]`, `/status`,
`/welcome` (+ `/integrations` `/language` `/provider` `/routing` `/tools`) — all build ✓, visual ▢.
**Auth:** `/login`, `/login/2fa`, `/register`, `/logout` — build ✓; 2FA routes auth-gated ✓.
**App:** `/dashboard` ✓(P0-1 fixed), `/dashboard/usage` ◑(F4-1 fixed, F4-3 open),
`/dashboard/billing`, `/dashboard/chat[/[sessionId]]` ✓(P0-2 fixed), `/dashboard/new`,
`/dashboard/project/[id]` (+`/work` `/secrets`), `/onboarding` — build ✓, flows traced, visual ▢.
**Admin (founder-gated):** `/admin/users|models|health|costs|rankings|telemetry` — auth ✓
(S2-1, proxy `isAdmin()` gate); telemetry leak-free ✓ (`goblin-telemetry.test.ts`).
**Shared/Demo:** `/shared/[token]` ✓(token-scoped, no PII leak — S2-7), `/demo-code`, `/demo-preview`.

## Dimensions
- **Renders desktop:** ✓ build PASS (exit 0), no compile/SSR errors on any route.
- **Renders 390px:** ◑ responsive code present (media `@max-width:480px` in dashboard,
  container queries in composers, GoblinUsageBar "legible at 390px" by construction);
  pixel correctness = ▢ founder re-walk.
- **Controls work:** ✓ for composer/model/usage/auth/billing/admin (traced/tested); ◑ long tail.
- **Copy correct:** audited model/usage/pricing/free-pool → leaks+legacy found (F4-1/4, F5-1);
  ✓ where fixed. Long-tail copy = spot-checked.
- **Adversarial:** ✓ auth/ownership/empty/over-limit/bad-sig on core+security; ◑ long tail.
- **EN/DE:** app is German-first (`useLang` default 'de'); pricing is EN; some app surfaces
  German-only (usage/sidebar) — parity gaps noted, not a blocker. Marketing `/welcome` has EN+DE.

## Honest gaps (what a buyer should still get a human to do)
- Live 390px visual pass of every route (▢ rows) — DD_REWALK.
- One real-provider Swift+Forge stream (P-COST deferred) — DD_REWALK 3.
- apps/web has no component tests (§B) — render regressions like P0-2 aren't CI-catchable today.
