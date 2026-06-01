# Dario Audit — v2 (2026-06-02)

**Re-audit after the model fix.** Persona: Anthropic-CEO-type investor. Five minutes, real working app, investor pace. Walked **prod** (goblin-web.vercel.app), because that is what a real user/investor touches — localhost can't reach the prod API (CORS), so localhost is irrelevant to this audit.

> **What changed since v1:** In v1 every first prompt died on "Model not found in LiteLLM" — I couldn't evaluate the product at all, only the marketing. This time the engine *starts* — but only if you know to reach past the default. That distinction is the whole audit.

---

## Overall impression (3 paragraphs)

The front door is genuinely good. The landing page — "Tell it what you want. **It ships.**", *"The cloud workshop for builders who don't wait for a laptop"* — is a real position, not a buzzword salad. It names a category (cloud + mobile + BYOK) instead of claiming to be a faster X. The BYOK provider row (Anthropic, OpenAI, Google, Groq, xAI, Mistral, DeepSeek), the "3-day trial, no card", the consistent mark, the dark-mode toggle — this reads productized. Six months ago I'd have taken the meeting on the landing alone. The onboarding behind it is even better: a five-step "set up your workshop" flow that explains, in plain language, that *you* bring the model and Goblin orchestrates it, with a guided path for people who've never touched an API key. That is a hard thing to do well and they did it well.

Then I tried to actually build something, and the product split in two. When I manually selected **Groq Llama 3.3 70B**, the core loop fired end to end: I typed a request, the agent streamed a narration, and clean, valid HTML appeared in the editor as a draft, with a Save→Publish gate beside it. *That* is the company. That is "tell it what you want, it ships," and it works. But the **default** model — the "Gemini Flash" the composer ships selected, and the "Google Gemini 2.5 Pro" the onboarding *recommends* as the gentlest start — both error. Flash returns "Model not found in LiteLLM"; 2.5 Pro returns a 400 "LLM Provider NOT provided." So the exact v1 failure still happens to anyone who follows the happy path. The fix didn't fix the demo; it added a working path *next to* the broken default.

So my verdict moved from "can't evaluate" to "can evaluate, and the thing underneath is real — but the first five minutes are booby-trapped." An investor who clicks "Start building free," accepts the recommended provider, pastes a valid Google key, and types their first idea will watch it fail, exactly as in v1. The gap between "this works" and "this works *for a new user without coaching*" is the only thing standing between Goblin and a second meeting. It is also, mercifully, a configuration bug, not an architecture problem.

---

## Findings

### 🔴 Critical — the default/recommended model is broken (regression of the v1 killer, in disguise)
- Composer ships with **Gemini Flash** selected → first prompt → "Model not found in LiteLLM."
- Onboarding **recommends** Google Gemini 2.5 Pro as the "gentlest start" → even with a *valid* key, generation 400s: `LLM Provider NOT provided ... model=google/gemini-2.5-pro` (wrong LiteLLM prefix — should be `gemini/`, and the free Flash isn't registered in the proxy at all).
- Only a *manually selected* Groq model works. A new user has no reason to override the recommended default.
- **Investor read:** "Your pitch is the first prompt. You fixed the engine and then pointed the ignition at the one cylinder that doesn't fire." This is P0 and it is the *same* P0 as v1, dressed differently.

### 🔴 Serious — test-data pollution is worse, not better
- Dashboard reads **"58 AKTIV"** projects; sidebar is a wall of `[E2E-TEST] 9C-…`. v1 flagged this; it persists at the same scale.
- An investor doing a screen-share sees 58 garbage projects and one real one. Signals "nobody has cleaned this up," which signals "pre-product."

### 🟠 Serious — keyboard-shortcuts overlay still squats on every screen
- The "KEYBOARD SHORTCUTS" panel sits bottom-right on dashboard, chat, **and** Code Tab, and doesn't stay dismissed across navigation. v1 flagged it; unchanged.
- On a demo it reads like a leftover dev widget.

### 🟡 Cosmetic / positioning
- **Bilingual identity persists** but is now *intentional* per the EN-marketing/DE-app policy. Acceptable for beta; the seams (DE app strings under EN marketing) should at least be deliberate, not accidental. Verify no EN leaks into the app and no DE leaks into marketing.
- **Output language drift:** I prompted in English; the agent narrated and generated in German (app-context language). Defensible, but a global investor testing in English will notice the model answered in another language.
- **Agent narration is verbose** for a "ships it" product — paragraphs of German prose before the code. Dario wants to see the artifact, fast.

---

## What persists from v1 vs what's new

| | Status |
|---|---|
| Model dead on first prompt | **Persists** — but now only on the default/recommended path, not universally |
| 58 `[E2E-TEST]` projects | **Persists** (same scale) |
| Shortcuts overlay squatting | **Persists** |
| Bilingual identity | **Persists** — now policy, not accident |
| Core loop quality | **NEW (positive):** with Groq, chat→stream→draft→Save→Publish genuinely works and produces clean code |
| Onboarding | **NEW (positive):** strong 5-step plain-language BYOK setup |
| Output language drift (EN prompt→DE answer) | **NEW (minor)** |

---

## Verdict

**Would I invest?** Not on today's first-run experience — because the first run still fails for a normal user. **But** the delta from v1 is the most important signal in the deck: the actual product works, the onboarding is thoughtful, the positioning is a real category. This is now a *fix-the-default-model* away from a demo I'd champion, not a *rebuild-the-product* away.

**Second meeting?** Yes — conditional on one thing: sit a stranger down, have them follow the recommended path, and watch them reach a working generation without you touching the keyboard. The day that works, the round is fundable.

**One sentence to the founder:** You proved the engine runs; now make sure the key in the ignition is the one that turns it.
