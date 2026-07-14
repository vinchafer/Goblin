# FIX-WAVE 4 — AGENT & MODELL · Report

**Branch:** `claude/fix-wave-4-agent-model-w7x57g` (base = origin/master `874c986`, the FW3 merge; F-40 registry at `660d8b5`)
**Date:** 2026-07-15 · Cloud session (secretless) · Model: Opus
**Scope fixed:** the intelligence layer — routing, interruption, reliability, edit precision, instruction-following, support latency. Six units, one per finding.
**Status at end:** all deterministic gates green; every real-model **prod** gate is founder-side (no secrets in this environment). **HALT** for the founder re-walk before any merge.

Success rates are numeric. "Grün ist, was gesehen wurde." Deterministic verification is labelled as such.

Phase 0 (state-first, Law 10): FW3 merged at `874c986` ✅ · F-40 registry at `660d8b5` ✅ · branch based on the FW3 merge ✅ · FW1 U4 thread confirmed (base project-chat is tool-less; mode-scoped decline present) ✅.

---

## Per-unit — diagnosis, fix, gate

### U1 · F-11 · Publish-intent routing (P0, DIAGNOSIS-FIRST — the W10 question) · `bb2a31b`
**Diagnosis (traced, code evidence):** three lanes exist — tool-less `POST /api/chat/stream` + `POST /api/chat-sessions/:id/stream` (project chat), tool-less `POST /api/code-sessions/:id/messages` (classic), and the real agent `POST /api/code-sessions/:id/agent`. The **routing decision lives only in the Code tab** (`SessionPane.handleSubmit`) and keys **purely on `session.model_id`** (`isAgentModel`) — there is no intent gate, no toggle. The project **Chat surface** (`StandaloneChat.handleSubmit`) **unconditionally** posts to the tool-less stream — it has **no path to the agent at all**. So "…und stell ihn live" typed in a project chat produced a tool-less completion (manual instructions), never an agent publish → W10 ≠ 0. (The publish *grant* `classifyPublishIntent`/`grantsPublish` already existed but only governs whether an *already-running* agent deploys — one level below the routing question.)
**Fix (founder D1 "explicit intent executes directly"):** `classifyRunIntent` (deterministic: explicit publish intent OR a clear build request `verb + buildable object`; conservative — a bare "live" mention stays chat). Web mirror `lib/run-intent.ts`. `StandaloneChat` now, for a project chat on a Swift/Forge model whose message routes, shows the honest first step ("Ich starte dafür einen Agent-Lauf …", no silent switch), seeds the prompt, and hands off to the Code work surface; `CodeWorkspace` consumes the seed → fresh titled session on the eligible model; `SessionPane` auto-runs it once through its existing agent-routing `handleSubmit`, so tools engage and `grantsPublish` honours "…stell ihn live". Also tightened the shared intent classifier — `publish`/`deploy` word-boundaried (kills the "Deployment"/"publisher" false-positive), adverb window catches "stell die Seite JETZT live" — which strictly improves `grantsPublish` too.
**Gate (a) (CC, deterministic):** intent-gate unit tests incl. the **verbatim walk prompt** ("Baue mir einen kleinen Habit-Tracker … Und stell ihn live.") → agent; a chatty "live" mention → chat; pure-build and pure-publish both route; casing/Umlaut robust. **API 11/11 · web mirror 3/3.** Full agent suite 118/118; api+web tsc clean.
**Ledger:** M10 FW4-U1 NOTE (chat→agent volume shift, guardrail-bounded, no new token mechanism).
**Founder (gate b):** real-model prod run on the test account with the verbatim prompt → agent engages, builds, publishes, W10 measured as a number.

