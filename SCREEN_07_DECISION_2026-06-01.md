# Screen 07 — Decision (Sprint 6, Phase 6.5)

**Decision: FOLD. Do not build a separate Screen 07.**

## Context
Screen 07 was scoped as a "mobile code-review focused mode" — a dedicated mobile
screen for Max to review a diff on his phone. Vincent deferred it: *"07 will ich
den Mockup zuerst nochmals sehen, aber erst sinnvoll wenn der Flow gebaut ist."*

## Why fold
The Code-Tab Re-Imagine (Phase 1, Section F) makes the **whole** Code Tab
mobile-first-class as a single-column render:

- The thread is the mobile home; an AI/Send-to-Code draft turn exposes a prominent
  **Ansehen** that pushes a full-screen review (diff) with a back chevron.
- The review surface (DiffModal, now light + sentence-case German) already works
  full-width and is reachable from the draft state.
- The "no-review" café flow Max wants is the same two taps everywhere: land draft →
  **Sichern**, then a deliberate **Veröffentlichen** — no separate screen needed.

A standalone Screen 07 would duplicate the mobile review that the main Code Tab now
owns. Two surfaces doing one job is exactly the kind of tradition the founder
licensed us to break (Section 1, principle 4).

## What this means
- Max's review-on-mobile journey = open Code Tab → tap the draft's **Ansehen** →
  read the light diff full-screen → **Sichern**, then **Veröffentlichen** when ready.
- Max's no-review journey = land draft → **Sichern & Veröffentlichen**.
- Both are first-class in the one mobile Code Tab. No 07.

## Status of the underlying flow
The Zwischenraum that Screen 07 depended on (explicit Save before Deploy) shipped
this sprint (`b0861bf`). The mobile single-column render of the full thread + work
surface is specified in the architecture doc and is the clearly-staged next build
(the thread/agent system). When that lands, the mobile review is automatically
present — no extra screen.

No code for Screen 07. This document is the deliverable.
