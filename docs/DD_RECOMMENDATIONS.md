# DD_RECOMMENDATIONS — what to finish to reach "IPO-ready"

Items I did NOT fix in the autonomous pass — because they need a product decision, a
migration the founder must apply, a live check, or a refactor whose blast radius
(billing) I could not verify without prod. Each has a concrete, ordered action.

---

## §A — Retire the legacy request-count limit system (unify on the weighted allowance)

**Why it's here, not FIXED:** the decision (unify on the weighted token allowance) is
made and correct, but the change is one tightly-coupled unit with a **billing blast
radius I cannot verify in an unattended sandbox**, and a partial edit makes things
*worse*, not better. Specifically:

- `users.monthly_requests_used` is incremented in exactly ONE place:
  `middleware/usage-limit.ts`. Remove that middleware and the counter FREEZES.
- That same (now-frozen) counter is READ by `routes/billing.ts` (lines 103-104,
  228-234), `routes/admin.ts`, `services/support-agent.ts`, and three web surfaces
  (`SidebarUsage.tsx`, `app/dashboard/usage/page.tsx`, `settings/UsagePage.tsx`).
- The pricing claim "BYOK unlimited" is only HONEST once the 200-cap stops hitting
  BYOK (today `usage-limit.ts` caps every tier on `/api/chat/stream`).

So enforcement, billing reads, three displays, and pricing copy must move together.
Half of it (e.g. "just delete the middleware") leaves stale numbers in billing/admin.

**The bug being retired (real, user-facing):** on `/api/chat/stream` (project chat)
a BYOK or Goblin user is blocked at `monthly_limit` (200 default) — wrong on both
counts (BYOK is the user's own key; Goblin is already governed by the weighted
allowance). The standalone-chat path `/api/chat-sessions/*` has NO such cap, so the
limit is also trivially bypassable — it only penalises the project-chat user.

**Ordered, safe execution (review as ONE PR):**
1. **API source of activity.** `GET /api/users/me/usage` already returns
   `totalInPeriod` (real `agent_runs` count) + `byTier`. Switch every display off
   `monthlyUsed`/`monthlyLimit` and onto `totalInPeriod`/`byTier` (activity) and
   `goblinCap` (the weighted Goblin allowance, already computed there).
2. **Displays** (German surfaces — keep the existing locale):
   - `settings/UsagePage.tsx`: delete the "Goblin-Anfragen X/Y" block (lines ~75-91);
     keep `GoblinUsageBar` (Goblin allowance) + the BYOK count row (`byTier.byok`).
   - `app/dashboard/usage/page.tsx`: rewrite `statusSentence()` to read as activity
     ("Du hast diesen Monat X Anfragen gestellt"), not "X von Y" cap; keep the
     weighted `GoblinUsageBar`.
   - `components/sidebar/SidebarUsage.tsx`: replace the `monthlyUsed/monthlyLimit`
     percent bar with the `goblinCap.percent` bar (fetch `goblinCap` here too), or a
     plain activity count when `goblinCap` is null. Comped path already correct.
3. **Enforcement.** Remove `usageLimitMiddleware` from `routes/chat.ts:44` (keep
   `chatStreamRateLimit` — the per-minute burst guard stays). Goblin spend remains
   capped by the weighted allowance + daily guard in `model-router.ts` (tested:
   "refuses NEXT run once daily guard / monthly allowance reached"). Delete
   `middleware/usage-limit.ts` (now unused) — grep first to confirm no other import.
4. **Pricing copy** (`geo-pricing-section.tsx` + `pricing-cards.tsx`): drop
   "N AI requests / month". Honest replacement (no token economics — two-level
   truth): "BYOK — all providers, no limits" + "Goblin-bundled models included"
   (with a per-tier qualifier if a user-facing allowance unit is chosen — see the
   open product question below). EN + the German surfaces in parity.
5. **Billing/admin/support.** `billing.ts` (`used`/`limit`/`byok_count`), `admin.ts`
   user table, and `support-agent.ts` context all read `monthly_requests_used`.
   Repoint to `totalInPeriod` (or drop the figure from the founder/admin view if not
   useful). Admin/support are internal — lower priority, but don't leave them
   reading a frozen counter.
6. **Migration (file only, founder applies — G-6).** Once nothing reads them, write
   the next sequential migration to drop `users.monthly_requests_used` and
   `users.monthly_limit` (and remove `monthlyRequests` from `config/plans.ts` +
   `billing-service.ts` writes). Until applied, the columns are harmless dead weight.
7. **Tests.** Add an api test that `/api/chat/stream` no longer 429s a BYOK user
   under heavy count; keep the weighted-allowance refusal tests.

**Open product question (needs founder):** how to express the per-plan Goblin
allowance on the pricing page without leaking cost units/tokens/the 4.4 weight. The
weighted numbers (Build 17.4M / Pro 30M / Power 61.7M cost units) cannot be shown
verbatim. Options: a derived "≈ N builds/month" proxy, a qualitative ladder
(included → larger → largest), or storage + "generous AI allowance". This wording
is the only thing blocking step 4 from being purely mechanical.

---

## §B — Add a component-test harness to apps/web

apps/web has **zero** unit/component tests (no vitest/RTL/jsdom). The P0-2 "SOON"
regression lived in JSX and could not be caught by any automated test — only the
data contract (api `catalog.test.ts`) and a build/typecheck are runnable today.
Action: add `vitest` + `@testing-library/react` + `jsdom` + a `@/`-alias vitest
config to apps/web, and port the P0-2 case (render `ModelHub` with an available
goblin_hosted model → assert the row is a `<button>` (enabled) and the badge text
is not "SOON"). Small, isolated, high leverage for future render regressions.

---

(Further recommendations appended as later phases complete.)
