# Goblin Code Tab — Improvement Plan

**Assessment only. No code changed. No new component. No deploy.**
Governing principle: **improve the existing, wired tab in place — never build a
new tab beside it and integrate.** The 35 capabilities in `sprint-11b/PARITY.md`
already work; they are the valuable part. We re-skin and re-arrange the surface
around the functionality that already works — we do not re-wire the functionality
around a new surface.

Grounded in: the real code (`components/project/code-tab-classic.tsx`,
`hooks/useCodeTab.ts` + `useCodeFiles/Vercel/GitHub/Tabs/Injections`,
`components/code/SessionPane.tsx`, `CodeActionBar.tsx`, `StcPreviewSheet.tsx`,
`diff-modal.tsx`, `InjectedBanner.tsx`, `build/build-status-bar.tsx`,
`CodeMobileFileSheet.tsx`, the CodeMirror `code-editor` wiring) **and a live look
at prod** (`justgoblin.com`, logged in, a real project's Code tab at a 390 × 844
mobile viewport — screenshots in this folder: `_live-code-390.png`,
`_live-tabmenu-390.png`, `_live-editor-390.png`).

The mockups (`sprint-11b/code-tab-mockup.html` v2 + `RATIONALE.md`) are the
**idea source** for "better Y", not a blueprint for a new tab.

---

## PART A — Honest current state

### What the code tab IS today (real structure)
The Code tab is wrapped in `.gb-codetab`. For a project with a live agent
session it renders **`SessionPane`** (multi-session: a talk **thread** +
a **work surface**/CodeMirror); the simpler **`code-tab-classic`** (single
buffer: action bar → file tabs → tree/editor → FABs) is the graceful fallback.
Surrounding it: workspace tabs **Chat / Code / Vorschau**, the `CodeActionBar`
(theme toggle · Push GitHub · Build), `BuildStatusBar`, the `DiffModal` (apply
surface), `InjectedBanner` (chat→code "Aus dem Chat" draft), `StcPreviewSheet`
(Send-to-Code preview), and the deploy/Vercel + GitHub modals.

### How it actually behaves on MOBILE at 390px (the live look — concrete)
- **The Code tab opens to the chat thread, not to code.** What fills the screen
  is the session **thread**: an `InjectedBanner` ("Aus dem Chat · Entwurf"), a
  "Verlauf einblenden (1)" toggle, assistant messages, and a composer. Code is
  the *subject of a conversation*, not the foreground object.
