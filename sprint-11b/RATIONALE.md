# Sprint 11B v2 — Code Tab, mobile-first. The bet + the gaps.

## The one disruptive idea (unchanged — it held)

**The mobile code tab is not an editor. It is a review feed for an autonomous
builder you can walk away from.**

On a phone you never hand-type code. You **direct** it (a plan), the free model
**builds** it for hours, and you **judge** it (swipe a diff). The phone is
mission control for an overnight build, not a shrunk IDE. v1 proved this lands.
v2 keeps it and closes the three things that separated "good idea" from "build."

Example throughout: **mara-portfolio** — a small personal portfolio (the
newsletter example is gone).

## How v2 resolves the three gaps

### Gap 1 — Hunk vs. file (the hero's unsolved detail)
A real edit usually changes several distinct things in one file. The resolution
is the **middle path, not either extreme**:
- **One file = one card.** No card-flood.
- **Multiple changes = hunks inside that card**, each with its own ✕/✓ and a
  plain label ("1 · Akzentfarbe", "2 · Projekt-Grid"). Drill in when you care.
- **One thumb gesture for the whole file** at the bottom ("Ganze Datei").
Resolving both hunks auto-resolves the card. So the user gets *file-level speed*
by default and *hunk-level precision* on demand — without drowning. Shown with a
real two-hunk styles.css (accent colour + grid), interactive.

### Gap 2 — The error / partial-success state (the hardest, was hidden)
v1 only showed the happy path. v2 designs **the morning after a broken overnight
build** (F4):
- Calm headline ("Fast fertig — eins hakt"), not alarm.
- **What landed / what didn't**: index.html ✓, styles.css ✓, script.js ✗.
- **Why, in plain language**: "Eine Klammer fehlt (Zeile 22)" — no stack trace.
- **Four ways out**: let Goblin fix it (free, it already knows the error), keep
  the good parts, retry, or roll back to last night. "Dein Stand ist sicher."
A mockup that hides its hardest state is hiding its weakest point. Now it leads
with trust.

### Gap 3 — Architect → build as a moment, not a button
v1's handoff was one pill and the two roles looked alike. v2 makes them **feel
different and the handoff feel like something happened**:
- **Architekt**: warm parchment card, Instrument Serif voice, deliberate, gold.
- **bau-goblin**: green terminal card, JetBrains Mono voice, mechanical, fast.
- Between them a **cesura band** ("Plan übergeben — der Plan wechselt die Hände,
  Smart → Frei"). The thesis you can see: smart plans, free builds.

## Parity preserved (constraint A — the most important thing)

Phase 0 inventoried the real current chat + code tab (35 capabilities). Every
one has a home in v2 — see **PARITY.md** for the full old→new table. Headlines:
- **Model picker** (search/tags/Your-Keys/Free/Soon + badges), **Send-to-Code**
  (+ preview/deselect/overwrite/target), **copy/download**, **voice**,
  **attachments**, the **"+" menu**, **save/publish/push**, **multi-session
  history** — all present and rendered.
- **Manual editing stays a real, reachable capability** — the escape hatch: tap
  a file → the real editor (undo/redo, search, theme, auto-save). It's just not
  the headline.
- Nothing dropped. Three things **moved to a better home** (diff/apply modal and
  injections → feed cards; mobile FABs → publish bar + "⋯"). One thing **added**
  that the current tab lacks entirely: the partial-failure state.

## What it still deliberately leaves out

- Hand-typing code as the *primary* mobile surface (the editor is the hatch, not
  the headline).
- A persistent desktop-style file tree on the phone (files = status list + pills).
- The indeterminate spinner (progress is always concrete).

## The other direction, still noted not built

"Phone as a remote control for a desktop session" remains the fallback if user
testing says power users want the live editor as the mobile headline. v2 shows
the editor as a reachable hatch and as the desktop centre — proving the feed and
the editor are one coherent system — without making the phone secondary.

— Second exploration pass. Now it answers the three gaps and proves nothing was lost.
