# Code Tab Re-Imagine — Architecture (2026-06-01, Sprint 6 · Phase 1)

> The Code Tab is one of Goblin's two defining features. Today it is a viewer.
> This document is the plan to make it a workspace: a Claude-Code-terminal in the
> browser — calm, light by default, mobile-capable, with room to think between
> *generate*, *save*, and *ship*. It is meant to be read and approved as-is.

Positioning lock: **Cloud-IDE für Vibe-Coder.** Simpler than Cursor, more
powerful than v0/Lovable, mobile-capable unlike all of them.

---

## Section A — Current State Inventory

### What renders when the Code Tab is selected
`project-workspace.tsx` swaps the whole pane to `<CodeTab>` (tabs are mutually
exclusive — chat, code, preview never coexist on screen). `CodeTab` is driven by
one orchestrator hook, `useCodeTab(projectId, pendingCode)`, composed of five
sub-hooks:

| Hook | Owns |
|---|---|
| `useCodeFiles` | file list, active file, editor content, dirty/save state, token |
| `useCodeVercel` | deploy + build status |
| `useCodeGitHub` | push-to-GitHub modal |
| `useCodeTabs` | open-file tabs (which files are open) |
| `useCodeInjections` | Send-to-Code payload, diff modal, undo |

### The states it has today
- **Empty, no files** — `CodeEmptyState` ("Noch kein Code" → button bounces user
  back to Chat). The Code Tab cannot itself create anything.
- **Empty, has files** — "Wähle eine Datei" prompt.
- **File open** — CodeMirror 6 editor (`code-editor.tsx`), hardcoded dark theme.
- **Injection present** — `InjectedBanner` across the top with four actions:
  *Review & Apply*, *Build*, *Push GitHub*, *Undo*.
- **Deploying** — spinner in the action bar / FAB.

### What the user can actually do today (the problem, enumerated)
Open a file · edit it · save (Cmd-S or autosave) · *Review & Apply* an injection
(opens a read-only `DiffModal`) · *Build* (deploys to Vercel immediately) · *Push
GitHub*. **That is the whole verb set.** There is:
- **no way to place a prompt** — the Code Tab cannot talk to a model at all;
- **no model picker** — the `ModelSwitcher` lives only in the chat header;
- **no notion of parallel sessions** — one project = one flat file buffer;
- **no Save/Deploy separation** — *Build* sits one tap from *Review & Apply* in
  `InjectedBanner.tsx:52-75`. The "Zwischenraum" Vincent asked for does not exist;
- **one hardcoded dark surface** — `code-editor.tsx:20` `EDITOR_BG = '#28251D'`,
  gutters `#08170F`. This is the "extrem dunkel, man kann keinen Code eröffnen".

### Where Send-to-Code persists today
Chat dispatches a `pendingCode` payload into app-context; `CodeTab` reads it as a
prop, shows `InjectedBanner`. *Review & Apply* → `handleDiffApply` → PUT
`/api/projects/:id/files/<path>` (the route the Sprint-5 wildcard fix repaired).
Persistence works. The **UX** around it is the gap: it lands loud, and Deploy is
adjacent, so there is no editing beat between arrival and shipping.

### File tree & editing
File tree exists (`CodeFileTreePanel` desktop, `CodeMobileFileSheet` mobile).
CodeMirror 6 is real and usable for hand-editing — languages js/ts/jsx/tsx, css,
html, json; Cmd-S save; move/copy line. It is just trapped in a dark theme and
behind a "go to chat first" empty state.

**Verdict:** the *foundation* (file I/O, editor, deploy, push, diff persistence)
is sound and stays. The *shell and the verb set* are what we rebuild.

---

## Section B — Reference Research + Goblin's Position

| Tool | Core loop | What we borrow | What we reject |
|---|---|---|---|
| **Claude Code** (terminal) | prompt → plan → diff → approve, multi-file | the *thread*: a vertical log where prompts and results stack; explicit approve | terminal density; keyboard-only; desktop-only |
| **Cursor / Cline** | chat pane beside editor, accept/reject diffs inline | side-by-side *thread + working surface*; per-hunk accept | feature sprawl; assumes a developer |
| **StackBlitz / CodeSandbox** | file tree + editor + terminal + preview | in-browser editor + preview already; light themes exist | four-panel cockpit is too much for a vibe-coder on a phone |
| **Replit** | AI help split from code | "Agent builds, you can dive in" framing | heavyweight; intimidating empty state |
| **v0 / Lovable / Bolt** | chat-to-code with live preview | the *calm* generate→preview loop; non-developer audience | no real editing; no explicit ship control; no parallel work |
| **Linear** | command palette, split panes, restraint | sentence-case calm; one accent; fast switch | — |