- **Changes are communicated as PROSE + chips, not as a diff.** The assistant
  writes a paragraph ("Um den Hintergrund grün zu machen, müssen wir die
  CSS-Eigenschaft `background-color` im Body ändern…") followed by file chips
  "`styles.css` · im Editor ansehen". To actually *see* the change you tap a chip
  and switch to the editor. The reviewable diff lives in **`DiffModal`** — a
  **centred modal, `maxWidth: 800`**, mono, `+N −N`, Sichern/Verwerfen. On a
  390px phone that is a desktop dialog squeezed into the viewport: it reads as
  shrunk desktop, and it is all-or-nothing per file (no hunk-level choice).
- **The editor is a second-class, behind-a-tap surface.** CodeMirror is mounted
  but backgrounded; you reach it via "im Editor ansehen" (a `mobileView` toggle
  in `SessionPane`). Manual edit works — it's just not where you land, and the
  thread↔editor toggle is a weak, easy-to-miss affordance.
- **The three tabs collapse into a header "Code ▾" dropdown** (Chat / Code /
  Preview). Functional, but it hides where you are and costs a tap to move.
- **File navigation is thin on the phone.** `code-tab-classic` falls back to a
  native `<select>` of paths and a 280px `CodeMobileFileSheet` drawer (a desktop
  `FileTree` in a slide-over). No glanceable status list (Entwurf/Gesichert/Live)
  — you can't see at a glance what changed or what's a draft.
- **Build/deploy is a progress bar, not a story.** `BuildStatusBar` shows a thin
  bar (indeterminate shimmer at 0%), a `%`, then "✓ Done" / "✗ Failed" for 30s;
  `useCodeVercel` adds a deploy toast. There is **no concrete "what's
  happening"** (which file, how long) and **no calm long-running state**.
- **Failure is a dead end.** A failed build renders "**✗ Failed**" with **no
  recovery action** — no retry, no "keep the good parts", no plain-language
  reason, no rollback. This is the single most-missing state on the phone today.
- **Mobile action chrome is floating FABs.** `code-tab-classic` puts deploy +
  push on fixed circular FABs (bottom-right) and a tree-toggle FAB
  (bottom-left) — floating chrome that competes with the composer and the iOS
  home gesture.

### The current handoff (architect → build) in the thread
Both the planning turn and the building turn are **the same message style** in
the thread. There is no visible "the plan was handed to the free model" moment —
the thesis (smart plans → free builds) is invisible in the surface.

**Summary of where it hurts on mobile:** the diff review (cramped 800px modal,
all-or-nothing), the absent failure state, the thin file presentation, the
spinner-not-logbook build state, the behind-a-tap editor, and the invisible
handoff.

---

## PART B — Prioritized improvement list

Each row touches **real wired code** (named) and is phrased "existing X → Y".
Order is **my recommendation** (thesis-independent, high-value, low-risk first).
**Final order is the founder's call.**

| # | Existing component (file) | What it is today | What it becomes (mockup ref) | improve / ADD | effort | indep. shippable & phone-testable? | leans on overnight-build thesis? |
|---|---|---|---|---|---|---|---|
| 1 | **`DiffModal`** (`components/project/diff-modal.tsx`, wired via `useCodeInjections.diffData`) | Centred 800px modal, mono `+/−`, all-or-nothing Sichern/Verwerfen | **Multi-hunk thumb review card**: file = one card, changes = hunks inside, per-hunk ✕/✓ or whole-file thumb (v2 **F3**) | improve | M | **Yes** | **No** — thesis-independent |
| 2 | Mobile file presentation — `<select>` + `CodeMobileFileSheet` + `CodeFileTabs` (`code-tab-classic`, `components/code/*`) | Native dropdown + 280px tree drawer + open-file tabs | **Glanceable status list** (Entwurf/Gesichert/Live) + **pill rail** for open files + "+" (v2 **F5/F3**) | improve | S/M | **Yes** | **No** |
| 3 | **`InjectedBanner`** (`components/project/InjectedBanner.tsx`) | Top banner "Aus dem Chat · Entwurf · Ansehen & Sichern / Rückgängig" | **Draft review card in the feed** (same arrival, one mental model: things to review are cards) (v2 **F3**) | improve | S | **Yes** | **No** |
| 4 | Mobile action chrome — fixed FABs + tree-toggle FAB (`code-tab-classic`) | Floating circular deploy/push/tree FABs | **Publish bar + "⋯" overflow** (Push/theme/new file), no floating clutter (v2 **F5**) | improve | S/M | **Yes** | **No** |
| 5 | **(none today)** — `BuildStatusBar` only renders "✗ Failed" | A failed build is a dead end, no recovery | **Partial-failure state**: what landed/didn't, plain-language reason, 4 exits (fix / keep-good / retry / rollback) (v2 **F4**) | **ADD** | M | **Yes** | **Mostly no** — short builds fail too |
| 6 | CodeMirror escape-hatch + `mobileView` toggle (`SessionPane`, `code-editor`) | Editor backgrounded behind weak "im Editor ansehen" toggle; toolbar (undo/redo/search/theme) not surfaced on mobile | **Clear edit entry/return + surfaced toolbar** (↶↷ ⌕ theme, auto-save), still the hatch not the headline (v2 **F5**) | improve | S/M | **Yes** | **No** |
| 7 | Composer (`SessionPromptInput` / `ChatInput` model pill + "+" + voice) | Already strong; minor mobile spacing/thumb-reach polish | **Same composer, tidied for 390** — keep all of #1/#7/#8 capabilities (v2 **F1**) | improve | S | **Yes** | **No** |
| 8 | Build/loading state — `useCodeVercel` + `BuildStatusBar` | Thin progress bar + `%` + toast; no concrete story | **"Logbook, not spinner"**: which file, elapsed, lines, calm "still working" (v2 **F2**) | improve | M | Yes (phone-testable) | **Yes** — leans on long/overnight builds |
| 9 | Handoff in the session thread (`SessionThread`, `SessionPane`) | Architect turn and build turn look identical | **Cesura moment** + distinct layer styling (smart=serif/warm, build=mono/green) (v2 **F1**) | improve | S | Yes (phone-testable) | **Yes** — expresses the thesis |

**Why this order:** rows 1–6 pay off **regardless** of whether the
overnight-autonomous-build thesis proves out — they fix the diff review, the file
list, the arrival, the chrome, the dead-end failure, and the editor entry, all on
the phone today, on already-wired code. Rows 7 polish, 8–9 are the
thesis-expressing flourishes — valuable, but spend them once the
thesis-independent wins are banked. Start with **#1**: it's the daily
interaction, the most cramped surface on the phone, and pure re-skin of an
already-wired apply path.

---

## PART C — The one honest risk

**The mockup's diffs are tidy; real model diffs are not — and nobody currently
produces the plain-language hunk labels the new review depends on.** v2 F3 shows
one file with two clean, well-named hunks ("1 · Akzentfarbe", "2 · Projekt-Grid").
Reality: a free model editing a file often emits one large rewrite, or many tiny
scattered hunks, or a full-file replacement — and the current pipeline
(`useCodeInjections` → `diff` patch → `DiffModal`) has **no source for those
human labels**; it only has raw `+/−` lines. So the headline improvement (#1)
has a hidden dependency: either (a) we derive hunks mechanically from the patch
and label them generically ("Änderung 1, Z. 4"), which is honest but less
magical, or (b) we ask the model to emit labelled, scoped edits (a prompt/format
change touching the agent path, not just the UI) — more magical but more work and
its own failure modes (the model mislabels or over-splits). **Decide that
before building #1**, because it determines whether #1 is a pure UI re-skin (S/M)
or also an agent-output change (L). The mockup quietly assumes (b); the safe
first ship is (a), upgrading to (b) later.

---

*Plan ends here. No row is started. The founder reviews and picks the order; the
next pass takes one row and improves it in place, ships it, and is felt on the
phone before the next.*
