# Convergence Architecture (2026-06-02)

> **The decision this document makes:** Goblin does not choose between Max (vibe-coder) and Sofia (senior dev), and it does not bolt a "simple/advanced" toggle onto one base. It ships **one canvas** where every capability is always present, the **default foreground is set by what you're building**, and **depth is revealed by gesture, never by a mode switch.** Max never sees a stripped product; Sofia never hits a wall. They use the same tool and each thinks it was built for them.
>
> This is the Peter-Thiel move: not "simpler than Cursor" or "more powerful than v0" — a **new category**. Cloud + mobile-first + BYOK + no-hardware, where the power is *latent in the surface* and you reach for exactly as much as you need.

Read time ~15 min. Approve, revise, or send back. No code is written until you say go.

---

## Section A — The Convergence Principle

### The thing nobody else does

Every competitor forces a fork in the road:

- **v0 / Lovable / Bolt:** chat-to-code, beautiful, but you can't *really* touch the code. Great for Max, insulting to Sofia.
- **Cursor / Cline / VS Code:** full power, but the empty state assumes you already are a developer. Great for Sofia, terrifying to Max.

The industry treats "simple" and "powerful" as a slider: to give one user more, you take from the other. **That assumption is wrong, and it's the wedge.** Max and Sofia don't want different *capabilities* — they want different **reach**. Both want: cloud compute (no laptop), persistent files, mobile, multiple BYOK models, and *real code that actually ships*. Those are identical. What differs is **what each one reaches for first**:

- Max reaches for: a sentence, a preview, a publish button.
- Sofia reaches for: a file tree, git status, find/replace, multi-file, a real command palette.

If the capabilities are shared and only the *reach* differs, then you don't need two products or two modes. You need **one surface that foregrounds the right tools by default and keeps the rest one gesture away.**

### The principle, stated

