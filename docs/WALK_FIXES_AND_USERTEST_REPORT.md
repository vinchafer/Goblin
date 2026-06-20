# Walk Fixes + Guarded User-Test — Report

Date: 2026-06-21 · Branch `walk-fixes-2026-06-21` (off master `4433222`)
Author: Claude Opus 4.8 (autonomous walk-fix run)

---

## PART 1 — The two walk findings

### W1 — Sidebar usage now shows the consumption bar ✅
**Symptom (founder walk):** the sidebar showed only text (a Build count + plan
badge), no visual bar of how much of the monthly Goblin allowance is used — even
though the full usage page has one.

**Root cause:** `components/sidebar/SidebarUsage.tsx` had a working allowance bar,
but it lived *after* an `isComped` early-return that rendered a text-only
"Vollzugriff" state. The reasoning in that branch ("comped users have no cap, a
percent would be a lie") is **false against the current code**: the weighted monthly
allowance is enforced in `apps/api/src/services/model-router.ts` (~line 485) with
**no comped bypass** — comped accounts are capped against their plan's allowance just
like everyone else. The founder's account is comped → it always hit the text-only
branch → "no bar." (The usage *page* has no such early-return, which is why the bar
showed there — matching the walk: "usage page good.")

**Fix:** show the allowance bar whenever `goblinCap` exists (comped included, since it
is honest), and only fall back to the plain Build count when there is no cap (flag
off / no goblin usage). The plan badge still renders "Vollzugriff" for comped via
`planLabel(plan, isComped)`. Also aligned the bar to the design system + the main
`GoblinUsageBar` semantics:
- gold (filled) at warn/over, brand green at ok — from the server `state`, not an
  ad-hoc `pct >= 90` red (H-4: gold is a filled surface, never a border);
- a min 2% fill so low usage is still visibly a bar, not an empty track;
- 6px rounded track + `role="progressbar"` a11y; % only (two-level truth, HR-4);
- EN/DE preserved.

**Verification:** `tsc --noEmit` clean; production build green (see end). No web unit
test infra exists (`apps/web` has no vitest), so no unit test added; the logic is a
straight render-branch change. Live visual confirmation deferred to the (blocked)
user-test.

### W2 — The vanishing / unrecoverable build window ✅ (contained) + logged remainder
Full write-up in `docs/W2_DIAGNOSIS.md`. Summary:

**Root cause:** `components/project/project-workspace.tsx` derived the active surface
**only** from `?tab=` and **fell back to `chat` on every effect run**. Any return to
the workspace without `?tab=` (soft-nav, a re-render that re-emits `searchParams`,
plain back-navigation) snapped the user off the code/preview surface back to chat —
the build/preview **window "vanished."** The **work itself was never lost**: agent
draft files persist server-side, and a specific session is deep-linkable
(`useCodeSessions` honors `?session=<id>`; the hub's `RecentSessionsCard` links to
`…/work?tab=code&session=<id>`). The window was a *view-state* casualty, and the
obvious recovery (sidebar) lands on the hub, not the live window — so it read as
"not recoverable."

**Fix (contained):** persist the active tab per project
(`sessionStorage 'goblin:wsTab:<projectId>'`) and restore it when no explicit `?tab=`
is present; explicit `?tab=` still wins. The build/preview window now stays in place
across navigation/remount. No schema change, streaming/persistence path untouched.

**Logged (not fixed — needs more than a safe contained change):**
- **F-W2-a (P2):** clicking a project in the sidebar lands on the hub, not the live
  `/work` window. Recovery is one extra click (hub → "Letzte Code-Sessions" card,
  deep-link works). Changing the sidebar to restore `/work` would alter nav semantics
  app-wide — out of scope for a walk-fix.
- **F-W2-b (P2):** mid-stream durability on a hard reload/tab-close is unverified
  (client soft-nav is safe; server completes + persists). If telemetry shows
  truncated sessions, add server-side run journaling (separate task).

**Verification:** `tsc --noEmit` clean; build green.

---

## PART 2 — Guarded live user-test — **NOT RUN (blocked by T-1 / environment)**

**Status: STOPPED before any real request, per the guardrails.**

The hard guardrail **T-1** requires the test to run **only** on the dedicated test
account `vinc.hafner4@gmail.com`, and: *"If you cannot confirm which account the
browser is logged into, STOP Part 2 and report."*

**What happened:** no controllable browser is available in this environment.
`browser-harness` could not attach — Chrome is not running with remote debugging
(`DevToolsActivePort not found` / "enable chrome://inspect/#remote-debugging"). The
only alternative (a remote clean browser) would start logged-out and require typing
`vinc.hafner4` credentials, which T-1 also forbids (no credentials, and the harness
rule is to never type credentials from the agent). Making real paid requests by any
other path (e.g. raw API calls) would bypass the account-confirmation guardrail
entirely.

**Therefore:** I did **not** confirm the account, did **not** act as a user, and made
**$0.00** of real spend. The $3.00 cap (T-2) is fully intact. No test projects were
created; nothing to clean up. This is the correct, safe outcome of the guardrails —
not a failure of the fixes.

**To run Part 2 later, the founder needs to:**
1. Open Chrome, enable `chrome://inspect/#remote-debugging` → "Allow remote
   debugging for this browser instance," and
2. Log that Chrome into **`vinc.hafner4@gmail.com`** (the clean test account) on
   `https://www.justgoblin.com`.
Then re-run this prompt's Part 2; the agent can confirm the account and proceed under
T-2…T-5. (Alternatively the founder runs the journeys manually on the test account
and reports findings.)

**Journeys still owed (the live-only coverage, for whoever runs it):** dashboard Swift
build end-to-end; the exact W2 repro (dashboard → new project → Forge build → window
reachable afterward — to confirm the W1/W2 fixes live); switch-away-mid-build recovery;
model picker (Swift/Forge) in every entry point + the new sidebar bar moving;
approach-allowance refusal (verify cheaply, don't burn the cap); project/chat
lifecycle; publish/deploy loop; settings tabs.

---

## Changes in this branch
- `apps/web/components/sidebar/SidebarUsage.tsx` — W1 sidebar allowance bar.
- `apps/web/components/project/project-workspace.tsx` — W2 tab persistence/restore.
- `docs/W2_DIAGNOSIS.md` — W2 root-cause write-up.
- `docs/WALK_FIXES_AND_USERTEST_REPORT.md` — this report.

Two-level truth + secret hygiene intact (the sidebar bar shows % only; no
tokens/cost/weight/provider). Design system respected (green/gold filled, mono
numbers, 390px legible). No migrations (none expected). **Nothing pushed** — awaiting
founder approval.

## Spend used: **$0.00** of the $3.00 cap (Part 2 did not run).
