# Sprint 11B v2 — Feature Parity Proof

**Constraint (A):** the redesigned chat + code tab must have EXACTLY as many
capabilities as the current one. Nothing dropped. This table is the proof.

Inventory taken from the real app code (Phase 0):
`components/chat/standalone-chat.tsx`, `components/chat/ChatInput.tsx`
(`ModelHub`, `VoiceButton`, `useChatModel`), `components/chat/ComposerPlusPopover.tsx`,
`components/code/StcPreviewSheet.tsx`, `components/code/CodeActionBar.tsx`,
`components/project/code-tab-classic.tsx`, `hooks/useCodeTab.ts`
(`useCodeFiles/Vercel/GitHub/Tabs/Injections`), `components/code/SessionPane.tsx`,
`app/dashboard/project/[id]/work/page.tsx` (tabs chat/code/preview).

Legend for "Where in v2": **F1**=Handoff frame, **F2**=Logbook, **F3**=Multi-hunk
review (hero), **F4**=Partial-failure, **F5**=Files/Edit/Preview/Publish, **D**=Desktop.

---

## A. Chat capabilities

| # | Current capability | Source | Where in v2 design |
|---|---|---|---|
| 1 | Model picker hub (search, tag filters, sections Your Keys / Free / Goblin Hosted, ACTIVE/KEY/FREE/SOON badges) | `ChatInput.ModelHub` | F1 — composer **model pill** tapped → ModelHub popover rendered (search + Your Keys/Free/Soon + badges). Same on D action bar. |
| 2 | Send message + streaming reply (with model/source-tier meta) | `standalone-chat.handleSubmit` | F1 — composer Send; thread streams. Model+tier shown on the Bau-Goblin node. |
| 3 | Stop streaming (abort, partial kept) | `handleStop` | F1 — Send button swaps to **Stop** square while streaming (shown). |
| 4 | New chat | `handleNewChat` | F1 — thread overflow "**+ Neuer Chat**" (noted on Faden header). |
| 5 | Multi-session per project + project context bar + back-to-project | `chat_sessions`, project bar | F1 — Faden header shows project name + **session switcher** ("Faden 2/3"); back chevron to project. |
| 6 | Empty state with suggestions | `EmptyChat` | F1 — when thread empty, suggestion chips (noted in Faden empty state). |
| 7 | Composer "+" menu: Datei/Foto, Screenshot, Notiz/Chat einfügen, Aus GitHub, Recherche, Websuche toggle | `ComposerPlusPopover` | F1 — composer **"+"** opens the same 6-item popover (rendered). |
| 8 | Voice input (mic, recording state) | `ChatInput.VoiceButton` | F1 — **mic** button in composer (shown). |
| 9 | Attach files (image/pdf/text) | `handleFilesPicked` | F1 — via "+" → Datei/Foto (same path). |
| 10 | Textarea: auto-resize, Enter=send, Shift+Enter=newline, hint | `ChatInput` | F1 — composer textarea + "⇧↵ Zeilenumbruch" hint. |
| 11 | Code action button on assistant code msg: **Send to Code**, Copy code, Download as file | `CodeActionButton` | F1 — assistant code node shows **Code ▾** menu (Send to Code / Copy / Download). |
| 12 | Send-to-Code preview sheet: file list, deselect, target-project picker, overwrite warning, send all/selection | `StcPreviewSheet` | F3 — landing as **review cards**; the per-file select + overwrite "Überschreibt" badge live on the incoming card header. Target-project picker = noted on the sheet. |
| 13 | Error banner (friendly; no-key amber vs red) | `standalone-chat` error block | F1 — inline error pill on thread (amber for key/model, red otherwise). |
| 14 | Seed-on-mount (home composer prompt auto-submits) | seed effect | Mechanical — preserved; first thread node is the seeded prompt (F1). |
| 15 | Model/source-tier label on messages | `Message` meta | F1/F2 — node sublabel "Llama 3.3 70B · frei". |

## B. Code-tab capabilities

