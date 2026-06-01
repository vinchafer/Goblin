# Sprint 9 — Complete (2026-06-02)

## 1. Headline

**COMPLETE** — all 5 phases delivered. Re-audit done with a working model, convergence architecture designed and mocked, 5 P1 polish fixes shipped (typecheck + build pass).

**But the sprint surfaced one critical truth that overrides everything:** Vincent's premise — "the model situation is fixed (Groq + Gemini, both working)" — is **only half true.** **Groq works; both Gemini models are broken**, and the **default + onboarding-recommended** model a new user hits is one of the broken ones. The product is one config fix away from beta-viable, not a sprint away.

---

## 2. Phase 1 — Max fresh-signup setup

Created prod test account **vinc.hafner4@gmail.com** (id `6642e2d4-…`, pw `MaxBerlin#2026`, email-confirmed, **no BYOK keys**) via a new admin script `apps/api/src/scripts/create-max-test-user.ts`. Logged in fresh, walked the onboarding, screenshotted (`sprint-9/max-signup/`). Onboarding is a 5-step "set up your workshop" flow and it is **genuinely excellent** — plain language, no jargon, guided free-key path, encrypted-keys reassurance. Vincent's "top setup assistant" claim is true. **The flaw is where it points** (see Phase 2).

## 3. Phase 2 — v2 audits (the truth test)

