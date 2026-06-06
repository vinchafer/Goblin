# Row 1b — Phase 0: the LIVE review/apply moment (SessionPane)

## How a change is presented + applied today (live path)
- User submits a prompt → `SessionPane.handleSubmit` (`SessionPane.tsx:88`) →
  `agent.submit(prompt, model, onDone, detail.activePath)` (`useCodeAgent`).
- While streaming, `liveBlock` (last agent block) renders as a **read-only
  overlay**: if the file already exists → `StreamingDiffView` (original vs
  modified, decorations only); new file → plain `CodeEditor` readOnly
  (`SessionPane.tsx:315-328`).
- On done (`SessionPane.tsx:91-95`): `await detail.refresh()` then `agent.reset()`,
  `setMobileView("editor")`. **The agent's edit is already persisted as a draft
  file** (server PATCH); `refresh()` pulls files where the edited file now has
  `change_state:'draft'` and `content = NEW content`.
- **Review today = look at the draft in the editor.** Draft actions
  (`SessionPane.tsx:272-289`): Kopieren · **Verwerfen** (`detail.discardDraft`)
  · manual edit. Then **Sichern** (`detail.saveSession`) → **Veröffentlichen**
  (`detail.deploySession`). There is **no diff-based accept/reject and no hunk
  granularity** on the live path.

## The real write/apply calls (reuse these — no new path)
- Draft content write: `detail.editActive(content)` (`useCodeSessionDetail.ts:74`)
  → local update + debounced `persistFile` (PATCH `/code-sessions/:id/files`).
- Discard a draft: `detail.discardDraft(path)` (`:139`).
- Save / publish: `saveSession` (`:88`) / `deploySession` (`:100`) — **NOT touched.**

## The blocker (why a naive diff card can't just drop in)
`useCodeSessionDetail` keeps **one** `content` per file. When the agent writes a
draft, the **pre-edit (saved) content is overwritten** in client state by
`refresh()`. There is **no persisted base-vs-proposed pair** to feed `splitHunks`.
The only base is transient — `existing.content` inside the streaming overlay,
before `refresh()`.

## Where the card slots in (safe, additive — no save/publish change)
Capture the base **client-side at generation time** (snapshot the edited file's
content in `handleSubmit`, before `agent.submit` overwrites it). On done, diff
**base → new draft** with `createTwoFilesPatch` (client, `diff` lib), feed it to
the **reused Row-1 `DiffModal` card** + `lib/diff-hunks.ts`. Apply:
- whole-file accept → keep the draft as-is (close; draft already == proposed).
- per-hunk subset → `reconstructWithHunks(base, diff, accepted)` →
  `detail.editActive(content)` (the SAME draft write path).
- discard → `detail.discardDraft(path)` (existing).
Save/publish wiring untouched. The card only changes how a fresh agent edit of an
**existing** file is reviewed, before Sichern.

Scope limits (honest):
- Card shows for an **edit of an existing file** (base non-empty, base≠draft).
  Brand-new files stream as today (no base → no card).
- Base is per-generation + transient: on a cold reopen of a pre-existing draft,
  no base exists → falls back to today's editor review (nothing lost).
- Not touched: `saveSession`, `deploySession`, `persistFile` semantics, the
  thread, streaming.

→ Slottable without touching the build/save/publish loop. Proceed (no Stop
Condition triggered). Per-hunk subset IS supported (editActive accepts any content).