### U2 · F-23 · Stop → coherent partial card, never a code dump (P0) · `7852136`
**Diagnosis:** on `outcome='stopped'` the report prose (`modelText`) was the last turn's content — if the model dumped a file body into its prose, that `<!DOCTYPE …>` became the report + the persisted thread message (the founder's "raw partial HTML pasted into chat"). The guard path already carried honest copy; the **user-stop path did not**.
**Fix:** both stop paths (user Stop + F-40 max-runtime guard) now land an honest, code-free summary assembled from run ground truth (step log + attested file map — what finished, where the drafts are, what's missing) via `assembleStopSummary`. Raw partial stays in the draft files + event/step log. The guard keeps its **distinct** `failureReason` (Zeitlimit) for the push/telemetry; a plain user Stop keeps `failureReason` undefined (the F-40 signal is unchanged).
**Gate (CC, deterministic):** orchestrator tests — user-stop after a raw-HTML narration → `modelText` has no `<!DOCTYPE`/```` ``` ````, names the completed step, draft attested, one closing report frame; guard-timeout renders its Zeitlimit summary (regression); plain-stop `failureReason` stays undefined. **18/18 orchestrator; 121/121 agent suite.**
**Founder:** a stop mid-run on prod → card, not dump.

### U3 · F-22 · Forge reliability — Forge-appropriate first-token budget (P0) · `f7c9f1f`
**Diagnosis (traced):** the "Das Modell hat nicht rechtzeitig geantwortet" is `streamCompletionGuarded`'s **first-token** watchdog — correctly first-byte (the deadline drops the instant any content flows, so long replies are never truncated) — but the budget was a **flat 45s for every model**. Forge (Kimi K2.6 on DeepInfra, 4.4× weight, slower) is genuinely slower to first token on large prompts, so 45s cut it off. The agent path (`nativeGoblinModel.turn`) is non-streaming and bounded only by the 10-min guard — NOT the early-cutoff culprit.
**Fix:** the first-token deadline is now tier-aware. The `meta` frame carries the resolved model; on Forge the deadline widens to `forgeFirstTokenTimeoutMs` (default 90s, env `FORGE_FIRST_TOKEN_TIMEOUT_MS`). Widen-only — a larger caller base still wins, every other model keeps 45s, and the deadline still drops on first content (a Forge-appropriate budget, not a total-duration cap).
**Gate (CC, deterministic — timeout mechanism):** the pure deadline rule (Forge 90s / others 45s / base-floor / env override) + fake-timer guard timing (Forge streams through a 60s first token that trips Swift). **5/5; goblin-hosted guard suite 55/55 (regression).**
**Founder:** the measured **5-run Forge table** (verbatim recipe-site prompt → N/5 with durations, ≥4/5); and the optional in-progress heartbeat narration (a chat-stream + client-render change) — deferred (needs a browser to verify).

### U4 · F-19 · Targeted edits (P1, ledger-relevant) · `5d3195c`
**Diagnosis:** the agent had only `write_file`, whose contract is "give the COMPLETE new file content" — every small change re-emitted the whole file (output-token burn + risk of dropping unrelated content).
**Fix (reuse, don't invent a diff format the reconcile path can't verify):** new `edit_file` does an anchored replace (model supplies only literal `old_str` + `new_str`). It produces the full new content by an index-based (no `$`-pattern) splice, then flows through the **same `finalizeDraftWrite` pipeline** as `write_file` (F-17 css/js reconcile → U2 classify → draft upsert → integrity) — so **attested == written == shipped** is preserved byte-for-byte (FW1 U2 chain intact). Honest fallback: a missing/ambiguous anchor returns `anchor_not_found`/`anchor_ambiguous` pointing to a unique snippet or `write_file` — never a silent wrong edit. Prompt + tool docs instruct `edit_file` for small changes.
**Gate (CC, deterministic):** tools tests — anchor replace leaves the rest byte-identical + real GEÄNDERT; missing anchor → error + no write; ambiguous → refused + no write; replace_all; not-found → write_file hint; `$`-pattern literal safety. **17/17 tools; 171/171 agent+prompt (write_file reconcile/attestation regression green).**
**Ledger:** M10 FW4-U4 NOTE (output-token reduction on the edit path, no new mechanism).
**Founder:** real-model probe — "ändere NUR den Titel" on a ~10KB file → emitted bytes ≪ file size, unrelated sections byte-identical, 4/5.

### U5 · F-20 · Project instructions actually applied (P1, deterministic) · `c352392`
**Diagnosis (both halves):** (a) injection was **fragile** — instructions rendered inside `renderProjectContext`, which returns `''` early when `projectName` is absent, so a nameless project **silently dropped** them; and (b) even when present they sat **buried** mid-context (after the file list, before rolling memory) with soft framing — so the model often ignored them.
**Fix:** (a) a dedicated `renderProjectInstructions` gated **only** on the instruction string, never on `projectName`; (b) placed **LAST** in the assembled prompt (nearest the user's task) on **both** the chat and agent paths, with strengthened binding framing ("VERBINDLICH … haben Vorrang … gelten für JEDE Antwort … strikt daran").
**Gate (CC, deterministic — injection proof, both paths):** instructions + VERBINDLICH framing present in `buildGoblinChatSystemPrompt` AND `buildAgentSystemPrompt`; injected even with `projectName:null` (the bug); placed after the rolling-memory/project context; empty → no placebo header. **Prompt suite 45/45 (prefix-stability + agent-system regression green).**
**Founder:** real-model 4/5 compliance probe (instructions set → generated code carries the instructed properties).

### U6 · F-27 + F-37 · Help agent: shorter, faster, only true claims (P1) · `9b10151`
**Diagnosis:** (a) the persona capped "3–4 Sätze" but the few-shots never SHOWED a tight answer → nine-paragraph manuals. (b) the agent **buffered** the whole reply and emitted it in one blob (user stared at nothing) — buffering existed to strip the trailing `[[ESCALATE]]` marker cleanly. (F-37) the corpus claims a post-deploy truth check before "Live ✓".
**Fix:** (a) hardened to a 3–6 line + one-citation cap; few-shot ① is now a concrete tight answer + a contrast counter-example flagging the textwall. (b) the reply now **streams** delta frames, holding back a 48-char tail so a forming marker never flashes; the authoritative final `message` (marker-stripped, honest escalation status appended) still lands and the client replaces the streamed text with it — so the committed reply is **byte-identical** to the buffered path (F-29 honesty guarantee fully preserved, only faster; the client already rendered deltas → no client change). (F-37) **verdict = VERIFY, not rewrite:** `deploy-verification.ts` DOES run all three checks before "Live ✓" — entry HTTP 200 (`:76-80`), served HTML matches the artifact (`:82-85`), every linked local asset 200 (`:88-98`), + honest per-failure cause + 6-attempt/~1min window — so `help-content.ts:141-142` is accurate; kept and pinned by a drift-guard test.
**Gate (CC, deterministic):** support-agent tests — length cap present in the assembled system prompt; a normal reply streams as deltas with the final message matching; a trailing marker never appears in a delta; all existing escalation/honesty/billing invariants green. **16/16 support; 2/2 F-37 pin.**
**Founder:** real-model probe — "Wie stelle ich meine Seite live?" → ≤6 lines + citation renders (GAP-5); streaming confirmed (first-token latency noted).

---

## Self-review checklist (methodology §Selbst-Review) — executed
1. **Evidenz-Audit:** every gate re-run and read (verbatim pass lines below). Deploy-verification claim checked against `deploy-verification.ts` line-by-line (F-37). ✅
2. **Diffstat vs Scope:** 6 commits, 20 files (10 code + 8 test + `support-agent-system.md` + ledger). Every file maps to a unit; no drive-by changes. The one shared-code touch (intent regex precision in U1) is in-unit and strictly improves `grantsPublish`. ✅
3. **Regression:** full **API suite 786 passed / 16 skipped / 0 failed**; web unit **52/52**; web + api **tsc clean**; web **production build green** (all 41 pages, with placeholder env). Untouched paths hold. ✅
4. **Ehrlichkeits-Sweep (new user strings):** U1 hand-off line + U2 stop summary + U6 length/streaming are honest (no fabricated action/time, no self-label, no future promise); U2 keeps the F-40 timeout signal; U6 keeps the F-29 confirmation guarantee byte-identical. ✅
5. **Ledger:** U1 (M10 volume NOTE) + U4 (M10 output-reduction NOTE) written **same-commit**. U2/U3/U5/U6 = no new consumption mechanism (noted per unit). ✅
6. **Report completeness:** unit SHAs above; per-unit gates + numeric rates; Honest-Limitations (below, mandatory); founder-action list. ✅
7. **Die Steven-Frage:** a skeptic with only this evidence reaches the deterministic verdicts (tests/tsc/build). Every real-model **prod** verdict is explicitly deferred to the founder re-walk — no over-claim. ✅

## Unit SHAs
- U1 `bb2a31b` · U2 `7852136` · U3 `f7c9f1f` · U4 `5d3195c` · U5 `c352392` · U6 `9b10151`

## Honest-Limitations (mandatory)
- **Real-model prod gates not run here.** Secretless cloud session (no prod/test-account keys). Every "real model, verbatim, prod" gate — U1 W10 count, U3 5-run Forge table, U4 targeted-edit byte measurement, U5 instruction-compliance probe, U6 ≤6-line + citation probe — is **founder-side**. Deterministic tests stand in for the mechanism, not the live behaviour. Not merged (Law 3).
- **U1 is the wave's largest surface and its felt flow is browser-unverified here.** The routing classifier is fully tested (gate a). The cross-surface hand-off (StandaloneChat → seed → CodeWorkspace → SessionPane auto-run) is verified only by tsc + the full production build + static trace against the existing seed/deep-link + agent-routing paths it reuses — not by a real browser walk. The felt W10 walk is the founder gate. Guardrails make a misfire safe: routing fires only on (project chat) AND (Swift/Forge selected) AND (explicit build/publish intent); anything else stays chat, so a normal conversation is never hijacked.
- **U3 heartbeat narration deferred.** The Forge-budget mechanism (the actual fix) is tested. The optional in-progress narration ("Forge arbeitet an einem größeren Wurf …") is a chat-stream + client-render change; deferred as a small follow-up since it can't be browser-verified headlessly. The 5-run measurement is founder-side regardless.
- **U6 streaming honesty.** The committed reply is byte-identical to the old buffered path (final `message` replacement), so the F-29 confirmation guarantee is preserved. The marker holdback (48 chars) is unit-tested; the perceived first-token latency win is real-model/founder-observed.
- **F-37 = verified accurate, not rewritten.** The corpus already claimed exactly what the code checks; the deliverable is the file:line verdict + a drift-guard test, not a copy change.

## Orthogonal CI fix (NOT part of FIX-WAVE 4 — own commit, independently revertable)
During the merge run, the PR's CI went red on **`src/services/insight.test.ts`** — 2 `computeFunnel`
cohort-size assertions off by one (`4→3`, `5→4`). Root cause: the test anchored its fixtures to a
**frozen** `NOW = 2026-07-10T12:00Z`, but `computeFunnel` has no injectable clock and computes its
7-day cohort window against the real `Date.now()`; as wall-clock passed ~2026-07-14 midday, the oldest
fixture (`NOW − 3 days`) drifted out of the window. This file is **byte-identical to master and untouched
by FW4** — a pre-existing latent time-boundary flake, not a wave regression (the FW4 commit passed the
full API suite 786/786 locally; E2E, Performance, and the CI Typecheck+Build job were all green). Fixed
**test-only** (anchor fixtures to `Date.now()` so every fixture stays inside the live window regardless of
time-of-day) as a **separate, clearly-labelled commit** so it can be reverted independently of the six
FW4 units. Verified green at 20:11 UTC — a time-of-day that previously failed.

## Founder actions
1. **Re-walk gates (real model, prod, test account `vinc.hafner3@`):** F-11 (verbatim habit-tracker prompt → count interactions to a live URL — the felt W10), F-23 (stop mid-run → card not dump), F-22 (5 Forge runs of the recipe-site prompt → N/5 + durations, ≥4/5), F-19 ("ändere NUR den Titel" on a ~10KB file → emitted bytes ≪ file size, 4/5), F-20 (instructions set → generated code carries them, 4/5), F-27 ("Wie stelle ich meine Seite live?" → ≤6 lines + citation, streaming visible).
2. **Migrations:** none authored this wave.
3. **Env (optional):** `FORGE_FIRST_TOKEN_TIMEOUT_MS` (default 90000) is the Forge first-token knob; tune from the 5-run measurement if needed.
4. **Merge:** after the re-walk gates pass, merge the branch (the founder authorizes every merge).

**HALT** — branch pushed, all deterministic gates green, real-model prod gates handed to the founder.
