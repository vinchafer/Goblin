# CC PROMPT — PITCH WAVE "ACT II": VISION ARC + SCHEMA-A ALIGNMENT
Standalone prompt · paste into a cleared session · Repo: vinchafer/justgoblin-pitch · Model: Opus 4.8
(Design-sensitive wave — if a stronger model is available, prefer it; otherwise the gates protect the design.)

=== CONTEXT (standalone — read fully) ===
You are CC, executor for Goblin (justgoblin.com), an AI build-and-deploy platform for non-technical
builders. This session works ONLY in the PITCH repo (vinchafer/justgoblin-pitch), live at
justgoblin.dev/pitch (investor password gate exists; two gate states: public and investor-unlocked).
The pitch is a scrolling deck of sections (§01–§11b), EN + DE via lib/i18n.ts, styled per the Goblin
design system (Goblin Green #0F2B1E lockup, fonts Manrope / Instrument Serif / JetBrains Mono,
Tailwind v4 @theme tokens, semantic aliases --text/--border/--panel).

STRATEGIC CHANGE this wave implements: Goblin's thesis has evolved from "the honest builder" (v2) to
"the operations platform — where software built by non-developers lives" (v3: Build → Ship → Keep;
Goblin-hosted Living Apps + the Keeper agent that watches, reports honestly, and fixes). Source of
truth for content: docs/GOBLIN_THESIS_v3_DRAFT.md and docs/GOBLIN_OPS_EXECUTION_BLUEPRINT_v1.md in
the MAIN repo (vinchafer/Goblin) — fetch and read both before writing a single slide word. The pitch
must now tell TWO acts: Act I = what exists today (the honest builder, real, shipped, walkable);
Act II = where it goes (the operations platform) — clearly, beautifully, and HONESTLY separated.

Also bundled into this wave (long-pending): SCHEMA-A ALIGNMENT. The canonical layer schema is
Schema A: Layer 1 = Goblin's own models (Goblin Swift + Goblin Forge, no key, the default, live now)
→ Layer 2 = free third-party keys (optional) → Layer 3 = BYOK paid providers (optional). Cloud infra
and cross-provider routing/failover are presented as "Architecture & Moat" properties, NOT as layer
numbers. Any remaining Schema-B remnant (L0/L2.5 numbering, inverted order) in EN or DE is a bug.
Reference memo exists at Pitch\review\LAYER_NUMBERING_RECONCILIATION_2026-07-01.md — read it.

=== ABSOLUTE RULES ===
1. STATE-FIRST: git log, verify every file named here exists; the repo is the truth. HALT on
   contradiction.
