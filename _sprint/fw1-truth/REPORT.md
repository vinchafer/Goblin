# FIX-WAVE 1 — TRUTH (die HALT-Lifter) · Report

**Branch:** `claude/fix-wave-1-truth-1j3211` (base = origin/master `0ef0b0a`, no rebase needed)
**Date:** 2026-07-13 · Cloud session (secretless) · Model: Opus
**Species fixed:** the product asserting states it has not verified. Six findings, one family.
**Status at end:** all deterministic gates green; every real-model **prod** gate is founder-side (no secrets in this environment). **HALT** for the founder re-walk before any merge.

Success rates are numeric. "Green is what was seen." Deterministic verification is labelled as such.

---

## Per-unit — diagnosis, fix, gate

### U1 · F-29 · Escalation mail never arrives (P0, diagnosis-first)
**Diagnosis (traced):** `sendEmail`/`sendSupportEscalation` already return `{ok}` correctly. The false-green was in the **caller**: `streamSupportAgent` computed `emailOk`/`emailErr` inside `escalate()` but **discarded** it and emitted `ESCALATION_CLOSING` ("du hörst per E-Mail von uns") unconditionally on both escalation paths — the F-17 species on the worst path. The system prompt (rule 4 + few-shot ④) also told the model to *write the confirmation itself*.
**Env/domain finding (explicit, as requested):**
- Recipient `to = SUPPORT_EMAIL_TO ?? FOUNDER_DIGEST_EMAIL ?? ADMIN_EMAIL` — resolves via the `ADMIN_EMAIL` the founder set. ✅
- Sender `from = SUPPORT_EMAIL_FROM ?? RESEND_FROM ?? 'Goblin Support <support@send.justgoblin.com>'`. The founder set neither `SUPPORT_EMAIL_FROM` nor `RESEND_FROM`, so the default `send.justgoblin.com` is used — **while the digest/`lib/email.ts` default is `noreply@justgoblin.com`** (a *different* domain). **If `send.justgoblin.com` is not a Resend-verified domain, Resend returns a non-2xx and the send fails.** This is the most likely reason no mail arrived. → **Founder action** (see below). The fix makes this failure *visible and honest* instead of a silent false-success.
**Fix:** `escalate()` returns `{ok,error}`; both call-sites gate the closing on the **confirmed 2xx** — success → the "du hörst per E-Mail" line; non-2xx → honest `ESCALATION_FAILED` ("Ich konnte die Übergabe gerade nicht abschließen …"). Failures are `logger.error`-logged with `{ticketId,userId,reason,error}` so the founder sees the Resend error. System prompt updated so the model no longer narrates the confirmation; a leaked confirmation phrase is stripped (belt-and-suspenders).
**Gate (CC, deterministic):** `support-agent.test.ts` — success-on-2xx and honest-failure-on-non-2xx for **both** the explicit-human and model-triggered paths. **13/13 green.** Verbatim log shows the honest-degradation `logger.error` firing on the mocked non-2xx.
**Founder re-walk:** real escalation on prod (test account) → received-mail screenshot. If none arrives, the honest failure string appears and the log names the domain error.

### U2 · F-17 · Edit false-green (P0, trace don't guess)
**Diagnosis (traced tool-call → draft → save → deploy):** two edit pipelines. The **agent path** (`services/agent/tools.ts:toolWriteFile`) trusted the model's guessed `args.path` verbatim — only a traversal/safety canonicalization, **no reconciliation** to the file the deployed entry links. The classic `/messages` path already reconciles (WALKFIX-1 + `reconcileBlockPaths`), but that cure was **never ported to the agent path**. So a guessed `styles.css` (the parse-code-blocks default) got written, **attested** (the report card is ground-truth of the *written draft*, not narration) and deployed as a self-consistent set — while the entry links `style.css`, so the served page never changed and the deploy truth-gate (which only verifies the *entry*) stayed green.
**Fix:** port `reconcileBlockPaths` (`lib/asset-reconcile.ts`) into `toolWriteFile`, **before** classify/upsert, so the retargeted (linked) path is what is read, classified, written, **attested**, and later shipped/served → attested == written == linked == served. Same conservative rule as the classic path (only when the entry links exactly one asset of that type and the guessed path diverges; ambiguous/multi-asset untouched).
**Gate (CC, deterministic):** `tools.test.ts` — a guessed `styles.css` retargets to the linked `style.css` (attested path == written path, real GEÄNDERT, no orphan sibling); already-linked and multi-asset (ambiguous) cases left as-is. **11/11 green** (log shows the retarget).
**Founder re-walk:** prod agent edit "ändere den Titel auf X" → `curl` the deployed URL, grep the string; attach before/after served HTML. (See Honest-Limitations for the boundary this fix does *not* cover.)

