# MAP — Chat + Coding-Tab area (founder walk)

Date: 2026-06-06 · Branch: master · Scope: chat + coding-tab ONLY.
Live surface = `CodeWorkspace` → `SessionPane`. Every change additive. Publish loop sacred.

---

## 0. Surface routing (who renders what)

- **Project "Chat" tab** → `components/project/ProjectChatSurface.tsx:94` renders the
  **canonical** `StandaloneChat` (`components/chat/standalone-chat.tsx`). Already unified (11A-A).
  Message presentation = `components/chat/Message.tsx`.
- **Coding-tab chat** (the thread INSIDE the Code Tab) → `SessionPane.tsx:212` renders
  `components/code/SessionThread.tsx` — a **DIFFERENT** component with **different** message
  styling. This is the divergence the founder sees.
- Code Tab shell: `CodeWorkspace.tsx` → `SessionPane.tsx` (thread col + work-surface col).

---

## A. Why coding-tab chat ≠ standalone chat

| | Standalone (`Message.tsx`) | Coding-tab (`SessionThread.tsx`) |
|---|---|---|
| Goblin avatar | `<GoblinLogo variant="ink">` (BLACK) — `Message.tsx:51` | gold diamond `Tick()` for done turns; `<GoblinLogo variant="gold">` while streaming — `SessionThread.tsx:20,97` |
| User msg | `.msg-user` bubble (globals.css) | inline "Du" label + text — `SessionThread.tsx:65` |
| AI body | full markdown + `CodeBlock` | prose summary only + file chip "· im Editor ansehen" — `SessionThread.tsx:78-88` |
| thinking | bouncing dots `--ink-3` — `Message.tsx:55` | gold logo + "schreibt …" — `SessionThread.tsx:97` |

**Canonical look = `Message.tsx`.** SessionThread must match the *presentation* (avatar = GREEN
GoblinLogo, user bubble, thinking treatment, fonts/spacing). It must KEEP the file-chip behavior
(code goes to editor/review-card, not inline) — swapping to full `Message` would break the Code-Tab
edit model. So A.1 = presentation parity, not component swap.

## A.2 GoblinLogo BLACK → want GREEN

- `GoblinLogo` colors via `variant` → `VARIANT_COLOR` (`brand/GoblinLogo.tsx:41-47`).
  `green = var(--brand-green) #1A3A2A`. Animations (`design-tokens.css:191-203`) only touch
  transform/opacity, **never color** — so switching variant fixes idle AND thinking/working.
- Live chat logo is BLACK because `Message.tsx:51` (and dead `workspace/ChatMessage.tsx:97`) pass
  `variant="ink"` (`--ink-deep` ≈ black). **Fix = `variant="green"`.**
- SessionThread streaming logo is `variant="gold"` (`SessionThread.tsx:97`) → also align to green.

## A.3 The `</>` coding chip

- Bottom-right chip in the CHAT = `CodeActionButton` (`standalone-chat.tsx:148-169`), pinned
  `right:12 bottom:calc(100%+10px)` (`standalone-chat.tsx:452`). 10.11-C.6 replaced the `</>`
  mono glyph with `<Code2/> + "Code"` label. Founder now wants it back to **just a clean,
  centered `</>` glyph, single line** (no label, no misalignment). → VERIFY live current state.
- Literal `</>` badge also at `RecentSessionsCard.tsx:35` (hub list avatar, `--gold`/`--green`,
  24px). Candidate but it's a hub card, not the chat area — confirm which the founder meant on the walk.

---

## B. Coding-tab chat change → see it + apply it

- Today: `SessionPane.handleSubmit` (`:96`) snapshots the active file as the review base, runs the
  agent, then `maybeOpenReviewCard(text)` (`:115`).
- `maybeOpenReviewCard` opens the **Row 1b review card** (`DiffModal`, `:457`) ONLY when:
  base file content non-empty AND a parsed code block matches `base.path` AND proposed ≠ base.
  → First gen / new file / path-mismatch ⇒ **no card**, user only sees the SessionThread prose +
  "im Editor ansehen" chip. That's the founder's "go hunt in the editor" gap.
- `DiffModal` (`project/diff-modal.tsx`) already: splits hunks (`lib/diff-hunks.ts`), per-hunk
  ✕/✓, whole-file apply, scrollable body, mobile bottom-sheet. Apply path = `detail.editActive`
  (draft write) / subset via `reconstructWithHunks`. **Reuse — do not fork.**
- **B plan:** broaden when the card opens (also new-file / multi-file = surface as review, not just
  a chip), add an **"Anwenden"** action AND keep **"im Editor ansehen"** on the turn.
  Apply lands via the SAME existing draft write path (`detail.editActive` / `persistFile`) → hits the
  EXISTING file, no new file, no build/save/publish rewire.

---

## C. Room for the review (Sofia bug) — VERIFY LIVE before building

- Mobile layout (`SessionPane.tsx:189-208`): ≤860px → flex column + **toggle** thread/editor via
  `mobileView`; after submit → `mobileView="editor"`. Work-surface column order: file bar → editor
  (`flex:1`) → live-URL card → **action bar pinned** (`flexShrink:0`, `:392`) with Sichern /
  GitHub pill / Veröffentlichen.
- The review card (`DiffModal`) on mobile = bottom-sheet `max-height:90vh`, own scroll + pinned
  thumb bar (`diff-modal.tsx:108-110`).
- ⚠️ Founder's bug ("chat top, review bottom squeezed") does NOT obviously map to the current
  toggle layout → **must reproduce on prod (390) before touching C.** Likely the review-card sheet
  vs thread interplay, or a non-toggle path. C fix target: review area gets real height + scrolls,
  and Sichern/GitHub/Veröffentlichen stay pinned/reachable; chat never starves the review.
- SAFETY: additive layout only. If giving room needs build/save/publish rewire → STOP, ship A+B,
  report C as mapped follow-up.

### Noted future option (DO NOT BUILD)
Founder "just an idea": a list of pending coding changes you tap to review/edit. Park for later;
this pass does scroll + pinned-actions only.

---

## Stop conditions live
- C needs loop rewire → ship A+B, report C.
- Apply can't reuse existing write path cleanly → card read-only + "im Editor ansehen", report.
- Test user unconfirmable → read-only + harness, no prod writes.
