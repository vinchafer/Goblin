# Three-Persona Audit — Synthesis (2026-06-02)

Three reviewers walked Goblin live: **Dario** (investor/polish), **Max** (vibe-coder, the target user), **Sofia** (senior dev, edge-cases). Full audits in `DARIO_AUDIT`, `MAX_AUDIT`, `SOFIA_AUDIT`.

---

## The one thing all three flagged (do this before anything else)

### 🔴 The AI loop is dead for the trial account — "Model not found in LiteLLM"
Every persona's first real prompt errored. It is simultaneously:
- **Dario:** "your entire pitch is the first prompt" → won't invest on a click-through that errors.
- **Max:** "ich würde sofort aufgeben" → types one idea, gets a tech error, leaves.
- **Sofia:** can't evaluate the IDE at all because she can't run a generation.

This is the Sprint-9 P0. It dwarfs everything else. Nothing in the surrounding product matters until "tell it what you want" fires for a fresh user. **Fix = provision a default model for trials AND/OR make BYOK-key setup a blocking, plain-language onboarding step so a user can never reach a prompt they can't run.**

---

## Issues by persona

### Only Dario flagged (positioning / polish)
- **Bilingual identity** — EN marketing → DE app. (Max felt it too but tolerated it; for Dario it signals "not productized.") → i18n or pick one.
- **Test-data pollution** — 58 `[E2E-TEST]` projects in the live sidebar. → scope E2E to throwaway accounts.
- **"1 Issue" dev chip** visible (dev-only hydration warning). → ensure absent in demo/prod build.

### Only Max flagged (vibe-coder ergonomics)
- **Dev jargon in errors/labels** — "LiteLLM", "model", "BYOK", "Secrets". → plain-German microcopy; never surface internal component names.
- **Keyboard-shortcut hints on touch** — "⌘K" on a phone is meaningless. → hide on touch devices.
- (Positive, preserve): Save→Publish confirm gap, copyable persistent Live-URL, mobile single-column — these are exactly why Max would stay *if* generation worked.

### Only Sofia flagged (dev fundamentals)
- **File explorer is browse-only** — no rename/move/folder-ops; not wired to the editing session. Looks like a real explorer, can't restructure. → add rename/move; link tree to session, or soften the "explorer" framing.
- **No git surface** despite "push to GitHub" claim → add at least a read-only branch/last-push panel.
- **Single-file mental model**; no find/replace, no inline diagnostics, no autocomplete, no repo import. → roadmap items if "Cloud-IDE" is the real claim.
- **Raw developer-facing errors** (the LiteLLM message) → fine for her, fatal for Max; unify on plain copy.

### Flagged by ≥2
- **KEYBOARD SHORTCUTS overlay** sticks over content on Code Tab + hub, doesn't stay dismissed (Dario + Max). → dismiss-and-remember; `?`-triggered only.
- **Language inconsistency** (Dario + Max).

---

## Consolidated Sprint 9 backlog (prioritized)

| P | Item | Source | Effort |
|---|------|--------|--------|
| **P0** | Working model for trials (default model or blocking BYOK onboarding) + plain-language model errors | all 3 | M |
| **P0** | Apply migration 0056 + redeploy Railway (lights up File Explorer + deploy history in prod) | Sprint-8 carryover | S |
| P1 | Dismiss-and-remember the keyboard-shortcuts overlay; hide hints on touch | Dario, Max | S |
| P1 | Unify language (i18n or single language for beta) | Dario, Max | M |
| P1 | Scrub `[E2E-TEST]` data from real/demo accounts | Dario | S |
| P2 | File Explorer: rename/move + session-linked tree | Sofia | M |
| P2 | Plain-German microcopy pass (no LiteLLM/BYOK/model leakage) | Max | S |
| P2 | Honor code-session `?session=` deep-link from hub | Sprint-8 carryover | S |
| P3 | Git status/branch surface in workspace | Sofia | M |
| P3 | Verify 5.5 AI-undo + 5.6 live-diff once a model exists | Sprint-8 carryover | S |
| P3 | Decide & align the "Cloud-IDE" claim vs current "AI page-builder + file browser" reality | Sofia | — |

---

## Decision points where personas conflict (Vincent picks)
1. **Simplicity vs. power.** Max wants *fewer* concepts and zero jargon; Sofia wants *more* (git, multi-file, diagnostics, import). → These aren't contradictory if layered: keep the default surface Max-simple, put Sofia's power behind an "advanced" affordance. Decide whether Goblin's north star is **Max** (vibe-coder) or **Sofia** (prototyping dev). The marketing ("vibe coders") says Max; the "Cloud-IDE" phrasing invites Sofia's harsher bar. **Pick the audience and make the copy match it.**
2. **"Cloud-IDE" naming.** Drop to "AI page-builder / cloud workshop" (honest today, Max-aligned) or commit to building Sofia's fundamentals. Can't claim IDE and ship a browse-only file view.
3. **Language.** German-first (current app, Max is German) or English-first (current marketing, Dario/global). One.

## Bottom line
Sprint 8 made the *surrounding* product genuinely good — all three personas praised real pieces (persistent URL, file explorer, undo/redo, publish-on-purpose, mobile). The product is gated almost entirely by **one broken thing**: the model. Fix that and re-run this audit; most of the remaining items are polish and positioning, not architecture.