### U3 · F-28 · Help agent invents a roadmap (P0)
**Diagnosis:** the agent manufactured a GitLab roadmap/timeline ("in den nächsten Updates") — a future promise the product can't keep (mis-selling). The existing rules forbade inventing *features/prices* but not *roadmaps/timelines*.
**Fix (proven pattern: ABSOLUTE block + few-shot on the exact failure):** new `NO_ROADMAP_BLOCK` (R1) wired into **both** `buildGoblinChatSystemPrompt` and the agent `AGENT_STATIC_PREFIX`, pinning the canonical line — *"Das gibt es heute nicht. Ob und wann es kommt, kann ich dir nicht sagen."* — with the GitLab few-shot. Same prohibition added to the support agent (Goblin Hilfe) rules + its GitLab few-shot hardened.
**Gate (CC, deterministic):** `goblin-agent-system.test.ts` asserts the R1 block + canonical line + GitLab few-shot on **both** agent and chat prompts; prefix-stability preserved. **Prompt suite 44/44 green.**
**Founder re-walk (real model, verbatim):** GitLab + Supabase-Konnektor + eigene-Domain paraphrases → 3/3 honest "gibt es heute nicht, Zeitpunkt unbekannt"; shipped-feature regression → answered normally.

### U4 · F-21 · Web search must actually work (P0, diagnosis-first — D-C = BUILD it)
**Diagnosis:** the built capability **is fully wired in the agent path** (`code-sessions.ts` resolves the provider, sets `searchAvailable` → `WEB_SEARCH_BLOCK`, registers `web_search`, wires the executor with the per-run cap 3 + daily cap 25). The walk hit the **separate tool-less project-chat route** (`/api/chat/stream`), whose base prompt carried a stale FEEL-1 **blanket denial** ("Ich kann nicht im Web suchen"). Base chat and agent runs use different identity blocks, so the denial never leaked into agent runs — it was purely a base-chat honesty bug. Brave key + caps are correctly in place; **no env/flag blocker.**
**Fix:** base-chat capability map made honest and mode-scoped — declines *by mode* ("In diesem Chat-Modus suche ich nicht live — in einem Agent-Run geht das") and is explicitly told **not** to issue the blanket denial; the identity example limit swapped to a genuine one ("Ich kann keine Bilder ansehen"). Agent prompt unchanged (already advertises search + citation).
**Gate (CC, deterministic):** prompt tests — base chat declines by mode + points to agent runs, old blanket line gone; agent prompt (searchAvailable) advertises `web_search` + `Quelle: <url>`. Caps unchanged (per-run 3, daily 25). **Green.**
**Founder re-walk (real model, prod):** agent run "Suche die aktuelle stabile Tailwind-Version und nenn die Quelle" → visible `web_search` step + cited version + `Quelle:`; non-agent chat → honest mode decline (not a blanket denial).
**Scope note:** full project-chat search (routing chat through the agent, or a chat-stream tool loop) is a larger architectural change; left as a founder-decision follow-up. The gate accepts non-agent chat declining honestly, which this delivers.

