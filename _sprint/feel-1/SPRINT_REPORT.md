# FEEL-1 + P0 Sprint Report

**Branch:** `feel-sprint-1-2026-07-02` (cut from `master` @ c4dfd4d). **Date:** 2026-07-02.
**Status:** all units complete or explicitly scoped out. Branch pushed. **HALTED — no merge, no prod deploy.**

Inputs: sprint prompt + `walk-evidence/`. Note: `FEELING_GRADING_2026-07.md` was **not found** on this machine (searched project tree, sibling dirs, Desktop/Downloads/Documents) — worked from the walk evidence directly.

---

## Migrations authored, NOT applied (founder applies via Supabase SQL Editor)

- `supabase/migrations/0075_chat_client_msg_id.sql` — adds `client_msg_id uuid` + partial unique index to `chat_messages` AND `standalone_messages` (P0.5 idempotency). **All P0.5 code is tolerant of the pre-migration DB** (verified live: sends succeed with the column absent), so applying it is safe at any time and unlocks true dedupe.

## Founder cleanup flag

- Verification created a throwaway Vercel site **`test-feel-p04.vercel.app`** under the **test account's own Vercel** (via P0.2 E2E). The Supabase project rows were deleted; the Vercel deployment is outside our teardown reach from here. Founder: delete it from the test account's Vercel dashboard.

---

## Phase 0 — Diagnosis (see DIAGNOSIS.md for detail + evidence)

