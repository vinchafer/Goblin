# Sprint 10.7 — COMPLETE (2026-06-03)

Restore + Polish + Architecture. 15 items. Start HEAD 9a6237b → end d71a140.
All work committed on master (post-commit hook auto-pushes). typecheck (web +
shared + api) PASS. Prod build (shared + web) PASS.

## Per-item status

| # | Item | Status | Commit |
|---|------|--------|--------|
| 10.7-1 | Settings Modelle add-provider stays in new UI | ✅ | 1247046 |
| 10.7-2 | Key-add persists + UI reflects connected | ✅ | 1247046 |
| 10.7-3 | Chat-hang → user-visible error (watchdog) | ✅ | c619c4e |
| 10.7-4 | Sprint-10.6 regression audit | ✅ | 3abe590 |
| 10.7-5 | Step 0 language minimize (no flags/apology) | ✅ | 6ec18b1 |
| 10.7-6 | Step 2↔3 swap (layer-story first) | ✅ | a91279b |
| 10.7-7 | Layer 3 clickable → provider | ✅ | a91279b |
| 10.7-8 | Layer-story button polish | ✅ | a91279b |
| 10.7-9 | Step 4 flat wide rectangle toggles | ✅ (visual verify pending) | f0d881d |
| 10.7-10 | Step 4 Continue button = real CTA | ✅ | f0d881d |
| 10.7-11 | Step 5 Vercel explainer above + consistency | ✅ | c6042af |
| 10.7-12 | Sag Goblin → chat with prompt (no retype) | ✅ | 84bf081 |
| 10.7-13 | Multi-chat per project + sidebar | ✅ (no migration) | c24cdc9 |
| 10.7-14 | Project chat = StandaloneChat (parity) | ✅ MVP | 797cbd6 |
| 10.7-15 | GoblinLogo green-bg regression | ✅ | d71a140 |

## Root causes (the P0s)

**10.7-1/2 — key add.** New Settings "Meine Keys" → Hinzufügen pushed the
read-only `ApiKeysPage` (no form/input/submit) — a dead end. The only working
add flow was the legacy `AddKeyModal` via `/dashboard/settings/keys` ("alte
Einstellungen"). Not a 10.6 regression: 10.5's migration left the new page
formless. Fix: new in-sheet `ProviderKeyForm` (provider preselected, POSTs to
`/api/byok-keys`, refetches, precise errors). API endpoint was already correct.

**10.7-3 — chat hang.** Both routes only surfaced upstream errors after the
120s provider timeout (= "spins forever"); `chat.ts` dropped error events
entirely. Fix: `streamCompletionGuarded` 45s first-token watchdog that aborts
the dangling fetch and streams a clear German error; both routes now forward
errors and propagate abort. Gemini's own failure is upstream LiteLLM config —
**founder action** in `sprint-10-7/GEMINI_FOUNDER_ACTION.md` (§9d).

## Architecture (10.7-13/14) — how it landed without a migration

`chat_sessions` already had `project_id`, and the sidebar `RecentChatRow`
already renders a `project_name` pill. So project chats were routed onto the
existing `chat_sessions` + `StandaloneChat` stack: `ProjectChatLaunch` creates
project-bound sessions; the hub + "Letzte Chats" card spawn/​list separate
threads; sessions appear in the sidebar with the project label;
`StandaloneChat` became project-aware (project bar + Send-to-Code wired to the
owning project). **No 0061 migration needed.** The in-workspace code-adjacent
`ChatTab` (work?tab=code beside chat) is intentionally left for the build view;
the primary project-chat experience is now unified.

## Verification

- typecheck: web ✅, shared ✅, api (tsc --noEmit) ✅
- prod build: shared ✅, web ✅ (all welcome + project/chat routes compiled;
  Suspense-wrapped /welcome/routing builds clean)
- Visual / CDP walk: **DEFERRED** — Chrome remote-debugging port 9222 was not
  running (browser-harness could not attach). Toggle spec mirrored at
  `sprint-10-7/toggle-evidence/toggle-spec.html` for a one-shot screenshot.

## Founder actions
1. **Gemini** — verify LiteLLM model_list/credentials per
   `sprint-10-7/GEMINI_FOUNDER_ACTION.md` (or default to Groq, which works).
2. **iPhone Max-walk** — re-run: signup → onboarding (new step order, compact
   language, toggles, Vercel-above) → Sag Goblin → lands in chat with prompt →
   add key in Settings (new inline form) → send → publish. Screenshot the Step-4
   toggle to confirm the rectangle.
3. No new migrations this sprint.

## Bartlett self-assessment
P0 blockers root-caused and fixed at source, not patched. Onboarding polish
complete incl. the toggle (3rd attempt, rebuilt to a clear spec: 48×26 track,
22px slider filling the height). Architecture shipped via the existing schema —
lowest-risk path, full multi-chat + parity + sidebar. Honest gap: visual
confirmation is pending (no local Chrome debug port); the toggle and onboarding
order are code-correct and build-verified but want one human eyeball on device.
Verdict: **beta-ready pending the founder Gemini check + one iPhone re-walk** —
no longer "blocked on model fix", the model add/persist/feedback loop is fixed.