### U5 · F-24 · Attachment honesty (P1)
**Diagnosis (which of the two):** attachment handling is **client-side** (`apps/web/lib/chat-attachments.ts`). `classifyKind` sent every unknown type to `'image'`, so the model got a *vision-limit* note and paraphrased it into the false "dazu fehlt mir die Funktion". Separately, failed text/PDF reads were **silently dropped** by the compose filter. So: **(a) mis-handling of unknown types**, not injection failure. `.txt` was already supported (regression-safe).
**Fix:** new `'unsupported'` kind → honest, type-specific note ("Diese Datei konnte nicht gelesen werden (Typ .zip wird derzeit nicht unterstützt).") instead of a fake image limit; `composeMessageWithAttachments` now includes every **resolved** attachment (ready + errored) and injects a truthful note rather than dropping it; `ChatInput` send/enable guards treat errored/unsupported as sendable so the honest note reaches the model. PDF + `.txt` read paths untouched.
**Gate (CC, deterministic):** `chat-attachments.test.ts` — `.txt` reads as content; unsupported yields the honest type-specific string (not image/"Funktion"); failed reads still speak; PDF/text regression held. **8/8 green** (web suite 10/10).
**Founder re-walk:** attach a `.txt` (reads) + an unsupported binary (honest type message) + a supported PDF (reads).

### U6 · F-18 · Dead "Änderungen ansehen" button (P1)
**Diagnosis:** the button rendered and fired `onViewChanges`, but both `AgentRunView` call sites routed it to `handleViewFile` (setActivePath + a mobile-only flag) — it opened no diff (phantom affordance). The diff mechanics exist (`DiffSheet`, opened via `openDiff` from the file cards).
**Fix (wiring, <1 commit):** point both call sites at the existing `openDiff` — the same opener the file cards use, driving the real base→draft `DiffSheet`. `openDiff` also flips `mobileView` to "editor" so the sheet (which lives in the work-surface column) is visible on mobile from the thread-column report card; no-op on desktop and the already-in-editor path.
**Gate:** static trace against the proven `openDiff` path + `tsc` clean + production build green. Pixel render (375px/desktop, dark+light) requires an authenticated live agent session with a report card — **founder re-walk** (see Honest-Limitations).

### U7 · F-36 · "Preview" phantom on the public landing (P1)
**Diagnosis vs. repo reality (Law 10):** the prompt's premise "the public site **header** shows Preview" **did not match the repo**: the marketing header (landing `Nav`) has **no** Preview affordance, and the app-shell Preview *tab* is honestly **gated** (`disabled` + hint "Deploye das Projekt, um eine Preview zu sehen") — the Law-6 honest pattern, and auth-gated so a stranger never sees it. The one marketing-surface overstatement was `IslandFlow` step 08 body "**Tap** to see your live site" — an implied one-tap affordance on a non-interactive card.
**Fix:** softened to "See your live site the moment it ships" (matches the real deploy-then-view flow already shown by steps 05/06). Real feature + honestly-gated tab left untouched.
**Gate (rendered, local dev build — evidence/fw1/):** served landing HTML shows the fixed copy and no "Tap to see"; the only remaining "Preview" is the `<h4>` feature-name title. Rendered header **desktop + 375px** — no Preview affordance in either. Screenshots attached.

---