**Goblin's position.** Every competitor forces a choice: *chat-only and you can't
touch the code* (v0/Lovable) **or** *full IDE and you'd better be a developer*
(Cursor/StackBlitz). Goblin's wedge is the **middle, on a phone**: a thread you
can talk to like chat, that produces code you *may* edit but don't *have* to, with
a deliberate, legible path from draft → saved → shipped. Max reviews on his iPhone
if he wants to; if he doesn't, he taps Ship. Both are first-class.

---

## Section C — Chosen Mental Model + Why

**Decision: Option (iv), Hybrid — parallel Sessions as top-level tabs, each
session a chat-thread paired with a work surface.** Committed, not hedged.

### The model in one sentence
> A **Session** is a thread you talk to (prompts + AI turns + actions, scrolling
> vertically like chat) bound to a **work surface** (the editor / diff / preview
> for the file in play). A project holds several sessions in parallel, switched by
> tabs at the top.

### Why this and not the others
- **(i) sessions-as-tabs only** — gives parallelism but each tab is still a passive
  editor; doesn't deliver "place a prompt".
- **(ii) sessions-as-files (VSCode)** — convention-bound, developer-shaped, exactly
  the tradition Vincent licensed us to break, and weak on mobile.
- **(iii) pure chat-thread** — matches "a chat and a terminal in one" best but loses
  parallel work and makes hand-editing a second-class citizen.
- **(iv) hybrid** — is literally Vincent's words: *"ein Chat-Fenster … und ein
  Claude-Code-Terminal … alles in einem"*, **plus** "neue Tabs aufmachen". It is
  the only model that satisfies place-a-prompt, parallel sessions, hand-editing,
  and a clean Save/Deploy beat at once. The cost is more layout logic; the design
  below tames it by collapsing gracefully to a single column on mobile.

### Desktop skeleton (1280×860)
```
┌──────────────────────────────────────────────────────────────────────┐
│  ◇ Landing page   ·   Pricing fix   ·   + Neue Session     ⌘K  ☾ light │  ← session tabs + theme
├───────────────────────────────┬──────────────────────────────────────┤
│  THREAD (talk + history)      │  WORK SURFACE (the file in play)      │
│                               │  ┌─ index.html ───────── ● Entwurf ─┐ │
│  ◇ You                        │  │                                   │ │
│  „Mach einen Hero mit …"      │  │   <!DOCTYPE html> …               │ │
│                               │  │   (CodeMirror — light)            │ │
│  ⬡ Goblin · gemini-flash      │  │                                   │ │
│  hat index.html erstellt →    │  │                                   │ │
│  [ Im Editor ansehen ]        │  └───────────────────────────────────┘ │
│                               │  Entwurf · zuletzt 14:02              │
│  ◇ You …                      │  [ Sichern ]      [ Vorschau ]        │
│                               │                                       │
│ ┌───────────────────────────┐ │   ── nichts zu shippen bis gesichert ─│
│ │ Sag Goblin was zu tun …   │ │                                       │
│ │ gemini-flash ▾      ↑ Senden│ │   [ Veröffentlichen → ] (aktiv nach  │
│ └───────────────────────────┘ │                          Sichern)     │
└───────────────────────────────┴──────────────────────────────────────┘
```
Left rail = the **thread** (prompt composer pinned at its bottom, like the chat
composer). Right = the **work surface**: editor, with a status line (Entwurf /
Gesichert / Veröffentlicht) and the two-step *Sichern* → *Veröffentlichen* actions
visually separated by a hairline + a calm prose note. The file tree is reachable
from a left-edge button (`Dateien`), opening as a slide-over so it never competes
with the thread for the default view.

### Mobile skeleton (390×844)
Single column. The **thread is the screen**. The work surface is a *push*: tapping
"Im Editor ansehen" or a file slides the editor in full-width; a back chevron
returns to the thread. Sessions collapse from tabs into a top **session chip** that
opens a sheet ("Sessions" + "Neue Session"). Composer pinned above the keyboard
(never the very bottom edge — founder-rejected zone). Save/Deploy live in the
editor's bottom action row and in a "⋯" action sheet, thumb-reachable.

This is one model with two renders, not two designs.

---

## Section D — Interaction Patterns

The state machine every code change moves through — this is the spine of the whole
rebuild:

```
   (prompt / Send-to-Code)            Sichern              Veröffentlichen
  ────────────────────────►  ENTWURF ──────────►  GESICHERT ──────────►  VERÖFFENTLICHT
                              (draft)   ▲          (saved)                (live URL)
                                        │ edit by hand (stays Entwurf)
                                        └────────── verwerfen ──────────► (gone)
```

- **ENTWURF (Draft)** — code exists in the session but is *not* written to file
  storage. Fully editable. Badge: hollow gold dot + "Entwurf". This is the
  Zwischenraum.
- **GESICHERT (Saved)** — written to storage via PUT `/files/<path>`. Badge: filled
  green check + "Gesichert · 14:02". *Veröffentlichen* unlocks only here.
- **VERÖFFENTLICHT (Deployed)** — pushed to Vercel. Badge: gold + live URL chip with
  copy.

### Verb table

| Verb | Trigger | During | Success | Error | Mobile |
|---|---|---|---|---|---|
| **Place a prompt** | composer at thread bottom, ⏎ / ↑Senden | composer locks, `GoblinLogo state=thinking` turn appears | AI turn streams below | red inline turn "Modell hat nicht geantwortet — nochmal?" | same composer above keyboard |
| **Generate code** | (after prompt) | streaming text → when a code block closes, a "hat `file` erstellt" turn with **Im Editor ansehen** | work surface shows file in **Entwurf** | partial code kept as draft, banner "unvollständig" | tapping the turn pushes editor |
| **Review diff** | "Änderungen ansehen" on an AI turn that edits an existing file | — | split/inline diff in work surface, per-hunk visible | — | full-screen diff, swipe back |
| **Edit by hand** | click into editor | live | dirty dot; stays Entwurf | — | editor push; sticky Sichern bar |
| **Sichern (Save)** | `Sichern` button / Cmd-S | button → "Sichere…" | "Gesichert · hh:mm", Veröffentlichen unlocks | toast "Konnte nicht sichern — erneut?" | bottom action bar |
| **Run / Build** | `Vorschau bauen` | build status bar | preview refreshes / errors inline | error list in thread as a Goblin turn | action sheet |
| **Preview** | `Vorschau` | iframe | live iframe (existing PreviewTab) | "Build nötig" hint | full-screen preview push |
| **Veröffentlichen (Deploy)** | `Veröffentlichen →` (only enabled when Gesichert) | **confirm dialog** → "Veröffentliche…" | success: live URL chip + copy + "In neuem Tab öffnen" | dialog stays, error line | confirm sheet |
| **Neue Session** | `+ Neue Session` tab / session sheet | — | empty session, composer focused | — | "Neue Session" in session sheet |
| **Switch model** | model chip in composer (reuses `ModelSwitcher`) | dropdown | per-session model persisted | — | chip opens sheet |
| **Rename / add / delete file** | file slide-over context actions (exists) | — | tree updates | toast | file sheet |

### Send-to-Code from Chat — the end-to-end journey (locked)
1. User in **Chat** sends a prompt; Goblin returns a code block.
2. The code block shows two **equal-weight** buttons (Phase 3): *Kopieren* (ghost)
   and *An Code senden* (secondary). Same size, hierarchy by variant not scale.