| ID | Verdict | Consequence |
|----|---------|-------------|
| **D1** | **No server-side outage.** `/health/deep` uptime (150,576s @ 18:02Z 07-02) proves the API process ran uninterrupted through both 07-01 outage windows — no crash/restart/OOM. (Railway logs unreachable from this machine; inferred from uptime.) | **P0.1 gated OUT.** Client-resilience is the real workstream (→ P0.4/P0.5). Observability gap ticketed (#12). |
| **D2** | **No truncated/stale serve.** 3 cloud-runner deploy+poll cycles: 63 HTTP-200 polls all byte-identical from the first second after READY. The walk's truncated read was a client-side transfer artifact. Evidence: `evidence/d2-poll-log.txt`. | P0.2 calibrated to a short verification loop (no propagation wait). |
| **D3** | **Confirmed:** user message persists **before** the model call; a partial assistant reply persists on disconnect; both re-enter model context next turn. Reproduced live (truncated row cut mid-word). | Drove P0.5 idempotency design. |

---

## Units

| Unit | Commit(s) | What changed | Verification | Status |
|------|-----------|--------------|--------------|--------|
| **P0.1** | — | — | D1 gate: no server-side defect | **Out of scope** (per gate) |
| **P0.2** Deploy truth-gate | `b0dc7ce` | `deploy-verification.ts`: entry HTML must 200 + byte-match the deployed artifact, every referenced asset must 200, before "Veröffentlicht". Interim status `Wird veröffentlicht… (wird geprüft, n/6)`; honest German failure naming the asset after ~1 min. Both deploy paths. | 9 unit tests (incl. W10 case). **E2E live:** missing `styles.css` ⇒ `"Veröffentlichung hat ein Problem: styles.css nicht erreichbar"`, no Live; add asset ⇒ Live only after checks pass. Evidence: `reverify/P0.2_*`. | **Done** |
| **P0.3** Handoff integrity | `ebb36bc` | `stc-integrity.ts` (`@goblin/shared`): before transfer, every entry-HTML reference must be in the set; orphans flagged; unambiguous 1:1 auto-rename offered; confirm becomes `Trotzdem senden`. | 6 unit tests (incl. exact W10 `styles.css`/`settings.js` vs `script.js`/`script-1.js`). **E2E live** (desktop + mobile W10): dialog "Dateinamen passen nicht zusammen …" appears. Evidence: `reverify/P0.3_*`, `W10_04_*`. | **Done** |
| **P0.4** Idempotent create + honest errors | `cb991bc`, `5324c03` | Client-supplied UUID as project id; server dedupes on PK conflict → returns existing row (200), never a duplicate. Both create modals send the id. Connection errors render honest German (offline vs server-down via `navigator.onLine` + 3s health ping). | **E2E live:** double create same id ⇒ 1 row; offline ⇒ "Deine Internetverbindung ist unterbrochen…"; server-down ⇒ "Unser Server antwortet gerade nicht…"; retry after restore ⇒ exactly 1 project. Evidence: `reverify/P0.4_*`. | **Done** |
| **P0.5** Chat-send resilience | `c2f485d`, `9ff2455` | Optional `clientMessageId` (UUID) on both chat routes; duplicate replay never re-inserted, model never sees a send twice. Client: failed send stays in `wartet auf Verbindung — erneut senden` state, retry reuses the id (no double-submit). Pre-migration tolerant. | Server tolerance verified live (send with id, column absent ⇒ delta+done). Full offline queue deferred → **issue #13**. | **Done** (minimal, as scoped) |
| **P0.6** Tickets | — | GitHub issues filed, not fixed. | **#8** magic-link/dashboard, **#9** logout token, **#10** preview iframe/Vercel protection, **#11** reload "Noch keine Dateien", **#12** observability (bonus, from D1). | **Done** |
| **F1.1** System prompt + project context | `c2f485d`, `31f2274` | `goblin-chat-system.ts`: Goblin identity, capability map that routes users INTO the Send-to-Code→Sichern→Veröffentlichen pipeline, honest not-yet list (web/images/self-deploy), register + project-scope guidance, per-request project block (name, file list w/ sizes, last deploy URL/date). Wired through Anthropic/OpenAI/Goblin-hosted/LiteLLM paths for both chat routes. | **4 scripted probes** (`reverify/F1.1_probe*`): W10 compound ⇒ routes into pipeline, cites real URL, **no capability denial** (was: "kann keine Webanwendungen bauen"); "kannst du im Web suchen?" ⇒ honest No + redirect; architecture Q ⇒ localStorage-scale answer; "wer bist du + was liegt im Projekt?" ⇒ "Ich bin Goblin… Projekt 'Habit Tracker Walk'… index.html/script.js/script-1.js… letzte Veröffentlichung https://…". | **Done** |
| **F1.2** Honest indicator | `ee71d9e` | `WorkingIndicator` in `Message.tsx`: elapsed-time "Goblin arbeitet… 12s" from send-accept to first token; truthful, no fake steps. | **E2E live:** indicator visible in the previously-dead 0–12s window ("Goblin arbeitet… 3s"→"6s"). Evidence: `reverify/W1_08`, `W10_02`. | **Done** |
| **F1.3** File-cards | `ee71d9e` | Fenced file blocks → collapsed cards (filename, language, live line count, expand/copy); prose stays prose; Send-to-Code parser untouched. | **E2E live:** W1 genesis ⇒ intro + 3 collapsed cards (`index.html html·19 Zeilen`, `style.css`, `script.js`) + summary, no raw wall; expand works; STC picks the card files. Evidence: `reverify/W1_10`–`W1_13`. | **Done** |
| **F1.4** Remove phantom affordances | `48ea43e` | `Recherche`/`Websuche` composer items feature-flagged off (`NEXT_PUBLIC_ENABLE_WEBSEARCH`), code retained. | Code + build. | **Done** |
| **F1.5** i18n sweep | `64844fa` | Deploy/status/error paths German-only: `Creating deployment…`, `Preparing files…`, `Uploading N files…`, Vercel state enums, `Deploying to Vercel…`, `Deployed ✓`, `Error:`, and the Vercel error strings. | **E2E live:** full deploy status stream German-only (`reverify/P0.2_deploy_*_sse.txt`). | **Done** |

---

## Verification walk (branch, local web:3100 → local API:3001, isolated Chrome 9222, test account vinc.hafner3)

1. **W10 repeat (mobile 375px, exact original message)** — response routes into the pipeline (no "textbasiertes KI-Modell" denial), file-card rendered, honest indicator during generation, STC integrity warning caught `settings.html → styles.css`. Path to deployed unchanged in step count, but the chat no longer *denies* the build is possible. Evidence: `reverify/W10_01`–`W10_04`, `W10_response_tail.txt`.
2. **W1 genesis** — indicator present in the dead window; 3 file-cards. Evidence: `reverify/W1_08`–`W1_13`.
3. **Deploy with missing asset** — truth-gated, honest German error, no Live. Evidence: `reverify/P0.2_deploy_missing-asset_sse.txt`.
4. **Project create under simulated offline** — honest offline + server-down copy, no duplicate on retry. Evidence: `reverify/P0.4_*`.

### Honest residual (observed, not graded)
The chat model (Llama 3.3 70B, the test account's BYOK) still occasionally narrates self-agency it doesn't have ("Ich werde diesen Code nun übernehmen", "ich gebe dir Bescheid wenn erledigt") despite the F1.1 prompt rule against it. The *capability denial* is fixed and it routes into the real pipeline; the residual over-claim is a weaker-model instruction-following limit. Recommend re-checking on the Goblin-hosted default (DeepSeek/Kimi) and, if it persists, tightening in FEEL-2.

---

## HALT

All units committed as isolated, revert-ready commits (SHAs in the table). Branch `feel-sprint-1-2026-07-02` pushed to origin. No merge, no production deploy performed — awaiting founder authorization.

---

# Addendum (pre-merge gate, 2026-07-03)

| Unit | Commit | Evidence | Status |
|------|--------|----------|--------|
| **A1** Prompt rule: never claim platform actions | `c51e456` | `reverify/SYSTEM_PROMPT_CURRENT.md` (full post-A1 text) | **Done.** Dedicated "ABSOLUTE REGEL" block in `goblin-chat-system.ts`: forbids claimed/announced/promised platform actions in every tense, forbids standalone UI-imitating lines, prescribes the one-sentence handoff ("Übernimm den Code mit ‚An Code senden', dann ‚Sichern' und ‚Veröffentlichen'…"), plus 2 few-shot exchanges (correct closing vs. forbidden closing). Typecheck clean. |
| **A2** Swift re-probe | (evidence commit below) | `reverify/F1.1_swift_probe1-5.txt` (5 verbatim replies + observed-vs-expected) | **Done — unblocked 2026-07-03 by founder-provided key.** All 5 probes ran on **Goblin Swift** (`goblin/efficient`, `source_tier=goblin_hosted`) in a fresh chat of project "Habit Tracker Walk", local API with post-A1 prompt. UTF-8 verified pre-send (probe 1 starts `46 fc` = "Fü") and post-hoc in DB (5 stored messages, **0** with U+FFFD). **Action-claim check: the A1 failure class did not reproduce** — zero claimed/announced/promised actions, zero "ich gebe dir Bescheid", zero standalone UI-control lines; probe 5 answers "Ich kann keine Buttons drücken … das sind Aktionen, die du in der Goblin-UI ausführen musst" + exact 3-step path. Residuals (recorded, not graded): probe 2 self-describes as "textbasierte KI innerhalb der Goblin-Plattform" (forbidden framing, platform-qualified); probe 4 paraphrases file sizes and invents a short "was diskutiert wurde" recap. Setup notes: (1) founder's key landed as `DEEPINFRA_KEY_2` without `GOBLIN_HOSTED_API` — mapped to `DEEPINFRA_API_KEY` + flag inline at API start, `.env.local` untouched (verified gitignored, `.gitignore:9`); (2) probe run required `GOBLIN_DEV_MODE=false` because the dev-guard fails closed on `standalone_messages`/`chat_messages` inserts (rows carry no user_id column → every chat send 500s locally with the shield on — pre-existing, worth a DEV_SAFE_TABLES entry or ownership resolver, founder decides). |
| **A3** System prompt delivered | (in A2-evidence commit) | `reverify/SYSTEM_PROMPT_CURRENT.md` | **Done.** Full post-A1 prompt (static block verbatim + dynamic project-context template). Secrets check: file contains only prompt text — no keys/tokens/credentials. |
| **A4.1** SSE sequencing | `09ab990` | code | **Done.** Vercel `READY` now streams `Bereitstellung abgeschlossen — wird geprüft…` instead of `Fertig…`; the P0.2 truth-gate (`wird geprüft, n/6`) runs after READY, so nothing claims completion before checks. No test asserted the old string (grepped repo-wide). |
| **A4.2** UTF-8-safe title truncation | `3780c75` | code + 3 unit tests (green) | **Done, with a root-cause correction.** New `truncateTitle()` truncates at code-point boundaries (a naive `slice` can split a surrogate pair → lone surrogate → U+FFFD); wired into the auto-title path; tests cover umlaut-leading title + emoji at the cut boundary. **However:** the observed `F�ge` was reproduced from the prod DB — U+FFFD sits at code point 2 of the stored *user message itself* (`standalone_messages.content`), while the next probe message is clean. `slice(0, 60)` cannot corrupt position 2 (and 'ü' is a single UTF-16 code unit). The corruption entered **at send time from the scripted probe harness** (encoding artifact of the prior session's probe script), not from title truncation. This commit is honest defensive hardening; there is no reproducible product-side truncation bug. Recommendation: A2 probe scripts must send UTF-8 JSON bodies (verified umlauts) — noted for the probe run. |

**HALT.** No merge, no deploy. All addendum units complete; A2 verified on Goblin Swift with the post-A1 prompt.

---

# A5 — Prompt polish (final pre-merge unit, 2026-07-03)

| Item | Ref | Status |
|------|-----|--------|
| Prompt edits E1–E5 | `fcb3926` | **Done.** E1 click counts removed (buttons named, never counted); E2 embedded user-facing speech marked ("Formuliere es dem Nutzer gegenüber z. B. so: …"); E3 honest no-history rule appended to project-context block; E4 self-description ban tightened (no "textbasierte KI"/"KI-Modell"/"Sprachmodell" in any variant, limits stated without self-labeling); E5 file facts verbatim (exact sizes, no content claims for unseen files). Typecheck clean. |
| Verification probes A–D | `reverify/F1.1_swift_A5_probeA-D.txt` | **All five edits held on Goblin Swift** (fresh "Habit Tracker Walk" chat, `goblin/efficient`, `source_tier=goblin_hosted`, UTF-8 verified pre-send + DB post-hoc: 4 messages, 0 corrupted). A: no action claim, no count wording. B: honest "frühere Gespräche sind mir nicht zugänglich" + exact injected state, no invented recap. C: honest no, zero self-labels. D: sizes verbatim, explicit "kann nur Namen und Größe sehen". **Residuals (D, recorded not graded):** per-file one-line guesses clearly hedged as speculation ("Wahrscheinlich/vermutlich"), and an overclaim "ich kann jede Datei vollständig ausgeben" (contents are not in context) — adjacent to but not covered by E5; reviewer decides whether to address. |
| Tickets | [#14](https://github.com/vinchafer/Goblin/issues/14), [#15](https://github.com/vinchafer/Goblin/issues/15) | Filed: #14 dev-guard fails closed on chat persistence locally (rows lack user_id → every send 500s); #15 SSE socket stays open server-side after `done`. |

**Reminder for the founder:** revoke the scoped DeepInfra key now that this run is complete (`DEEPINFRA_API_KEY` in `.env.local`).

**HALT.** No merge, no deploy. Branch ready for merge review.

---

# E6 — never offer to show unseen file contents (2026-07-03)

| Item | Ref | Status |
|------|-----|--------|
| Prompt edit E6 | `0bab6c1` | **Done.** Project-context block extended: never offer to output/show contents of a file whose code was not visible in the conversation (would be confabulated — the A5 probe-D residual); point the user to the Code-Bereich instead; frame own changes as new code. Typecheck clean. |
| Swift spot-probe | `reverify/F1.1_swift_E6_probe.txt` | **BLOCKED — DeepInfra key already revoked/removed** (`DEEPINFRA_API_KEY` gone from `.env.local` per the A5 revoke reminder, before this run). Hosted config → null → the send fell to the BYOK path (`source_tier=byok`) and died on an upstream 404. Probe message + harness ready; needs a (new) scoped key to run. |
| Side-finding | (same evidence file) | With `GOBLIN_HOSTED_API=true` but no `DEEPINFRA_API_KEY`, a `goblin/efficient` request is not rejected cleanly — it falls through to BYOK routing with the stripped model name `efficient` and surfaces a raw upstream 404 to the user instead of an honest German unavailability message. Worth a ticket/fix alongside the catalog's fail-closed behavior. |

**HALT.** No merge, no deploy. E6 edit is on the branch; spot-probe awaits founder decision (re-provide key, or accept the edit on the strength of the A5 probe pattern).
