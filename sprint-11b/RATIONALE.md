# Sprint 11B — Code Tab, mobile-first. The bet.

## The one disruptive idea

**The mobile code tab is not an editor. It is a review feed for an autonomous
builder you can walk away from.**

Every shrunk-desktop code tab makes the same silent assumption: *the human
types the code.* On a phone that assumption is fatal — tiny carets, pinch-zoom,
no keyboard real estate. So we drop it. On mobile you never write code. You
**direct** it and you **judge** it:

1. You hand a plan from the smart model to the free model (one tap, same thread).
2. The free model builds for minutes or hours — overnight if it has to — and
   you lock your phone.
3. Each change comes back as a **diff card** in a vertical feed. You swipe to
   approve or reject with your thumb. The "file" is the thing being reviewed,
   not edited.

The phone becomes **mission control for an overnight build**, not a cramped IDE.
That is the "wait — you can do THIS from a phone?" moment, and no prettier small
editor can reach it, because the editor is the wrong primitive.

## Why this is the thesis, made physical

Goblin's thesis is: architect with a frontier model, then let a free model code
for hours with no rate-limit anxiety — from your pocket. The review-feed makes
all three layers something you can *feel* in the code tab:

- **Architecture → code as one flow (Dir 2):** the smart-model plan and the
  free-model build live in **one continuous vertical thread**. The handoff is a
  single pill ("An den Bau-Goblin übergeben"), not switch-tab-copy-paste.
- **It builds while you sleep (Dir 1):** the working state is a **logbook, not a
  spinner** — files landing one by one, "läuft seit 14 Min · 0 Rate-Limits", a
  lock-screen-style glance line. Calm enough to put the phone down.
- **Thumb-first diff review (Dir 3, the hero):** "Mach den Hintergrund blau" →
  the exact diff against the real file → swipe ✓/✕. This is the daily
  interaction and the direct answer to the broken edit-in-place.

The free model running unsupervised is the *reason* a feed beats an editor:
there is too much to hand-type and review line-by-line on a 390px screen, so we
batch it into swipeable judgments. Async build and thumb-review aren't two
features — they're the same idea seen at two timescales.

## What it deliberately leaves out

- **Hand-typing code on mobile.** No cramped CodeMirror as the primary surface.
  An escape-hatch tap-to-edit can exist, but it is never the headline.
- **A persistent file tree / desktop chrome on the phone.** Files are a
  glanceable status list and a pill rail, summoned — not a shrunk sidebar.
- **The spinner.** Progress is always concrete (which file, how long, how many
  lines), never an indeterminate wheel.

## The other direction, noted not built

A second viable framing is **"the phone is a remote control for a desktop
session"** — mirror the desktop editor, drive it by voice. We rejected it for
this pass: it inherits the editor primitive we're trying to escape and makes the
phone secondary. The review-feed makes the phone *primary*. If user testing says
power users still want the live editor on mobile, that's the fallback to explore
next — shown here only as the desktop frame's right rail, to prove the feed and
the editor are one coherent system.

— First exploration pass. A conversation starter, not a final answer.
