# WAVE D-G — Generation Beauty & Chat-Feeling (A-2: von "ok" zu "wow")

**Branch:** `claude/dg-generation-beauty-xpa1js` (from `master` @ `7207f4d`) · **Built:** 2026-07-15 · **Model:** Opus (claude-opus-4-8)
**Status:** conditional merge — founder-gated after eyeballing the before/after sheets (the "wow" itself is the founder's eye; the side-by-sides + the deterministic 2/5→5/5 delta are the argument).

## Why this wave existed
The founder's A-2 beauty gate came back AMBER: the first generated app was clean but generic — white card, Bootstrap-blue button, system font stack. Verdict: **"ok, nicht wow."** Diagnosis from the walk: a generation-prompt problem (missing design guidance), not a UI bug. This wave encodes taste into the generation layer. Bar: a stranger's first generated app should make them want to **SHOW** someone.

## Unit commits
| Unit | SHA | What |
|---|---|---|
| U2 — design-guidance beauty block | `7c4efd8` | Upgraded `APP_DESIGN_FOUNDATION` + injected into BOTH paths + reversed test + ledger NOTE |
| U3 — chat register touch-up | `98db6d8` | One `Sprachregister` bullet (calm colleague, no sales-closers) + deterministic guard |
| U1/U4 — evidence + harness | `b611786` | Real-model before/after captures, screenshots, side-by-side, style scores, harness scripts |
| (this report) | — | REPORT.md |

*State-first (Phase 0): repo @ `7207f4d`, clean tree, on the designated branch. FW1–FW5 chains verified present (attested==shipped, edit_file path, Wave-A prefix-cache structure) and NOT regressed — the prefix-stability suite is green and the block rides the byte-stable prefix on both paths.*

## What changed — the two code units

### U2 — the design-guidance block (heart of the wave)
`apps/api/src/prompts/app-design-foundation.ts` — `APP_DESIGN_FOUNDATION` was upgraded from a compact **system-font floor** (WAVE-A) into an **opinionated indie-designer contract** and — the key decision — extended to a **second path**:

- **Both paths now.** WAVE-A kept the foundation **agent-only** (its old test asserted it must NOT leak into base chat). The founder's A-2 gate is about generation beauty *wherever an app is born*, and a "Baue mir …" **chat** message is a first-class code-gen path that previously had **zero** design guidance. The block now rides the byte-stable cached prefix of BOTH `AGENT_STATIC_PREFIX` (agent) and `buildGoblinChatSystemPrompt` (base chat). The old "does NOT leak into chat" test was **reversed** to assert both-path injection — a deliberate, documented decision-reversal, not an accident.
- **The taste contract** (verbatim intent, house wording): Grundhaltung ("gestaltest wie ein guter Indie-Designer, nicht wie ein Framework-Default") + 8 binding rules — no framework defaults (named `#007bff`/`#0d6efd`), an intentional **Google-Font PAIRING** (`display=swap`, `clamp()` headlines), a **`:root` custom-property palette** derived from the theme, an 8-spacing rhythm, careful details (one radius, soft multi-step shadows, `:hover`/`:active`, 150–250ms transitions), mobile-first at 375px (≥44px touch), honesty (no 404-ing placeholder images), and **one coherent mood** (Editorial / Soft Craft / Bold Minimal). Plus the **BAD/GOOD few-shot anchor** (white card + `#007bff` + system-ui  →  custom-properties + font-pairing + mood).
- **Scope preserved:** still explicitly the *generated app, NOT Goblin's own UI*; still defers to the user's own look (`Vorrang`); still no external CSS framework (Google Fonts `<link>` are fonts, not a framework).

**Ledger (same commit):** exact cost measured with the **real DeepInfra tokenizer** (`scripts/dg-beauty/measure-block.ts`, DeepSeek V3.2 = Goblin Swift): **+1549 input tokens** per generation turn (block = 4782 chars), **cache-warm (~0 marginal) after turn 1** on both prefixes. No output-token change (quality, not length). Supersedes the WAVE-A "~800 tok, agent-only" figure. No new billing path, no migration.

### U3 — chat register touch-up (the "feeling" half)
`apps/api/src/prompts/goblin-chat-system.ts` — **one added bullet** in the `IDENTITY` `Sprachregister` block:

> `- Ton: Sprich wie ein ruhiger, kompetenter Kollege — konkret, freundlich, ohne Vorrede. Komm zur Sache, statt die Frage einzuleiten. Keine anpreisenden oder aufmunternden Schlussformeln aus Gewohnheit ("Viel Erfolg beim Bauen!", "Goblin hilft dir gern weiter!", "Frag mich jederzeit!", "Happy Coding!") — sie klingen wie ein Verkaufsabschluss statt wie ein Kollege. Ist die Antwort fertig, hör auf. Ein echter nächster Schritt (welcher Klick, welche Datei als Nächstes) gehört dazu; eine Werbefloskel nicht.`

Scoping is deliberate and tested: it lives in `IDENTITY` (**base chat only**). The agent's narration voice ("ein knapper Satz pro Schritt") is **left as-is** per the task — narration during work stays in the established step-stream voice. The honest hand-off (which click next) is explicitly preserved; F-25 (`knapp`) and A1 (no-claimed-actions) honesty few-shots are un-regressed (asserted in `chat-register.test.ts`).

## Gates & evidence

### U2 — deterministic prompt gates (all green)
`app-design-foundation.test.ts` (6) · `prefix-stability.test.ts` (5) · `goblin-agent-system.test.ts` (23, agent regression) · `feel4-context.test.ts` (13) · `project-context.test.ts` (8) · `chat-register.test.ts` (5) → **60/60 passed**. The block is present on both paths, carries the taste contract (font pairing / `:root` / moods / mobile-first / dark mode), bans the framework defaults, stays cache-warm, and stays scoped to the generated app.

### U4 — measurable style compliance (the numeric gate)
Same three verbatim prompts, same model (Goblin Swift), same chat code-gen path — only the U2 block differs. Deterministic 5-check scorer (`scripts/dg-beauty/style-check.ts`): (a) no banned default-blue · (b) Google-Fonts/real typeface · (c) `:root` palette referenced · (d) consistent radius · (e) transitions.

| Archetype | BEFORE | AFTER |
|---|---|---|
| A — Habit-Tracker | **2/5** | **5/5** |
| B — Pasta-Rezepte | **2/5** | **5/5** |
| C — Hundeverein | **2/5** | **5/5** |

**Target was ≥4/5 on 3/3 → met at 5/5 on 3/3, on the FIRST run** (no regeneration needed, no cherry-pick). Evidence: `evidence/dg-beauty/{before,after}/_style-compliance.md` + `.json`.

### U1/U4 — before/after renders (the founder's eye is the real gate)
Local `file://` screenshots @375 + desktop for all three, plus the side-by-side sheet: `evidence/dg-beauty/side-by-side.html` and `evidence/dg-beauty/side-by-side.png`. Visible delta, e.g.:
- **Habit:** blue-gradient header + white card + blue button  →  cream canvas, bold display headline, forest-green accent button, soft rounded cards (Soft Craft).
- **Pasta:** generic orange-gradient list  →  forest-green editorial header + serif display title + cream recipe cards with CSS-gradient headers (no fake photos — honesty rule 7 held) + terracotta accent/outlined-secondary buttons (Editorial).
- **Hundeverein:** dark-blue generic  →  warm cream/green editorial with a structured event calendar + contact section.

### U3 — register probes (real model, before vs after, verbatim)
`evidence/dg-beauty/register/{before,after}/{1-question,2-task,3-followup}.md`. Isolation: both runs carry the identical U2 block; only the register wording differs. Clearest visible delta — the follow-up: BEFORE *"Ja, ich passe den Button an: … eine bewusste Typografie und einen sanften Übergang."* → AFTER *"Ich passe den Button an: runde Ecken, größere Schrift und mehr Padding."* (drops the "Ja," preamble, more concrete). Both runs correctly close with the honest hand-off, not a sales-closer.

## Consumption (ledger updated same commit)
+1549 input tok/generation on both paths, cache-warm after turn 1; U3 ≈ +90 input tok (cache-warm) with a ≤0 net output effect (its intent is to trim habitual sales-closer output). No new billing mechanism, no new knob, **no migration**. One-off real-model verification (3 before + 3 after generations + 6 register probes + 2 tokenizer probes on Swift) ≈ **$0.02 total wholesale** — a one-time gate cost, not a runtime path.

## Honest-Limitations (mandatory)
1. **"Wow" is unmeasurable here.** The deterministic 2/5→5/5 delta proves the *mechanics* landed (fonts, palette, radius, transitions), NOT that a stranger says "wow". The side-by-sides are the argument; **the founder's eye is the gate.** A 5/5 style score is necessary, not sufficient — a page can pass all five checks and still be ugly.
2. **Real-model gate ≠ prod-UI walk.** This session had no test-account credentials, so I did NOT drive justgoblin.com. Instead I called the **exact shipping model** (DeepSeek V3.2 via DeepInfra, the wholesale slug prod routes "Goblin Swift" to) with the **exact shipping system-prompt builders**, on the **chat code-gen path**. Same model + same prompt = a faithful measurement of the prompt change, but it is not a click-through of the live product. A founder prod walk (one live generation of his own) remains the final confirmation.
3. **Path captured = chat, not agent.** Before/after generations run the **chat** code-gen path (single completion → extractable files → renderable), which is where the "generic" output came from and where the largest delta lives (chat had zero guidance before). The **agent** path already carried the WAVE-A floor and now carries the same upgraded block (verified at the prompt level by the test suite), but I did NOT capture agent-loop before/after renders (the multi-turn tool loop is not reproduced in the harness). Prompt-level parity is proven; agent-render parity is asserted, not screenshotted.
4. **n=1, stochastic model.** Each generation/probe is a single sample at temperature 0.7. The style scores are robust (the block cues all five deterministically and all three passed first-try), but the register probes are illustrative, not a rate — and the register delta is subtle because the base register was already fairly disciplined post-F-25.
5. **Pre-existing `tsc` errors (NOT mine).** `tsc -p apps/api` reports **3 errors**, all in **FW5 test files I never touched** (`explorer-upload.test.ts:36`, `cancel-refund.test.ts:72,135`) — confirmed present on base `7207f4d` with my changes stashed. My changed/added files add **zero** new type errors. Flagging honestly rather than claiming a clean `tsc`; these are a pre-existing toolchain/strictness drift in test files, out of this wave's scope.
6. **In-memory register.** U3 shapes model output; it cannot *guarantee* the model never emits a closer (prompts steer, they don't hard-enforce). The deterministic test guards the *instruction's* presence, not the model's every output.

## Founder actions
1. **Eyeball the before/after** — open `evidence/dg-beauty/side-by-side.png` (or `.html`). This is the real A-2 gate: does the "after" make you want to show someone?
2. **(Ideal) one live generation of your own** on prod with Goblin Swift — confirm the prompt change lands in the actual product UI, not just the harness.
3. **Merge** if the eye passes. No migration to apply. No env change. No new paid dependency.
4. Optional: if you want the moods dialed (more Editorial vs Soft Craft), that's a one-line steer in rule 8 — say the word.

## The Steven-question
*"Would a skeptical reviewer reach my verdict from my evidence alone?"* — For the **mechanics** (2/5→5/5, real tokenizer cost, both-path injection, honesty held): yes, the numbers and screenshots are reproducible from the committed harness. For **"wow"**: no — that's explicitly handed to the founder's eye (Limitation 1). Verdict stated at that altitude.
