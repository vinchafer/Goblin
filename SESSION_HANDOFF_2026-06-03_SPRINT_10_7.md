# Session Handoff — 2026-06-03 (Sprint 10.7 close)

## State
Sprint 10.7 (Restore + Polish + Architecture, 15 items) **COMPLETE**. 12 atomic
commits on master, 1247046 → d71a140 (auto-pushed). typecheck (web+shared+api) +
web prod build green. Sprint 10/10.5/10.6 intact (additive + targeted fixes).

Full report: **SPRINT_10_7_COMPLETE_2026-06-03.md**. Evidence/docs in `sprint-10-7/`.

## What changed

### P0 blockers (the model regression)
- **Key add fixed at root**: new Settings "Meine Keys" → Hinzufügen pushed a
  read-only page (no form) — the only working form was the legacy modal ("alte
  Einstellungen"). New `ProviderKeyForm` adds keys inline in the new UI, posts to
  `/api/byok-keys`, refetches, shows precise errors. Desktop + mobile (shared
  `ModelsPage`).
- **Chat no longer hangs**: `streamCompletionGuarded` 45s first-token watchdog
  → clear German error instead of a 120s silent spinner; `chat.ts` now forwards
  error events; abort propagated. Gemini's upstream failure → founder doc.

### Onboarding
- Step 0 language: compact, no flags, no apology copy.
- Step order swapped: Language → AI-talk → **How Goblin works** → **Provider** →
  Tools → Integrations. `?path=a|b` threaded through routing→provider.
- Layer 3 card links to the provider step.
- Step 4 toggles: flat WIDE rectangle (48×26 track, 22px slider filling height).
  3rd attempt — definitive.
- Step 4 Continue: gold raised CTA, not a flat label.
- Step 5: Vercel ownership note moved ABOVE the add-token card; mobile-hint EN.

### Architecture
- **Sag Goblin → chat**: create-new-project now lands in chat with the prompt
  sent (no hub detour, no retype).
- **Multi-chat per project + sidebar** (no migration): project chat routed onto
  `chat_sessions`/`StandaloneChat`. `ProjectChatLaunch` spawns separate threads;
  hub lists them; sidebar shows them with project label; `StandaloneChat` is
  project-aware (project bar + Send-to-Code to the project).
- **Logo**: green-bg circle removed from the project-chat avatar (mark only).

## Founder actions
1. **Gemini (upstream)** — verify Railway LiteLLM model_list/credentials per
   `sprint-10-7/GEMINI_FOUNDER_ACTION.md`, or set Groq as the default (works).
2. **iPhone Max-walk** — re-run end to end; screenshot the Step-4 toggle.
3. No new migrations this sprint.

## Known gap
Visual/CDP verification deferred: Chrome remote-debugging port 9222 was not
running, so browser-harness could not attach. All changes are code-correct,
typecheck-clean and prod-build-verified; they want one human eyeball on device.
To enable next time: launch Chrome with
`--remote-debugging-port=9222 --user-data-dir=<repo>/.chrome-debug-profile`
before the run.