| # | Current capability | Source | Where in v2 design |
|---|---|---|---|
| 16 | File tree (desktop) / mobile file sheet / mobile picker | `CodeFileTreePanel`, `CodeMobileFileSheet` | F5 — **files status list**; **pill rail** for quick switch (F3/F5). D — left tree. |
| 17 | Open-file tabs, close tab | `CodeFileTabs`, `useCodeTabs` | F3/F5 — **file pill rail** = open files (active pill); D — file tabs row. |
| 18 | Manual code editor (CodeMirror), edit + save (Ctrl+S), dirty dot, save indicator | `CodeEditor`, `useCodeFiles` | **F5 — tap a file → full editor (escape hatch)**; dirty dot + "Gesichert" indicator shown. D — center editor. |
| 19 | Editor theme toggle (light/dark) | `CodeActionBar`, `useEditorTheme` | F5 editor overflow ⋯ → **Heller/Dunkler Editor**; D action bar **Dunkel** (shown). |
| 20 | Dirty-state file-switch confirm (Sichern/Verwerfen/Abbrechen) | `confirmSwitch` | F5 — noted on the edit sheet (switch-away guard). |
| 21 | Diff apply modal (apply/discard) | `DiffModal` | **Replaced & upgraded → the review-feed diff card** (F3) is the canonical apply/discard, now thumb-native + multi-hunk. |
| 22 | Injected banner: code arrives as DRAFT, apply/undo/dismiss | `InjectedBanner` | F3 — incoming Send-to-Code = a **draft review card**; approve=apply, swipe-left=dismiss, **Rückgängig** toast = undo. |
| 23 | Pending injections panel | `useCodeInjections` | F3 — the review feed itself (stacked pending cards + count "1 von n"). |
| 24 | Change-state spine: Entwurf → Gesichert → Veröffentlicht | Sprint-6 Zwischenraum | F5 — status badges on each file (Entwurf/Gesichert/Live), same three states. |
| 25 | Deploy / Build (Veröffentlichen) + confirm dialog + "your own Vercel" explainer | `useCodeVercel`, confirm modal | F5 — **Veröffentlichen** button + confirm + Vercel "deine Domain" subline. |
| 26 | Vercel: deploying state, deploy toast, active builds, recent done, build status bar, persistent live-URL card, open live | `useCodeVercel`, `BuildStatusBar` | F2 — logbook = build status; F5 — **live-URL card** ("Öffnen ↗") persists; deploy toast. |
| 27 | Push to GitHub (modal) + connect GitHub (modal) | `useCodeGitHub` | F5 — overflow ⋯ → **Push zu GitHub** (+ connect flow); D action bar **Push**. |
| 28 | Undo / Redo (editor) | `undo/redo` (SessionPane) | F5 editor — **↶ ↷** controls in the edit sheet toolbar (shown). |
| 29 | Search in file | `openSearchPanel` | F5 editor — **⌕ Suchen** in edit sheet toolbar; D Cmd+F. |
| 30 | Multi-session work: thread + work surface, parallel sessions, streaming agent, StreamingDiffView, git pill, file nav, draft count | `SessionPane`, `useCodeAgent` | F1 — the **Faden** is the session thread; F3 — StreamingDiffView = the live diff card; **draft count** = feed counter; **git pill** = F5 overflow / D status bar. |
| 31 | Keyboard shortcuts: Cmd+1/2/3 tabs, Esc closes | `useCodeTab` effect | D — noted in status bar ("⌘1/2/3"); preserved mechanically. |
| 32 | File nav panel: browse/open all session files, add new | `SessionFileNav` | F5 — files list **+ Neue Datei**; pill rail "+". |
| 33 | Copy (live URL), deploy debug (?debug=1) | SessionPane | F5 — live-URL card **Kopieren**; debug stays a `?debug=1` power-user affordance (noted). |
| 34 | Tabs: Chat / Code / Vorschau (running page) | `project-workspace` | All frames — **app header tabs Chat · Code · Vorschau**; Vorschau = F5 preview sheet full-screen. |
| 35 | Mobile FABs: quick deploy + push | `code-tab-classic` | Folded into F5 **Veröffentlichen** + overflow ⋯ (no floating FAB clutter — same actions, better placed). |

---

## Net change vs. current

**Nothing removed.** Three things *moved to a better home*:
- The **diff/apply modal (21)** becomes the review-feed card — same job, thumb-native, now multi-hunk (closes GAP 1).
- **Injections (22/23)** stop being a separate banner+panel and become first-class feed cards (one mental model: everything to review is a card).
- **Mobile FABs (35)** fold into the publish bar + overflow (less floating chrome).

**One thing added** that the current tab lacks entirely: a real **partial-failure
state (F4)** — the current tab has no designed answer for "the overnight build
broke." That's GAP 2, now covered.