## Self-review checklist (methodology doc §Selbst-Review) — executed
1. **Evidenz-Audit:** every artifact opened — screenshots viewed; test suites re-run and read (verbatim pass lines); the honest-failure `logger.error` observed firing. ✅
2. **Diffstat vs Scope:** 7 commits, 17 files (13 code/test + 4 evidence PNGs). Every file maps to a unit; no drive-by changes. ✅
3. **Regression:** full API suite **699 passed / 16 skipped / 0 failed**; web unit suite **10/10**; web production build **OK**; web + api `tsc` clean. Untouched paths hold. ✅
4. **Ehrlichkeits-Sweep (new user strings):** U1 `ESCALATION_FAILED` and U5 unsupported message are **bilingual** (de+en); no fabricated response-times (the only "24 h" is the *prohibition* rule); no English leaks in German paths; no self-labels (U4 removed the web-search self-limit example); no future promises (U3 forbids them). ✅
5. **Ledger:** **no token/consumption path changed.** U2 adds only bounded DB reads during a write; U4 is prompt-honesty only (search execution — Brave, caps 3/run + 25/day — was built and ledgered at FEEL-4 and is untouched). No new M-line. ✅
6. **Report completeness:** unit SHAs below; evidence refs; Honest-Limitations (mandatory) present; founder-action list; numeric rates. ✅
7. **Die Steven-Frage:** a skeptic with only this evidence reaches the deterministic verdicts (tests/tsc/build/render). For the real-model **prod** verdicts, evidence is explicitly deferred to the founder re-walk — no over-claim. ✅

## Unit SHAs
- U1 `94ca1f5` · U6 `f65e4c0` · U3 `d26cadd` · U7 `ba48997` · U5 `dd87338` · U2 `36ed3a3` · U4 `db7126e`

## Honest-Limitations (mandatory)
- **Real-model prod gates not run here.** This is a secretless cloud session (no prod/test-account keys). Every "real model, verbatim, prod" gate (U1 received mail, U2 live-URL title string, U3 verbatim honest-no, U4 live search + Quelle, U5 live txt message) is **founder-side** — deterministic tests stand in for the mechanism, not the live behaviour. Not merged for exactly this reason (Law 3: any un-seen outward gate → HALT).
- **U1 sending domain is a founder action, not a code guess.** I did not change the `from` default, because which domain is Resend-verified is founder knowledge; a wrong guess would equally break it. The fix surfaces the failure honestly + logs the Resend error so the founder can act.
- **U2 covers the documented F-17 mechanism (css/js sibling divergence), not every possible one.** A model writing to the wrong *HTML* sibling (e.g. `about.html` when it meant `index.html`) is the model choosing the wrong semantic file — reconcile can't fix that (it's not a linked-asset divergence). The report still attests the *actual* written path (not narration), and the css/js cure is the proven, reproduced root cause. Deriving the whole report against the served entry would be a larger change to the P0 deploy surface — deliberately not bundled here.
- **U4 does not add search to project chat.** It makes base chat honest (decline by mode) and confirms the agent path works. Building full project-chat search (Fix A/B) is a larger architectural change — a founder-decision follow-up.
- **U6/U7 pixel gates.** U7's landing render was captured locally (dev build). U6's diff-sheet render needs an authenticated live agent session with a report card (not reproducible headlessly here); the wiring is verified by static trace against the proven `openDiff` path + build/tsc. The landing themes via a manual toggle, so light/dark renders were byte-identical (single default theme captured).

## Founder actions
1. **U1 — verify the Resend sending domain.** Confirm which domain is verified in Resend. If `send.justgoblin.com` is **not** verified, either verify it, or set `SUPPORT_EMAIL_FROM` (and/or `RESEND_FROM`) to a verified sender (the digest path uses `noreply@justgoblin.com`). Until then, escalations will honestly report failure instead of falsely claiming success.
2. **Migrations:** none authored this wave.
3. **Re-walk gates:** F-29 (mail arrives), F-17 (title actually changes on the live URL), F-21 (search cites a source), F-24 (honest txt message), plus U3 honest-no (3 paraphrases) and GAP-2 publish scan.
4. **Merge:** after the re-walk gates pass, merge the branch (the founder authorizes every merge — Law 7).

## Founder re-walk list (as requested)
- **F-29:** received-mail screenshot (prod, test account).
- **F-17:** live-URL string — `curl` the deployed URL, grep the changed title.
- **F-21:** search cites a source (`Quelle: <url>`) in an agent run; non-agent chat declines by mode.
- **F-24:** honest `.txt`/unsupported message in the live composer.
- **GAP-2 publish scan** (carried from prior wave).

**HALT** — branch pushed, all deterministic gates green, real-model prod gates handed to the founder.
