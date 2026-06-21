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

## Spend used (initial state): Part 2 did not run on the first pass.

---

# ADDENDUM — Part 2 DID run (founder enabled the browser + named the account)

The founder enabled Chrome remote debugging and directed the test to the dedicated
test account **`vinc.hafner3@gmail.com`** (credentials in `.env.local`
`TEST_ACCOUNT_*`, founder-authorized — overriding the prompt's `vinc.hafner4`
default). T-1 satisfied: browser confirmed logged in as `vinc.hafner3` ("HALLO,
VINC.HAFNER3" / "Vincent 791"). Test run on **prod** (`www.justgoblin.com`) after
the fixes deployed. All real requests were tiny Swift/Forge calls.

## Live verification of the two fixes
- **W1 ✅ LIVE.** The sidebar now shows **"Kontingent · 0 %"** with the bar + the
  "Vollzugriff" badge on the comped founder account — exactly the fix (a comped
  account previously rendered text-only). Confirms the `isComped`-early-return was
  the cause and the new branch is live.
- **W2 ✅ LIVE.** Built a Café landing page, Send-to-Code → `/work?tab=code` (session
  opened with the index.html draft). Navigated away to `/dashboard` and back to a
  **bare `/work`** (no `?tab=`): it **restored the Code window** (editor + draft),
  where the old code forced `chat`. The hub's "Letzte Code-Sessions" card carries a
  working `?session=<id>` deep-link that reopens the exact session. Recovery proven.

## Findings register (severity-ranked, with evidence)

| # | Sev | Finding | Evidence | Status |
|---|-----|---------|----------|--------|
| F1 | **P1** | **Two-level-truth leak under chat messages** — footer rendered the raw internal id+tier `goblin/efficient · goblin_hosted` instead of "Goblin Swift". | DOM text captured verbatim under the Forge reply; source `Message.tsx:72-76`. | **FIXED + pushed `ae0b86d`** (new `chatModelLabel`, source_tier dropped). |
| F2 | **P1** | **Composer model selection not carried into the chat.** Picked **Goblin Forge** on the dashboard hero → the resulting chat ran `goblin/efficient` (Swift) and the composer reset to "Goblin Swift". The Forge intent is lost on the "Nur kurz im Chat"/seed path. | Selected Forge, sent; reply tier = efficient; composer = Swift. | LOGGED (fix needs threading the picked model through the seed → chat session; not a safe one-liner). |
| F3 | **P2** | **"Sag Goblin → Neues Projekt" drops the idea.** Creating a project from the composer with an idea lands on an **empty** chat ("Leg los.") — the seed did not auto-submit on the new-project→chat route (it does work on the chat-only route). | Created "Cafe Testseite" with an idea → empty chat. | LOGGED. |
| F4 | **P2** | **Model-picker search hides Goblin models.** Typing "Forge" in the picker search shows *"Add an API key in Settings → API Keys to unlock models"* — the search filters only BYOK models, so searching an included model name yields a misleading empty state. | Screenshot of search="Forge" → key empty state. | LOGGED. |
| F5 | **P3** | **"Reset in 0 Tagen".** Sidebar + usage show the allowance resetting in 0 days (daysUntilReset=0 from a stale `billing_cycle_start`); likely account-specific, reads oddly. | Sidebar "Reset in 0 Tagen". | LOGGED (verify against `billing_cycle_start` rollover). |
| F6 | P3 | Composer text appeared not to clear immediately after submit in the project chat (observed once; low confidence). | One screenshot; not reproduced. | LOGGED — needs confirm. |

## Journeys exercised (all on `vinc.hafner3`, prod)
1. **Dashboard Swift build** → streamed a full index.html → Send-to-Code → workspace draft. ✅ (idea-seed caveat = F3)
2. **W2 repro** (dashboard → new project → build → window reachable). ✅ window restored; recovery via hub deep-link works.
3. **Switch-away-mid / return** → Code window restored (not chat). ✅
4. **Model picker** — Swift + Forge both selectable, "INKLUSIVE · KEIN KEY" (no "SOON"). Forge streams. ✅ (caveats F2 routing, F4 search)
5. **Allowance refusal** — not forced (comped/Vollzugriff account, allowance not near cap; bar mechanism rendered at 0%). Not burned to force it (T-2). NOTE.
6. **BYOK** — not exercised (would need a real key / spend). NOT TESTED.
7. **Project/chat lifecycle** — create (desktop + mobile), switch, revisit, deep-link. ✅
8. **Publish/deploy** — Café page published to `https://cafe-testseite-vincent-2-s-projects.vercel.app`; `http_get` returns the real page (11.9 KB, no SSO wall). ✅
9. **Settings** — all tabs render (Profil/Abrechnung/Nutzung/Personalisierung/Funktionen/Konnektoren/Modelle/Erscheinungsbild/Eingabesprache/Benachrichtigungen/Datenschutz). ✅
10. **Mobile create (390px)** — the E2E-failing flow: FAB → modal → submit → landed on `/dashboard/project/<id>` in **2.1 s**, no "invalid project data". ✅

## CI note
My master merge `1dc13a4` showed E2E Tests **failed** (1 test: `19-mobile-create-project` `waitForURL` 15 s timeout, both attempts). Reproduced the exact flow live → passed in 2.1 s, and **re-ran the E2E job → SUCCESS**. Conclusion: a CI latency **flake** (cold API / runner load), not a regression and not a real bug. My changes don't touch project creation.

## Test artifacts left behind (for founder cleanup — not auto-deleted, T-5)
On `vinc.hafner3`: projects **"Cafe Testseite"** (has a live Vercel deploy) and
**"[E2E-LIVE] mob …"**; chats: the "Einfache Landingpage…" (Cafe) chat and a
"Schreibe einen kurzen Werbespruch…" chat. Not deleted to avoid orphaning the live
deployment / hitting destructive confirms. (Historic `[E2E-TEST] 9C-…` projects from
CI also accumulate.)

## Spend used: **≈ $0.01** of the $3.00 cap.
One full Swift index.html generation (~few k tokens) + one tiny Forge/efficient reply
+ a publish (no model tokens). Nowhere near the cap. No destructive actions; no
billing/account/secret changes (T-3/T-4 honored).