2. One unit = one isolated, revert-ready commit. You open a PR; you never merge.
3. HONESTY IS THE PRODUCT AND THE PITCH: Act II content must be IMPOSSIBLE to misread as shipped.
   Mandatory mechanics: (a) a visible act divider section ("Act II — Where this goes" / DE "Akt II —
   Wohin das führt") with an explicit line: EN "Everything from here is roadmap, not product." /
   DE "Alles ab hier ist Roadmap, nicht Produkt."; (b) every Act-II section carries a persistent
   small badge "ROADMAP" (design-system styled, not an afterthought); (c) no screenshots/mockups of
   unbuilt Keeper UI styled like product shots — use schematic/diagram visual language that is
   visibly distinct from Act I product fidelity; (d) verb discipline: Act I "is/does", Act II
   "will/wird" — sweep for violations.
4. NUMBERS LAW: no financial figure enters the pitch unless it traces 1:1 to
   GOBLIN_CFO_DASHBOARD_DE.html (rendered values). The PROPOSED prices in the thesis/blueprint are
   NOT reconciled → they DO NOT appear. Market facts (Lovable ARR class, retention-crisis stats,
   Apple guideline actions, ChatGPT Sites existence) may appear ONLY with a sources block
   (§sources or footnotes) citing publication + date; no invented precision; round honestly.
5. German UI/DE track: full DE parity for every new string via lib/i18n.ts; mark machine-drafted DE
   as @draft only if genuinely uncertain; no English leaks in DE mode.
6. Design system only; both gate states must remain intact; Presentation Mode (fullscreen/keyboard)
   must work through new sections; do not break §11b hidden state.
7. VERIFICATION LAW (this repo's hard-won rule): visual verification = rasterized A4 PORTRAIT PDFs
   via Playwright, page by page, BOTH gate states, BOTH languages. Never headless-landscape
   screenshots as evidence (documented false-green source). Evidence artifacts attached to PR.
8. No new paid services/accounts; no scope beyond the units below; found bugs = FINDINGS.
9. Self-review checklist before PR (evidence audit · diffstat vs scope · regression probe: one
   existing section pixel-compared pre/post · honesty sweep · report completeness with numeric
   results · the skeptic question). Report format: PR link, unit SHAs, per-gate evidence refs,
   HONEST LIMITATIONS (mandatory), FOUNDER ACTIONS.

=== NARRATIVE DIRECTIVE (binds U2–U6 — this is the founder's core dramaturgy, treat as a gate) ===
The deck must be built as a deliberate expectation-and-turn. Act I *knowingly* plays into the
reader's expectation ("ah, another vibe-coding app") — it does NOT fight that framing, it earns it:
a genuinely excellent, honest builder, shown with confidence. The act divider is the turn. Act II
opens with the WHY of the strategic step, in this exact logic (write it in the founder's voice, both
languages, this is the emotional center of the deck):

  1. "Anyone can generate an app now. That race has a winner list already — and it's the giants."
     (DE sense: "Apps generieren kann inzwischen jeder. Dieses Rennen hat seine Gewinner schon —
     und es sind die Grössten.")
  2. "So we're taking the exit. We keep building a top-tier builder — that's our entrance ramp —
     but the company is the road nobody is on: what happens to these apps AFTER they exist."
     (The exit/Ausfahrt metaphor is the founder's own — use it or an equally strong image, never
     a generic 'pivot' framing. FORBIDDEN words: "pivot", "reposition".)
  3. "Everyone monetizes the moment of creation. We monetize the lifetime of the thing created."

Gate for this directive: a cold reader who skims Act I thinking "another vibe-coding app" must hit
the turn and be able to restate, in one sentence, WHY the exit is the smarter road (commoditized
generation vs. unowned operations). If the divider + V1 don't produce that sentence, the narrative
unit fails regardless of visual quality. The turn must feel like strategy from strength, never like
retreat — Act I's quality is precisely what makes the exit credible.

=== UNITS ===
U1 — SCHEMA-A SWEEP (do first; foundation for everything after).
Grep-driven audit EN+DE for Schema-B remnants (layer numbering, "Layer 0", "2.5", inverted order,
key-first framing). Fix §03 stack section to Schema A exactly; routing/failover framed as
"Architecture & Moat" card, honest wording: pre-request circuit breaker routing NEW requests to
healthy providers (never claim instant per-message swap). Evidence: before/after PDF pages + grep
output showing zero remnants.

U2 — ACT STRUCTURE & DIVIDER.
Introduce the two-act narrative without renumbering existing anchors: Act I label applied subtly to
current product sections; new divider section (§08b or nearest clean slot — derive from repo) with
the honesty line (Rule 3a), Instrument-Serif display styling, both languages, both gate states.

U3 — §V1 "THE PROBLEM MOVED" (Act II opener — market truth).
Content from thesis §2/§3, compressed to one screen: generation is solved (name the giants
plainly — credibility through candor); what nobody owns is what happens AFTER the URL exists:
orphaned apps, the complexity wall, silent breakage. One strong stat line max 3 items, each with
source+date in the sources block. Tone: the same confident-honest voice as Act I, no doom styling.

U4 — §V2 "BUILD → SHIP → KEEP" (the vision architecture).
The lifecycle diagram: three verbs, Goblin under all three. Living App concept in one sentence
("Your app, hosted, watched, and honestly reported on"), Keeper capability ladder K0→K3 as a
schematic ascent (watch → explain → propose fix → heal, "heal" explicitly marked as the furthest
step). Schematic visual language per Rule 3c. DE naming: use "Living App" as product term in both
languages (brand decision pending — add FINDING if it collides with anything in-repo).

U5 — §V3 "WHY US, WHY NOW" (the five-property square + timing).
The defensibility slide: honesty architecture (truth-gated deploys exist TODAY — this is the Act-I
bridge and the strongest credibility move: the moat is already shipped, only the business on top is
roadmap), Max-language operations, export freedom (leaving is free, always), open-model cost floor,
mobile-first while competitors are hobbled (Apple facts, sourced). Timing: the frontier moved
down-market INTO generation — which commoditizes exactly the part we don't want to own. This
reframes the ChatGPT-Sites threat as confirmation; write it that way, without naming-and-shaming
theatrics.

U6 — §V4 "THE PATH" (honest roadmap).
Gate-based roadmap, NOT date-based: Validate (first cohort, the three questions W4-return /
W8-alive / willingness-to-pay) → Ship the Living App → Keeper → (further steps compressed). Each
step marked with its gate. Explicit line: EN "We build the next step only when the previous one is
proven." / DE "Wir bauen den nächsten Schritt erst, wenn der vorherige bewiesen ist." This
discipline IS the investor message — a solo founder who pre-commits kill criteria is rarer than one
with a big TAM slide. Business-model evolution shown QUALITATIVELY only (builder revenue →
per-living-app recurring → transaction take-rate; a curve, no numbers — Rule 4).

U7 — COMPETITOR MAP v2 (§08 update).
Extend the existing map along the new axis: "generates" vs "keeps alive", non-dev language vs dev
language. Place OpenAI Sites, Lovable, Replit, Wix/Base44 honestly (Replit HAS dev-monitoring —
show it; our square is the non-dev + honest + exportable + mobile combination). No strawmen; a DD
reader must nod at every placement.

U8 — SOURCES BLOCK + FINAL VERIFICATION SWEEP.
Sources section (small, end of deck or footnote layer) for every Act-II market claim. Then the full
Rule-7 verification: rasterized A4 portrait PDFs, EVERY page, both gate states, both languages;
invariant checklist per page (act badges present, verb discipline, no orphan strings, presentation
mode traversal). Numeric report: pages checked N/N per state/language.

=== FOUNDER ACTIONS (expected in report) ===
Review Act-II copy voice (founder's story, founder's words — flag any line that doesn't sound like
Vincent) · decide "Living App" naming keep/change · merge via GitHub app · after merge: one manual
walk through justgoblin.dev/pitch on iPhone, both gate states, before any investor sees it.

=== WHAT THIS PROMPT MUST NOT DO ===
No pricing of any kind · no fake product shots of Keeper · no new sections behind the investor gate
without listing them in the report · no touching the main app repo · no "IPO" language anywhere in
the deck (the deck earns seed-conversations; grandiosity reads as risk).
