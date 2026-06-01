# Three-Persona Audit — Synthesis v2 (2026-06-02)

Re-run of the Dario / Max / Sofia audits **with a working model**, on **prod** (goblin-web.vercel.app). v1 was undermined because every first prompt died ("Model not found in LiteLLM") — the personas could only judge the surface. This time the core loop fires (via Groq), so the audits judge the actual product. Full audits: `DARIO_AUDIT_…_v2`, `MAX_AUDIT_…_v2`, `SOFIA_AUDIT_…_v2`.

---

## The headline: the model is still broken *by default* — only the working path moved out of sight

Vincent's premise for Sprint 9 was "the model situation is fixed (Groq + Gemini, both BYOK, both working)." **That is half true.**

- ✅ **Groq Llama 3.3 70B works end-to-end** — chat→stream→draft→Save→Publish, clean valid code. This is the single biggest change from v1: the product is now *evaluable and genuinely good* on the working path.
- 🔴 **Both Gemini models are broken.** Free "Gemini Flash" → "Model not found in LiteLLM." BYOK "Gemini 2.5 Pro" → `400 LLM Provider NOT provided ... model=google/gemini-2.5-pro` (wrong LiteLLM prefix — should be `gemini/`; free Flash isn't registered in the proxy at all).
- 🔴 **The default and the recommendation both point at the broken model.** The composer ships with Gemini Flash selected; the onboarding *recommends* Gemini 2.5 Pro as the "gentlest start." So a new user following the happy path hits the **exact v1 failure** — after investing two minutes and a real Google key.

All three personas converge on this, same as v1, for the same reason: *your entire pitch is the first prompt, and the first prompt still fails for a normal user.* The fix added a working path **next to** the broken default instead of fixing the default. **This is the Sprint-9 P0 and it is unchanged in severity from v1 — only disguised.**

Root cause is configuration, not architecture: prod's model catalog (DB rows Vincent added manually; not in repo seed) carries `google/…` slugs LiteLLM rejects, and the free Gemini isn't registered in the proxy. Repo `providers.ts` already uses the correct `gemini/` prefix — prod diverged. **Fix = correct the prod model rows' provider prefix + register/repair the free model in LiteLLM, OR default new users to Groq.** Cannot be fixed from this repo (prod DB/proxy state; B3 shield).

---

## What's RESOLVED by the (partial) model fix

- The **core loop is real** (Groq): tell-it-what-you-want → streamed code → draft → Save → Publish. All three personas now confirm the product *works* where v1 could confirm nothing.
- **Output quality** is fair-to-good for prototype scope.
- The **multi-session Code Tab** (Sprint 7) is live in prod (migration 0055 applied) — parallel sessions, per-session model binding, draft-gate.
- **File Explorer + deploy history** appear live (migration 0056 applied per Vincent).

## What PERSISTS from v1 (real bugs, model-independent)

| Issue | Personas | Sev |
|---|---|---|
| Default/recommended model broken (Gemini) | all 3 | 🔴 P0 |
| `[E2E-TEST]` pollution — **"58 AKTIV"** projects in sidebar/dashboard | Dario | 🔴 P1 |
| Keyboard-shortcuts overlay squats on every screen, won't stay dismissed | Dario, Max | 🟠 P1 |
| Dev jargon in error states ("LiteLLM", "LLM Provider", "Model not found") | Max, Sofia | 🟠 P1 |
| No git surface despite "push to GitHub" claim | Sofia | 🟠 P2/P3 |
| Browse-only file explorer (no rename/move, not session-linked) | Sofia | 🟠 P2 |
| Single-file mental model; no find/replace, multi-file, repo import, diagnostics | Sofia | 🟡 P3 |

## NEW findings in v2 (only visible because the loop now runs)

- 🟢 **Onboarding is a genuine asset** (Max): 5-step, plain-language, no-jargon, guided-free-key BYOK setup with concrete instructions and encrypted-keys reassurance. Vincent's "top setup assistant" claim is **true**. — *Preserve; only fix where it points.*
- 🔴 **The onboarding funnels into the broken model** (Max): the better the funnel, the deeper the betrayal when the recommended key powers a dead model.
- 🟠 **⌘K is a navigation quick-switcher, not a dev command palette** (Sofia): it offers a developer affordance it doesn't fulfill.
- 🟡 **Output language drift** (Dario): EN prompt → DE narration + DE page copy (follows app-context language).
- 🟢 **Draft-before-accept** generation model (Sofia): the right default; quietly good.

---

## Updated Sprint 10 backlog (prioritized)

| P | Item | Source | Effort | Owner |
|---|---|---|---|---|
| **P0** | Fix prod Gemini model rows (`google/`→`gemini/`) + register free model in LiteLLM, **or** default new users to working Groq | all 3 | S | **Founder** (prod DB/proxy) |
| **P0** | Plain-language model-error states (no "LiteLLM"/"LLM Provider" leakage); fall back gracefully when a model is unavailable | Max, Sofia | S | Sprint 9 P4 (microcopy) + founder |
| P1 | Hide `[E2E-TEST]` from sidebar/dashboard (filter on query) | Dario | S | **Sprint 9 P4** |
| P1 | Dismiss-and-remember shortcuts overlay; `?`-triggered; hide on touch | Dario, Max | S | **Sprint 9 P4** |
| P1 | Enforce EN-marketing / DE-app boundary | Dario, Max | M | **Sprint 9 P4** |
| P1 | Plain-German microcopy pass | Max | S | **Sprint 9 P4** |
| P2 | `?session=` deep-link from dashboard | carryover | S | **Sprint 9 P4** |
| P2 | Git read-surface (branch/status/last-push) | Sofia | M | Sprint 10 (Convergence Slice) |
| P2 | Multi-file editing in one session | Sofia | M | Sprint 10 |
| P2 | File-explorer rename/move + session-linked tree | Sofia | M | Sprint 10 |
| P3 | Find/replace + multi-cursor (CM6 supports both) | Sofia | S | Sprint 10 |
| P3 | Repo import | Sofia | M | Sprint 10 |
| P3 | Real dev command palette (or stop showing ⌘K as one) | Sofia | M | Sprint 10 |

---

## The most important question: is Goblin viable for first beta users NOW?

**Not on the default path; yes on the working path — and the gap between them is one config fix.**

A beta user who is *told* "select Groq" reaches a magic experience: idea → streamed code → published live URL, from their phone. That experience is real, today. But a beta user left to the **default + recommended** path hits the v1 wall and leaves. So Goblin is **one P0 (repoint the model) away from beta-viable**, not a sprint away. Everything else in the backlog is polish (P1) or the Convergence fundamentals (P2/P3) — important, but not blockers to a first user succeeding.

**Beta-readiness: ~70% as-shipped-default, ~90% on the working path.** The number is bimodal *because of one bug.* Fix the default model and the same product jumps to ~90% the same afternoon.

---

## Note on the persona conflict (feeds the Convergence Architecture)

v1 framed Max-vs-Sofia as "pick the audience, layer the rest." Vincent has **rejected** that framing for Sprint 9: not simple-vs-advanced layering, not picking one — a *convergence* where both get their maximum in one tool. The audits support that this is achievable rather than contradictory: Max and Sofia want **different reach**, not different *capabilities* — they share cloud, mobile, BYOK, persistent files, real code. The divergence is which tools are foregrounded, not which exist. See `CONVERGENCE_ARCHITECTURE_2026-06-02.md`.
