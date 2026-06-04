# R5 Founder Feedback — Sprint 10.10 (verbatim intent)

Captured from Vincent's iPhone Max-Walk Round 5. He walked the full
onboarding (`/welcome/*` steps 0–5) and STOPPED before the dashboard because
the setup flow has too many inconsistencies to proceed.

## Truth / thesis
- Step 1 wording contradicts the layer story. Thesis should be "Goblin lets
  you just work — models are there" — **but only if that's true.** Today it
  isn't (truth-test below), so be honest. No promise the product can't keep.

## Language
- DE/EN mixing on nearly every screen after the user picked German.
- The marketing landing is English; the APP (everything after the Step-0
  language choice) MUST be in the chosen language. No mixing within a screen.

## Layers
- Re-think and speak the layers cleanly. Vincent's mental model:
  - L1 = the free path (connect a free key, e.g. Groq)
  - L2 = models Goblin provides (no key) — "BALD"/soon, no hard date
  - L3 = optional paid keys on top
- "Not written perfectly yet."

## Provider step
- Speak in PROVIDERS, not specific model versions.
- Can't add two keys (Groq AND Gemini). After adding one it only offers
  Continue — needs Save → add another → Continue.

## Toggles
- Step 4 toggles still square/rectangular. Wants real iOS-style horizontal
  toggles, everywhere in the app.

## Flow bugs
- Step 5: adding a Vercel (or GitHub) token → Continue bounces back to the
  Step-0 language screen. Must save and stay/advance.
- "Continue" CTAs on 2–3 steps look like highlighted text, not buttons.
- After finishing (tokens saved) the user lands in the dashboard with the
  "New Project" modal already open — should land in a clean dashboard.

## Standard
- "Claude Code can click through this 8–10 times if needed." Every button
  tried 2–3×, the whole userflow verified to 100% before it's called done.