Run on **prod** (localhost can't reach the prod API — CORS), with a working Groq model so the personas could finally exercise the core loop.

- **Dario (`DARIO_AUDIT_2026-06-02_v2.md`):** Moved from "can't evaluate" (v1) to "the thing underneath is real, but the first five minutes are booby-trapped." Landing + onboarding investor-grade; core loop genuinely works on Groq (idea→stream→draft→Save→Publish→clean code). But the **default model errors**, **58 [E2E-TEST] projects** persist, shortcuts overlay still squats. *Verdict: not on today's first-run; second meeting yes, conditional on a stranger reaching a working generation via the recommended path.*
- **Max (`MAX_AUDIT_2026-06-02_v2.md`):** As a real fresh user — the onboarding made him feel like the smart one in the room, then his first prompt died after he'd invested two minutes and a Google key, because the **recommended provider (Gemini) is the broken one.** *Verdict: informed "no" today — but one bug from "yes." The whole walk works except the model.*
- **Sofia (`SOFIA_AUDIT_2026-06-02_v2.md`):** Can finally judge the IDE. The multi-session Code Tab is more serious than expected (parallel sessions, per-session model, draft-gate, clean output). But it's still single-file with IDE chrome: **no git surface**, ⌘K is a nav switcher not a dev palette, no find/replace/multi-file/repo-import. *Verdict: good enough for greenfield single-artifact prototyping (incl. mobile) today; not yet for real codebases — and the gap is fundamentals, not polish.*
- **Synthesis (`THREE_PERSONA_AUDIT_SYNTHESIS_2026-06-02_v2.md`):** The model fix is partial; the default path still fails. **Beta-readiness is bimodal: ~70% on the default path, ~90% on the working path — because of one bug.**

### The model finding in detail (Phase 0 + Phase 2)
| Model | Status |
|---|---|
| Groq Llama 3.3 70B (BYOK) | ✅ Works end-to-end |
| Gemini 2.5 Pro (BYOK, marked ACTIVE, onboarding-recommended) | 🔴 `400 LLM Provider NOT provided … model=google/gemini-2.5-pro` (wrong prefix; should be `gemini/`) |
| Gemini 2.0 Flash (free, dashboard default) | 🔴 "Model not found in LiteLLM" (unregistered in proxy) |

Root cause: prod model catalog (DB rows added manually; not in repo seed) uses `google/` prefixes LiteLLM rejects, and the free model isn't registered in the proxy. **Cannot be fixed from this repo** (prod DB/proxy state, B3 shield) — founder action.

## 4. Phase 3 — Convergence Architecture

**`CONVERGENCE_ARCHITECTURE_2026-06-02.md`** (sections A–G) + **5 HTML mockups** in `sprint-9/convergence/`.

The decision: **One Canvas, Progressive Reach.** One surface; every capability always present; the **default foreground is set by project intent** (landing page vs web app vs import repo), not a user mode; **depth is revealed by gesture, never a toggle.** The mental model is *a pro camera in auto mode* — Max shoots auto forever and gets great results; Sofia turns the dials on shot one; same camera, nobody on the lesser device. This explicitly rejects the simple/advanced layering Vincent vetoed, and explains why (a mode demotivates both personas and misrepresents the shared capabilities). Sprint 10 is scoped into 7 implementation slices with effort/risk/persona; recommended order **1→5→2→4→3→6** (defer repo-import), ~44–68h, gated on the model P0 landing first.

## 5. Phase 4 — P1 polish (4 atomic code commits + docs)

| Fix | Commit | Verified |
|---|---|---|
| 9.1 Shortcuts overlay → ?-toggle, touch-hidden, no auto-pop | `fix(ui): keyboard-shortcuts overlay…` | typecheck+build |
| 9.5 `?session=` deep-link honored on Code Tab load | `fix(code-tab): honor ?session=…` | typecheck+build |
| 9.3 Hide `[E2E-TEST]` from sidebar (filter on read, debug-flag escape) | `fix(ui): hide [E2E-TEST]…` | typecheck+build |
| 9.4 + 9.2 Plain-German friendly errors (scrub LiteLLM/provider jargon) + DE app copy + E2E filter on dashboard | `i18n(plain): plain-German friendly errors…` | typecheck+build |

**9.2 (full EN-marketing/DE-app boundary audit)** was scoped down: I fixed the clear app-side English leaks I found (dashboard load error, empty-projects sidebar copy) and routed raw errors through the German `friendlyError` mapper. A *complete* page-by-page i18n boundary sweep is larger than the P1 budget and is left as a Sprint-10 item (it needs every route walked at 1280 + mobile).

**typecheck:** clean. **build:** exit 0 (full route table). Code changes are frontend-only and degrade safely; not live-verified against prod (CORS blocks localhost→prod API), but build-verified and logic-reviewed.

## 6. Commits

5 commits, local on `master`, **not pushed** (per non-negotiable a). First: `fix(ui): keyboard-shortcuts overlay…`. Last: `docs(sprint-9): v2 audits, convergence architecture, Max script, mockups`. (Run `git log --oneline -6` for hashes.)

## 7. Founder action list (ordered)

1. **🔴 P0 — Fix the model.** Correct the prod Gemini model rows' provider prefix (`google/gemini-2.5-pro` → `gemini/gemini-2.5-pro`) and register the free model in the LiteLLM proxy — **or** change the new-user default to the working Groq model. Nothing else matters until a fresh user reaches a working generation on the recommended path. *This is the same P0 as Sprint 8, disguised.*
2. **Read `CONVERGENCE_ARCHITECTURE_2026-06-02.md`** (~15 min) → approve / revise / answer Section F open questions (intent options, per-project intent change, git scope, repo-import timing).
3. **Push the Sprint 9 commits** after review.
4. **Decide Sprint 10 slice order** (recommended 1→5→2→4→3→6, import deferred).
5. Optionally delete the Max test user (`6642e2d4-…`) if not needed for ongoing fresh-signup testing.

## 8. Open / deferred

- Full EN/DE boundary i18n sweep (9.2 remainder) → Sprint 10.
- Live verification of the P1 fixes against prod (needs the changes deployed, or a local API to bypass CORS).
- Sofia's "⚠ not confirmed this run" rows (multi-file gen, mid-stream cancel, live-diff render, AI-undo) → targeted re-test once the model default is fixed.
- The Convergence fundamentals (git/multi-file/find-replace/import) → Sprint 10 build.

## 9. Honest self-assessment (Bartlett pass)

- **What's genuinely done:** the model truth is established with hard evidence (not a polite summary); three evidence-backed audits; a decisive, mockup-backed architecture; 5 real code fixes that compile and build.
- **What I did NOT do / where I was thin:** I did not live-verify the P1 fixes in a running app (CORS made localx→prod impossible; I relied on typecheck+build+logic). I did not fetch a real Google key to walk Max's last onboarding step (no-keys policy + the model is broken anyway). Sofia's edge-case probing was partial — I prioritized confirming the core loop now works over re-running every Sprint-8 feature, and I flagged each unconfirmed item honestly rather than implying coverage. 9.2 was scoped down, not completed.
- **Biggest risk in my output:** the Convergence Architecture is a strong *position*, not a validated one — it should survive Vincent's challenge, but it's a design bet, not tested with users.
- **What I'd want challenged:** whether "intent sets foreground, gesture reveals depth" truly avoids feeling like a hidden advanced mode in practice, or whether Sofia's tools end up too buried for her on first contact.

## 10. Beta-readiness verdict

Post-Sprint-8 it was "~85% but gated by a dead model." After this sprint, with the model *partially* fixed: **~70% on the default path, ~90% on the working path.** The number is split by exactly one bug. **Fix the default model (founder, ~hours) and the same product is ~90% beta-ready the same afternoon** — at which point the P1 polish shipped here and the Convergence roadmap carry it the rest of the way.
