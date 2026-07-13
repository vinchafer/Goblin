# L2 · F-02 — §03 "Send to Code" shows a stale in-app depiction

## State-first correction of the unit's premise
The unit describes §03 as using "old in-app **screenshots / images**". Repo
reality (Law 10): **§03 uses no image files at all** — `SendToCode.tsx` is a
hand-built CSS/HTML mock (chat panel → arrow → editor panel). There are no
stale image assets to swap. The mock's substantive claims were verified
**current**:
- `Goblin Swift` — a live Goblin-hosted model (`lib/goblin-hosted-models.ts`).
- `Send to Code` — a real, current feature (`components/workspace/CodeBlock.tsx`
  button "An Code senden"; `CodeEmptyState.tsx` describes it by name).
- chat → editor flow — real (`chat-tab.tsx` `goblin:sendToCode` event).

## The one demonstrably-stale detail (fixed)
The editor pane asserted a product state that **no longer exists**: badge
`INJECTED` + comment `// injected via Send to Code`. The product has evolved
from a direct **inject** model to a **draft-review** model:
- `CodeEmptyState.tsx`: Send to Code → "the generated code lands right here —
  **as a draft you can review in your own time**."
- `AgentRunView.tsx` / `DiffSheet.tsx` / `FileCardList.tsx`: sent code appears
  as a **draft** (states `Entwurf` / `NEU` / `GEÄNDERT`), reviewed before ship.

Claiming `INJECTED` is exactly the "old, no-longer-accurate" state, and it
trips the honesty invariant (never assert a product state that isn't real).

Fix (`components/landing/sections/SendToCode.tsx`):
- badge `Injected` → `Draft` (renders gold `DRAFT`, matching the real draft state).
- comment → `// draft from Send to Code — review before you ship` (matches the
  real review-before-publish flow).

No image files added; no other mock content changed (the rest is current).

## Evidence (local build, `next dev`, deviceScaleFactor 2)
- `before-sec03-desktop.png` / `before-sec03-mobile.png` — old `INJECTED` badge + `// injected via Send to Code`.
- `after-sec03-desktop.png` / `after-sec03-mobile.png` — `DRAFT` badge + draft-review comment; mobile wraps cleanly, no overflow.

## Founder actions (optional, if literal product screenshots are wanted)
The current §03 is an accurate stylized illustration, not a screenshot. If you
prefer real captured app screenshots (chat panel + code/draft tab), supply two
images and I will wire optional `<img>` slots into §03 with the mock as
graceful fallback. I could not capture them this session (the chat→draft flow
needs an authenticated prod browser + live backend; the pitch repo is out of
scope). Also note: the in-app button label is German ("An Code senden");
the English marketing name "Send to Code" is confirmed in `CodeEmptyState.tsx`,
so the illustration's English label is correct for the marketing surface.
