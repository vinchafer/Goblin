# Product Fixes F2–F6 + E2E Root Cause — Report

Date: 2026-06-21 · Branch `product-fixes-2026-06-21` → merged master `46eb294`
Model: Claude Opus 4.8 (autonomous). V-GATE live-verified on prod (vinc.hafner3).

---

## Findings → root cause → fix → proof

### F2 (P1, funnel-breaker) — Forge pick not carried into the chat ✅ FIXED + LIVE-VERIFIED
**Root cause:** the dashboard composer's model picker calls
`onModelChange={setSelectedModel}` (`dashboard/page.tsx`), which updates component
state but does **not** persist to `localStorage` — only `useChatModel.changeModel`
does. The new chat session mounts its own `useChatModel`, which loads the stale
`localStorage` default (Goblin Swift). The pick was never threaded to the chat.
**Fix:** carry the picked model with the seed. `sendComposer` and the "Neues Projekt"
path (dashboard → `app-context.newProjectModel` → `NewProjectModal`) now write
`goblin:seedModel:<id>` next to `goblin:seed:<id>`; `standalone-chat` reads it and
submits with that model (and syncs the composer pill). Files: `app-context.tsx`,
`dashboard/page.tsx`, `dashboard-shell.tsx`, `new-project-modal.tsx`,
`standalone-chat.tsx`.
**Proof (V-GATE, prod, real Forge call):** picked Goblin Forge → "Nur kurz im Chat"
→ chat composer = **Goblin Forge**, reply footer = **Goblin Forge**, idea
auto-submitted, **no raw slug**. Repeated on the **new-project** path (project
"FGate Test"): composer + footer **Goblin Forge**. Before the fix this same flow ran
Swift (`goblin/efficient`).

### F3 (P1, funnel-breaker) — idea dropped on "Neues Projekt" ✅ FIXED + LIVE-VERIFIED
**Root cause:** intermittent. The seed auto-submit ran in a mount effect that removed
the seed then deferred the actual submit via `setTimeout(0)`. A remount during the
navigation settle could consume the seed on a doomed first mount and lose the submit
→ empty chat. (Instrumented repro showed a clean single GET/REMOVE on the success
case; the failure case is the remount race.)
**Fix:** a module-level `consumedSeeds` guard (dedupes across remounts) + submit
**synchronously** (no `setTimeout`) with the explicit seed model — no macrotask
window to lose the submit. File: `standalone-chat.tsx`.
**Proof (V-GATE, prod):** "Neues Projekt" with an idea → chat carried the idea and
auto-submitted (`"Sage Hallo…"` present, no "Leg los" empty state). Also implicitly
exercised on the chat-only path.

### F4 (P2) — model-picker search hides Goblin models ✅ FIXED + LIVE-VERIFIED
**Root cause:** the "add an API key" empty-state fired when `byokModels.length === 0
&& freeModels.length === 0` — it ignored the Goblin-bundled (no-key) tiers, so
searching "Forge"/"Swift" (or any keyless user) saw the misleading key prompt.
**Fix:** include `hostedModels.length === 0` in the guard; when a query matches
nothing show "No models match …" instead. File: `ChatInput.tsx`.
**Proof (V-GATE, prod):** search "Forge" → **"Goblin Forge"** shown; no "add an API
key" state.

### F5 (P3) — "Reset in 0 Tagen" stale billing cycle ✅ FIXED + LIVE-VERIFIED
**Root cause:** the countdown used the `billing_cycle_start`-based `daysUntilReset`
(stale/zero on some accounts). The allowance actually resets at the calendar-month
boundary (`goblinCap.resetDate`, what `GoblinUsageBar` uses).
**Fix:** derive the countdown from `goblinCap.resetDate` when a cap exists, fall back
to the legacy value otherwise. Files: `SidebarUsage.tsx`, `UsagePage.tsx`.
**Proof (V-GATE, prod):** sidebar now reads **"Reset in 10 Tagen"** (to 1 July) —
was "0 Tagen".

### F6 (P3) — composer not clearing (unconfirmed) — NO FIX (not a bug)
`ChatInput.submit()` already clears the input (`setInput('')`) on every successful
submit. Across all V-GATE flows the composer cleared after sending. The single
earlier "retained text" observation was a CDP/Enter timing artifact (a stray `\n`),
not a product defect. Per the brief: logged unconfirmed, no fix invented.

### Bonus — two more two-level-truth leaks (same class as F1) ✅ FIXED
Re-grep after touching model labels (R-3) found raw slugs on two more surfaces:
`SessionThread.tsx` (code-session thread: "Goblin · goblin/efficient", finished +
streaming) and `project/[id]/page.tsx` (deploy rows uppercased raw `model_used`).
Both now route through `chatModelLabel`. V-GATE confirmed **no `goblin/efficient`,
`goblin/premium`, or `goblin_hosted`** on any chat surface.

---

## E2E weekly failure — ROOT-CAUSED + FIXED (see docs/E2E_ROOT_CAUSE.md)
**Real failing step:** `19-mobile-create-project` `waitForURL` 15 s timeout (both
attempts). **Cause:** CI built the web app but Playwright's `webServer` ran
`next dev`, which lazy-**compiles** routes on first request — the first hit of
`/dashboard/project/[id]` raced the compile against the 15 s wait. **Fix
(deterministic, not a timeout bump):** run the **production** server (`next start`
over the pre-built `.next`) in CI so routes are precompiled. Plus pinned every
workflow to **Node 22** (was a floating major '20' GitHub is migrating off). R-1
honored: real failing assertion identified, cause fixed, nothing skipped/deleted, no
blind timeout bump, "re-run green" not used as proof.

---

## Verification summary
- `tsc --noEmit` clean (web); web production build green (exit 0); **API tests 197/197**.
- Two-level-truth re-grepped; remaining raw-slug hits are non-surfaces (repo slug,
  onChange handlers) or the founder-gated `/admin/catalog`. Keys server-only.
- Neighbors intact: Swift build, Send-to-Code, publish, W1/W2/F1 all still work
  (exercised in the prior + this session).

## V-GATE result: **PASSED LIVE on prod** (not code-only).
Both funnel-breakers proven against real behavior on `vinc.hafner3`, both entry
paths, with a real Forge call. (Preview deploys are SSO-walled and carry no auth
cookie, and Forge needs the Railway-only key — so prod is the only place the real
authed Forge funnel exists. Verified immediately post-deploy; revert was ready if it
had failed.)

## Spend: ~$0.03 of the <$1 V-GATE budget (a handful of tiny Forge/Swift calls).

## Test artifacts left on vinc.hafner3 (founder cleanup)
Projects: "Notiz Test", "FGate Test", plus earlier "Cafe Testseite" / "[E2E-LIVE]
mob…"; several short chats. Not auto-deleted (avoid orphaning deploys / destructive
confirms).

## SHAs
- Branch `product-fixes-2026-06-21`: `0728889` (F2/F3), `8b00f2e` (F4/F5),
  `31b7066` (leaks), `2337e32` (E2E).
- Merged to master: **`46eb294`** (pushed; prod deployed + V-GATE verified).