3. Tap *An Code senden*:
   - **0 sessions open** → create a new session, land the code as **Entwurf**, switch
     to Code Tab focused on the work surface.
   - **1 session open** → drop into that session as a new **Entwurf** turn ("aus dem
     Chat übernommen") — no modal.
   - **2+ sessions open** → `CodeSessionPicker` sheet: "In welche Session?" listing
     open sessions + "Neue Session". (Phase 3.3)
4. The code lands as **Entwurf** with a Review affordance: edit inline, then three
   actions — **Verwerfen** · **Kopieren** · **Übernehmen (sichern)**. *Übernehmen*
   moves it to **Gesichert**. Deploy is a separate, later, explicit step.
5. **Mobile**: *An Code senden* switches to the Code Tab and lands the user directly
   on the draft work surface, back-chevron returns to the thread.

The single behavioral promise: **nothing reaches Vercel without a deliberate
Sichern then a deliberate Veröffentlichen.** No auto-deploy. Ever.

---

## Section E — Visual Identity + Tokens to Add

LOCKED anchors stay: brand-green `#1A3A2A`, ink-deep `#0F2B1E`, gold `#D4A737`,
bone `#F4ECD8`, paper `#FBF7EC`. The Code Tab earns **new proposed surface + syntax
tokens** (documented for v1.2 in `CODETAB_PROPOSED_TOKENS_2026-06-01.md`).

### Light editor surface (the new default)
- Editor canvas: **`--surface-1` `#FBF7EC`** (paper) — not pure white; warm, calm.
- Gutter / chrome: **`--surface-2` `#F4ECD8`** (bone).
- Active line: `rgba(26,58,42,0.04)` (brand-green @ 4%).
- Selection: `rgba(212,167,55,0.20)` (gold @ 20%) — keeps Goblin's gold echo.
- Rules: `--rule` `#D8CBA8`.

### Syntax palette — "Goblin Light" (base: Atom One Light, retuned to anchors)
Calm, AA-legible on paper. Gold and green used only where they read naturally;
strings get a muted ochre so gold stays the *accent*, not a syntax color spammed
everywhere.

| Token | Hex | Role |
|---|---|---|
| keyword | `#2A523E` green-600 | `const`, `function`, tags |
| string | `#9A6B1E` ochre (gold-800-ish, darkened for AA) | string literals |
| number / constant | `#355B7A` info | numbers, booleans |
| comment | `#8A8268` warm-grey (≥4.5:1 on paper) | comments, italic |
| function / attr | `#355B7A` info-deep | function names, attrs |
| variable / text | `#0F2B1E` ink-deep | identifiers, base text |
| punctuation | `#5F5640` ink-3 | brackets, operators |
| tag-bracket | `#5E4514` gold-900 | `<` `>` |
| invalid | `#B0432A` danger | errors |

### Dark option — retuned (NOT the old "extrem dunkel")
Keep a dark choice but warm it: canvas **`--surface-ink-1` `#3F3A2C`** (warm-dark)
instead of `#28251D`/`#08170F`. Gutters `#28251D`. Syntax = light-on-warm-dark
variant (keywords `--green-300` `#87A998`, strings `--gold-300` `#E8C97F`, comments
`--ink-on-dark-3` `#968768`). Result reads "dim", not "black hole".

### The Goblin twist (what makes this not a generic editor)
- **Eyebrow tick** — the gold rotated-square ◇ before session names and the
  thread's "Goblin" turns, the same mark used app-wide.
- **Ambient build state** — `GoblinLogo state="working"` breathes in the work-surface
  status line while a build runs; not a generic spinner.
- **Prose empty states**, sentence-case, no SHOUTING LABELS:
  > *„Noch nichts hier. Stell oben eine Aufgabe — oder öffne eine Datei aus dem
  > Projekt."*
- **State words in German, calm**: Entwurf / Gesichert / Veröffentlicht — not
  DRAFT/SAVED/DEPLOYED in caps.
- **One accent rule honoured**: gold is the single accent; green carries primary
  actions; nothing competes.

---

## Section F — Mobile-First Design (390×844)

Mobile is not a port; it is the same model rendered as one column.

- **Thread = home.** Open the Code Tab on a phone → you see the session thread with
  the composer pinned above the keyboard. This is the calm default; you talk to it.
- **Work surface = push.** Tap an AI turn's *Im Editor ansehen*, a file, or a diff →
  the editor/diff slides in full-width. A back chevron (top-left) returns to thread.
  No split panes on mobile — ever.
- **Sessions = chip → sheet.** A single session chip top-center ("◇ Landing page ▾").
  Tap → bottom sheet lists sessions + "Neue Session". (Founder-rejected bottom-tab
  *bar* is not used; this is a single chip opening a sheet, not a persistent bar.)
- **Composer ergonomics.** Sits directly above the keyboard, full-width, model chip
  inline-left, send ↑ inline-right. Never flush to the screen's bottom edge.
- **Save / Deploy reach.** In the editor push, a sticky bottom action row: *Sichern*
  (primary when dirty) and a "⋯" that opens *Vorschau / Veröffentlichen / Verwerfen*.
  Thumb-reachable, no gymnastics.
- **Review on mobile** (Max's café flow): an AI/Send-to-Code draft turn has a
  prominent *Ansehen* (full-screen diff) and, for the no-review flow, a single
  *Sichern & Veröffentlichen* shortcut in the "⋯" sheet — the deliberate path
  collapsed to two taps for someone who trusts the output.

This directly answers Vincent: *"so konstruiert, dass ich es auch vom Mobil aus
sehr zufriedenstellend bedienen kann."*

---

## Section G — Migration Plan

Be willing to delete. Name what survives.

### Survives (the working foundation — reused, lightly adapted)
- `useCodeFiles` (file I/O, dirty/save) — **keep**, it's the persistence core.
- `useCodeVercel` (deploy/build status) — **keep**, rewire trigger to the explicit
  Veröffentlichen step + confirm dialog.
- `useCodeGitHub` + push modal — **keep**, demote to a secondary action.
- `code-editor.tsx` (CodeMirror) — **keep the engine**, replace the single hardcoded
  `goblinTheme` with two themes (`goblinLight` default, `goblinDark`) selected by
  setting.
- `PreviewTab` — **keep**.
- API `/files/*` routes (Sprint-5 fix) — **keep untouched**.

### Refactored
- `useCodeTab` orchestrator → grows a session dimension (`useCodeSession(s)`), a
  prompt/generation hook (`useCodeAgent`), and a per-change state machine
  (Entwurf/Gesichert/Veröffentlicht).
- `useCodeInjections` → folds into the Send-to-Code-lands-as-Entwurf flow rather
  than a top banner.

### Deleted / replaced
- `InjectedBanner.tsx` — **delete**. The loud top banner with adjacent Build is the
  exact anti-pattern we're removing. Replaced by an in-thread "aus dem Chat
  übernommen" Entwurf turn + the work-surface state line.
- `CodeActionBar.tsx` — **replace** with the work-surface status line + separated
  Sichern/Veröffentlichen controls.
- `CodeEmptyState.tsx` "go to chat" button — **replace** with a prose empty state
  that invites a prompt *in place* (the Code Tab can now generate).
- The dark-only editor default — **gone**; light is default.

### New code
- `CodeWorkspace` shell (session tabs + theme toggle).
- `CodeThread` (turns + composer) and `CodeComposer` (reuses `ModelSwitcher`).
- `CodeWorkSurface` (editor/diff/preview + state line + Sichern/Veröffentlichen).
- `useCodeAgent` (prompt → stream → draft), `useCodeSessions` (+ backend
  `/code-sessions`), `useChangeState` (Entwurf/Gesichert/Veröffentlicht).
- `CodeSessionPicker`, `DeployConfirmDialog`, `goblinLight` + `goblinDark` CM themes.

---

## Section H — HTML Mockup Index

All in `sprint-6/code-tab/`, real inline CSS + v1.1 tokens, openable in Chrome.
Screenshots saved alongside as `*.png`.

| File | Shows |
|---|---|
| `desktop-empty.html` | Code Tab, no session — prose empty state inviting a prompt |
| `desktop-with-session.html` | thread + work surface, a file in **Entwurf**, Sichern/Veröffentlichen separated |
| `desktop-multi-session.html` | two parallel session tabs, **Gesichert** + live-URL state |
| `mobile-empty.html` | 390×844 single-column empty + composer above keyboard |
| `mobile-with-session.html` | 390×844 thread home with a Send-to-Code draft turn |
| `dark-option.html` | the retuned warm-dark editor (not the old black) |

---

## Section I — Phase 2 Implementation Effort

| Slice | Scope | Est |
|---|---|---|
| 1 | Light editor surface (`goblinLight` CM theme) + new layout shell + prose empty state + Settings dark toggle wiring | 1.5h |
| 2 | Sessions: `/code-sessions` API (GET/POST/PATCH/DELETE) + `useCodeSessions` + tab/chip UI | 2.5h |
| 3 | In-tab composer + `useCodeAgent` (prompt → stream → draft) + per-session `ModelSwitcher` | 2.5h |
| 4 | Change state machine (Entwurf/Gesichert/Veröffentlicht) + explicit Sichern; Deploy gated on Saved | 1.5h |
| 5 | Hand-edit wiring + Run/Build + Preview into work surface | 1h |
| 6 | Veröffentlichen as separate step + confirm dialog + live-URL success | 1h |
| 7 | Send-to-Code lands-as-Entwurf flow + session routing | 1.5h |
| 8 | Mobile single-column / push / composer ergonomics | 2h |
| 9 | Dark-mode option in Settings → Erscheinung, persisted | 1h |
| **Total** | | **~14.5h** |

Realistic given the foundation survives. If budget tightens, Slices 1–4 + 7 are the
spine (the Zwischenraum + place-a-prompt); 8–9 are polish that can compress.

---

## Section J — Open Questions for Founder

None block the build — decisions taken under autonomy authority (§13). For later
review, not blocking:
- **State words** German (Entwurf/Gesichert/Veröffentlicht) chosen over English.
  If you prefer English, one-word swap.
- **Dark default for power users** — we ship light default + a Settings toggle. We
  do *not* auto-detect OS dark (would surprise the calm-light intent). Flag if you
  want OS-follow.
- **Proposed syntax/surface tokens** await your nod for v1.2 inclusion
  (`CODETAB_PROPOSED_TOKENS_2026-06-01.md`).