> **One Canvas, Progressive Reach.**
> 1. **One canvas.** Every capability lives in a single coherent surface. No "Max app" and "Sofia app." No "lite mode."
> 2. **Intent sets the default foreground.** What you choose to build (a landing page vs. a web app vs. an imported repo) decides which tools are *foregrounded* on first paint — not a setting, not your account type.
> 3. **Gesture reveals depth.** Sofia's power tools are always *reachable* (keyboard, long-press/right-click, a command palette, panels that slide in on demand) but never *foregrounded* where Max would trip over them. You discover depth by reaching for it, the way you discover right-click menus — not by flipping a switch.
> 4. **No modes.** There is no Simple/Advanced toggle, ever. (Vincent rejected layering, and rightly: a mode tells Max he's on the lesser product and tells Sofia her tools are an afterthought. Both are demotivating, and both are lies — the capabilities are the same.)

### Why "progressive reach" ≠ "progressive disclosure / simple-advanced layering"

This is the subtle, important distinction — and the reason this isn't the rejected toggle:

| Simple/Advanced layering (rejected) | One Canvas, Progressive Reach (this doc) |
|---|---|
| A **mode** the user is *in* | No mode; one surface |
| Advanced features are *hidden behind a wall* | Power tools are *present and reachable*, just not foregrounded |
| Switching modes **reconfigures** the app | Nothing reconfigures; you *reach further* into the same app |
| Tells Max: "you're on the basic version" | Tells Max nothing — he just sees a calm canvas |
| Tells Sofia: "your tools are the bolt-on" | Tells Sofia: "everything's here, where you'd expect it" |
| Discrete (two states) | Continuous (reach as far as you want, moment to moment) |

The mental model is **a pro camera in auto mode**, not a "beginner camera." Auto mode is the full camera with sensible defaults; the dials are right there the instant you want them; you never "switch to pro mode" — you just turn a dial. Max shoots auto forever and gets great photos. Sofia turns dials on shot one. Same camera. Nobody is on the lesser device.

---

## Section B — What Each Persona Reaches For

Capabilities are shared. **Reach** differs. (Derived from the v2 audits + the Code-Tab architecture.)

### What Sofia reaches for that Max doesn't
- Multi-file editing in **one** session (today: single-file/single-artifact)
- File tree **wired to the editing session** (today: browse-only `/files`)
- Find / replace; find across files
- **Git read-surface**: status, branch, last commit, push state (today: none, despite "push to GitHub")
- Inline syntax diagnostics; bracket/snippet/autocomplete depth
- A **real command palette** (today: ⌘K is a project/chat *navigation* switcher, not a dev palette)
- Multi-cursor (CodeMirror 6 already supports it — unwired)
- Diff between versions / two files
- **Repo import** ("I have existing code")
- Rename / move / folder ops in the explorer

### What Max reaches for that Sofia doesn't
- Plain-language onboarding (✅ already excellent — preserve)
- A mobile-first composer that works on an iPhone keyboard
- "Just publish it" — the Save→Publish *Zwischenraum* (✅ exists — preserve)
- A **visual preview** as the default payoff, not a code editor
- Zero jargon in the surfaces he touches (errors still leak "LiteLLM")
- One-tap actions: Copy URL, share, "build me another"

### What BOTH reach for (the shared spine — never compromise these)
- Reliable streaming AI (BYOK) · persistent cloud files · deploy to Vercel · genuine mobile capability · speed (cold-LCP < 2s) · the draft→Save→Publish gate · multi-session, per-session model

**Conclusion:** the divergence is entirely about *foregrounding*, and it correlates with **project intent**, not user identity. A senior dev building a quick landing page wants Max's calm surface; Max importing a friend's repo would want Sofia's tree. So **bind the default foreground to the project, not the person.**

---

## Section C — Chosen Approach + Justification

**Chosen: Intent-set defaults (project type) × gesture-revealed depth (spatial), on one canvas.** This is the prompt's option **(iv) + (i)**, fused, with **(ii) gesture** as the discovery mechanism — and explicitly **not (iii) persona-asked-once** as the primary lever (we keep a single optional intent question, but it sets *project default*, not a sticky user mode).

### How it works concretely

**1. Intent at creation (one question, sets the foreground — not a mode).**
"Was baust du?" with a few concrete choices, each a *project template* that decides the **default foreground**, not the available power:

| Intent | Default foreground (first paint) | Still one gesture away |
|---|---|---|
| **Landing Page / Website** | Composer + big live Preview; Publish prominent | Editor, tree, git, palette |
| **Web App** | Composer + Editor side-by-side; file tree visible | Preview, git panel, palette |
| **API / Script** | Editor + file tree; run/logs | Preview (collapsed) |
| **Import existing repo** | File tree + editor + **git panel open**; composer docked | Preview |
| **Not sure / just exploring** | Max default: composer + preview | everything |

Same canvas, same capabilities — only what's *foregrounded* changes. Sofia picks "Web App" or "Import repo" and feels at home; Max picks "Landing Page" (or "Not sure") and sees a calm composer.

**2. Gesture reveals depth (the same for everyone, no mode).**
- **⌘K / long-press the title bar** → a *real* command palette (go-to-file, find, git, run, switch model) — replaces today's nav-only ⌘K.
- **Tap the file chip** → tree slides in; **tap a folder** → folder ops appear in context.
- **Select text + a key/long-press** → find/replace.
- **Open 2+ files** → editor quietly becomes multi-file tabs (it already has session tabs — extend the metaphor).
- **A git panel** lives behind a small status pill in the workspace footer; tap to expand. Invisible weight for Max, instant reach for Sofia.

**3. Mobile = the same canvas, single-column, reach via sheets.**
Foreground tool fills the column; depth lives in bottom sheets summoned by the same gestures. Max lives in composer→preview→publish. Sofia *can* summon the tree/git as sheets — power survives the phone, which is the literal differentiator ("Cursor-power from the beach").

### Why this, and not the alternatives

- **Why not a Simple/Advanced toggle?** Rejected by Vincent and by first principles (Section A table). A mode demotivates both personas and misrepresents the product (capabilities are shared).
- **Why not persona-asked-once (iii) as the lever?** Identity is the wrong key. A senior dev often wants the calm surface; a hobbyist importing a repo wants the tree. Intent predicts reach; identity doesn't. We keep *one* optional intent question, but it sets the **project's** default foreground and is changeable per project, not a sticky "you are an Advanced user" flag.
- **Why intent + gesture together?** Intent gets the *first paint* right (so neither persona has to reconfigure before starting); gesture keeps *everything* reachable afterward without a mode. Intent without gesture would trap users in a template; gesture without intent would make Max hunt. Together: right default, infinite reach.

### Mockups (in `sprint-9/convergence/`)
- `landing-max-perspective.html` — project create → Max picks "Landing Page" → calm composer+preview canvas
- `landing-sofia-perspective.html` — same create screen → Sofia picks "Web App / Import repo" → editor+tree+git foreground
- `code-tab-max-default.html` — the one canvas, Max foreground (composer + preview, depth dormant)
- `code-tab-sofia-discovered.html` — the **same** canvas after Sofia's gestures (command palette, tree, git pill expanded, multi-file tabs)
- `mobile-both.html` — single-column canvas; Max column vs. Sofia's summoned sheets, side by side

---

## Section D — Sprint 10 Implementation Slices

Each slice is independently shippable, preserves Max, and adds Sofia reach. Effort = focused dev-hours; risk reflects unknowns.

| # | Slice | Primarily serves | Effort | Risk | Notes |
|---|---|---|---|---|---|
| **1** | **Project intent at creation** → sets default foreground (templates) | Both | 6–10h | Low | The keystone. Pure frontend + a `project.intent` column. Makes the canvas feel built-for-you on first paint. |
| **2** | **Real command palette** (⌘K → go-to-file/find/git/run/model), replacing nav-only ⌘K | Sofia | 8–12h | Med | Reuse the existing ⌘K shell; add a command registry. The single highest-leverage Sofia reach-tool. |
| **3** | **Multi-file editing in one session** (editor tabs for files, not just sessions) | Sofia | 10–16h | Med | Extend `useCodeTabs`; the session-tab metaphor already exists. Unlocks "real codebase" feel. |
| **4** | **Git read-surface** (status/branch/last-push pill → expandable panel) | Sofia | 8–12h | Med | Read-only first (status, branch, ahead/behind). Closes the "push to GitHub" honesty gap (Sofia P0 credibility). |
| **5** | **Find/replace + multi-cursor** (wire CM6 capabilities already present) | Sofia | 4–6h | Low | Cheapest credibility win — CodeMirror 6 supports both; just expose them. |
| **6** | **File-explorer rename/move/folder-ops + session-linked tree** | Both | 8–12h | Med | The Sprint-8 deferred MVP; turns the browse-only explorer into a real one. |
| **7** | **Repo import** (clone existing repo into a Goblin project) | Sofia | 12–20h | High | The "I have existing code" on-ramp. Highest risk (auth, large repos, file-storage scale); schedule last. |

Recommended order: **1 → 5 → 2 → 4 → 3 → 6 → 7** (keystone first, then cheapest credibility, then the high-leverage palette/git, then the heavier multi-file/explorer, then import).

---

## Section E — What Convergence Preserves (do not regress)

Convergence is **additive**. Max's existing experience must be byte-for-byte intact:

- **Send-to-Code from chat** — Max's bridge from idea to artifact.
- **Draft → Save → Publish Zwischenraum** — Max's safety beat (and Sofia's, per her audit — she praised draft-before-accept).
- **Persistent Live URL** — Max's payoff; copyable, survives reopen.
- **Mobile single-column** — Max's actual workplace; no bottom-tab-bar.
- **Plain-language strings** in every surface Max touches; the excellent 5-step onboarding.
- **The calm default** — one accent, sentence case, no cockpit on first paint.

**Acceptance gate for every Convergence slice:** a Max walk (signup → "build me X" → preview → publish → copy URL, on a phone) must complete with the *same* number of taps and *zero* new jargon. If a slice adds a tap or a term to Max's path, it's wrong — push the depth further behind a gesture.

---

## Section F — Open Questions for Vincent

1. **Intent question wording & options.** Proposed set: *Landing Page · Web App · API/Script · Import a repo · Not sure*. Keep all five, or fewer? (Fewer = calmer for Max; more = better defaults for Sofia.)
2. **Is intent changeable per project after creation?** Recommend **yes** (a quiet "switch layout" in the palette), so a project can grow from "landing page" into "web app" without restart.
3. **Git surface scope for Slice 4:** read-only status first (recommended), or read + commit/push in one slice? (Read-only is lower risk and already closes the honesty gap.)
4. **Repo import (Slice 7) for first beta, or defer to milestone 2?** It's the highest-risk slice and not needed for Max at all.
5. **Does the P0 model fix land before Sprint 10 starts?** Convergence is wasted if the default model is still broken — the model fix is the prerequisite to everything here.

---

## Section G — Estimated Sprint 10 Effort

- **Slices 1–6 (the convergence MVP, excluding high-risk import):** ~44–68 focused dev-hours → **roughly a 1.5–2 week sprint** at this project's cadence.
- **Slice 7 (repo import):** +12–20h, **recommend deferring** to a follow-on milestone.
- **Hard prerequisite (not in this estimate):** the P0 prod model fix (founder, ~S). Without it, none of this reaches a user who can succeed.

**Recommendation:** Sprint 10 = Slices **1, 5, 2, 4, 3, 6** in that order, gated on the model P0 landing first. That delivers the full "One Canvas, Progressive Reach" experience for Max *and* Sofia, on web and mobile, without an import dependency — a demonstrable new category, not a microimprovement.
