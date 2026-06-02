# Sprint 10 — COMPLETE

**The Convergence is built.** All 6 planned slices shipped as atomic, independently
revertable commits. One Canvas, Progressive Reach — intent sets the foreground,
gesture reveals depth, no modes.

> **Verdict: COMPLETE (build-level), prod-verification PENDING founder deploy.**
> All code typechecks and the web app builds clean. Live end-to-end verification of
> the API/DB-bound features could not happen in this environment (see "The hard
> constraint" below) and is the founder's first step on prod.

---

## 1. Headline

| # | Slice | Status | Commit | Verified |
|---|---|---|---|---|
| 1 | Project Intent + intent-driven foreground | ✅ Shipped | `cb60ca9` | UI live ✓ |
| 5 | Find/Replace + Multi-cursor | ✅ Shipped | `ce6842b` | typecheck ✓ |
| 2 | Real Command Palette | ✅ Shipped | `078bca2` | UI live ✓ |
| 4 | Git Surface (READ + WRITE, honest) | ✅ Shipped | `a93aecb` | typecheck ✓ |
| 3 | Multi-file editing in one session | ✅ Shipped | `738c2a4` | typecheck ✓ |
| 6 | Explorer rename/move/folder-ops | ✅ Shipped | `e2aa57a` | UI live ✓ |

Order built: 1 → 5 → 2 → 4 → 3 → 6 (founder-confirmed).
Production build: **PASS**. Typecheck (web + api + shared): **PASS**.

---

## 2. The hard constraint (why "verified" splits two ways)

Local dev (`localhost:3000`) talks to the **prod Railway API** → **prod Supabase**
(`apps/web/.env.local`). Browser client calls from localhost are **CORS-limited** to
that prod API (the dashboard's "Keine Verbindung zum Server" confirms it; the Code-Tab
sessions probe also fails → it falls back to the classic editor). And the new code is
**not deployed** (no push). So:

- **Pure-UI features** (render without an API round-trip) were **verified live on
  localhost** — intent cards, layout switcher, command palette, explorer header/prompts.
- **API/DB-bound features** (intent persistence, AI streaming into the editor, git
  ops, multi-file in the live workspace, file-row ops) **cannot be E2E-verified here**.
  They typecheck + build and were written defensively. They verify on prod after the
  founder pushes + deploys.

Every feature degrades gracefully pre-migration (best-effort writes, localStorage
hints) so nothing breaks before the founder applies the schema.

---

## 3. Per-slice detail

### Slice 1 — Project Intent (keystone) · `cb60ca9`
- Migration `0057_project_intent.sql` (idempotent column + CHECK + backfill; founder applies).
- API: optional `intent` on create (persisted via best-effort UPDATE → no-ops pre-migration); `PATCH /projects/:id` (soft-fails pre-migration); `GET /:id` already returns it.
- `lib/intent.ts`: single source — 4 intents, layout presets (thread width % + mobile column + tree flag), localStorage hint helpers.
- Create modal: 4 intent cards **inside** the blank form (not a separate step → Max's tap count unchanged), default `exploring`, sends intent + stashes localStorage.
- `ProjectIntentControl`: quiet "Layout wechseln" on the project hub.
- `CodeWorkspace → SessionPane`: intent → first-paint thread-column width + mobile default column. No mode; the user can still rearrange.
- **Verified live:** create-modal 4 cards (Phosphor icons, "BALD" badge on import, default exploring, selection toggles `aria-pressed`); hub "Layout: Nicht sicher" pill; switcher dialog with the no-modes copy. Screenshots in `sprint-10/slice-1-intent/`.

### Slice 5 — Find/Replace + Multi-cursor · `ce6842b`
- Added `@codemirror/search` as a direct dep (was transitive-only → not importable under pnpm).
- `search({ top: true })` panel + explicit `searchKeymap`.
- **Real fix:** `Ctrl+D` was bound to `copyLineDown`, shadowing searchKeymap's `selectNextOccurrence` — multi-cursor select-next was dead. Freed Ctrl+D (VS Code parity); moved copyLineDown → `Shift+Alt+Down`.
- Search button in SessionPane (mobile + discoverability) + multi-cursor hint in its title.
- **Not live-verifiable locally:** the editor needs a file open, which needs the API. Capability is stock CM6 + the conflict fix.

### Slice 2 — Real Command Palette · `078bca2`
- Extended the **existing** ⌘K shell + fuzzy component (per the architecture doc — not cmdk, no bundle bloat).
- Categories: Navigate · This Project (Code/Chat/Preview/Files/Secrets/Hub, gated on active project) · Edit (Find / Find&Replace) · Workspace (New Project/Session/Sidebar) · Appearance · Help (Shortcuts / Replay Onboarding) · Account · Jump to Project.
- Editor bridge: Edit commands dispatch `goblin:editor-cmd` → code-editor opens its search panel (no-op if unmounted).
- **Verified live:** Ctrl+K opens; fuzzy filter; "This Project" group renders in a project and is correctly hidden on the dashboard. Screenshots in `sprint-10/slice-2-palette/`.

### Slice 4 — Git Surface (honest READ + WRITE) · `a93aecb`
- The store is a Backblaze snapshot, not a git working tree → no real per-file diff / ahead-behind exists to read. Per autonomous authority (d), shipped the **truthful** surface, not faked staging.
- API: `pushFiles(..., message?)` (commit message, was hardcoded); `/push` now commits+pushes to the **linked** repo and only creates a repo on first push; `GET /github/project-status` (connection + username + linked repo).
- `SessionGitPill`: footer status pill (green=repo / gold=connected / grey=no account) → slide-in panel / mobile bottom sheet; connect CTA, repo row, commit-message input, Commit+Push, view-on-GitHub; Max-friendly empty state.
- **Not live-verifiable locally:** pill is in the multi-session workspace (CORS→classic fallback) and git needs OAuth + API. The classic tab's existing "Push GitHub" is unchanged.

### Slice 3 — Multi-file editing · `738c2a4`
- **Discovery:** the data model already existed — `useCodeSessionDetail` loads all session files with `activePath`, and the agent persists each generated file as a draft. Migration 0058 was therefore unnecessary (session files == open files) and **not created**.
- Wired the existing `CodeFileTabs` into SessionPane above the editor; shown only when ≥2 files (Max's single-file landing stays clean); close discards drafts only (saved files = safe no-op). AI multi-file output now appears as parallel tabs automatically.
- **Deferred refinement:** a landing_page-intent system-prompt nudge to consolidate to one file (optional).

### Slice 6 — Explorer rename/move/folder-ops · `e2aa57a`
- API: `POST /files/move` (rename alias); `POST /files/folder` {create|delete} (create=.gitkeep, delete=soft-delete the prefix to .trash/). No other new endpoints needed.
- FileExplorer: New Folder / New File header actions; per-file Rename (name or path → move); per-folder Delete; shared name-prompt modal. Touch-friendly visible buttons (no long-press needed).
- **Verified live:** header Ordner/Datei/Hochladen render; "Neuer Ordner" prompt opens. File-row ops need files present (CORS-empty locally).
- **Deferred:** session-linked tree inside the Code Tab (12.3) — `CodeFileTreePanel` is the foundation; a follow-up.

---

## 4. The Convergence demonstration

Both walks run on the **same canvas** — no mode switch between them. Built and
build-verified; the live runs below are the founder's first prod check.

**Max walk (mobile, landing_page intent):** create → "Nicht sicher"/"Landing Page"
sets a composer-forward first paint (thread column 50%, lands on thread, no file
tree, no git foregrounded) → prompt → draft → Sichern → Veröffentlichen → live URL.
The 4 intent cards are one screen inside the create form — **zero extra taps** vs.
before. Git pill + multi-file tabs stay invisible for his single-file flow.

**Sofia walk (desktop, web_app intent):** create → "Web-App" sets an editor-forward
first paint (thread 34%, lands on editor) → Ctrl+K command palette → new session →
multi-file tabs when the AI emits several files → Ctrl+F / Ctrl+D multi-cursor →
Git pill → Commit + Push. Every power tool is present and reachable; none was
foregrounded for Max.

---

## 5. Commits

6 atomic commits, `a45dcc6..e2aa57a` (all local, **not pushed** per non-negotiable a):
```
cb60ca9 feat(intent):  project intent + intent-driven foreground
ce6842b feat(editor):  find/replace + multi-cursor
078bca2 feat(palette): real developer command palette
a93aecb feat(git):     git surface (status pill + commit + push)
738c2a4 feat(code-tab): multi-file editing within sessions
e2aa57a feat(files):   rename/move/folder-ops in the explorer
```

---

## 6. Founder action list

1. **Apply migration 0057** (`supabase db push`). 0058 was intentionally NOT created
   (the session already stores multiple files). After 0057, intent persists to the DB.
2. **Push the Sprint 10 commits** and **deploy** web (Vercel) + api (Railway).
3. **Verify the Max walk on your phone:** create a "Landing Page" project, build,
   Sichern, Veröffentlichen, copy URL. Confirm composer-forward first paint + no new jargon.
4. **Verify the Sofia walk** (you, or a tech-savvy friend): "Web-App" project, Ctrl+K,
   multi-file tabs, Ctrl+F/Ctrl+D, Git pill → Commit + Push to a real repo.
5. **Confirm GitHub OAuth is configured** for the prod app (Slice 4's push path depends on it).
6. **Decide Sprint 11 priorities:** Repo Import (Slice 7) + session-linked tree (Slice 6
   deferred half) + landing-page single-file system-prompt nudge.

---

## 7. Open / deferred

- **Session-linked file tree in the Code Tab** (Slice 6, part 12.3) — deferred; `CodeFileTreePanel` exists as the foundation.
- **Repo Import** (Slice 7) — Sprint 11, as decided. The `import_repo` intent + layout already exist; the import step itself is not built (cards show "BALD").
- **landing_page consolidation prompt** (Slice 3 refinement) — optional.
- **Live preview iframe** — Max's "preview" is still the live-URL card, not an in-app iframe. Not in Sprint 10 scope; worth a future slice.
- A pre-existing latent bug noted, untouched: the **secondary** `components/app-shell/new-project-modal.tsx` sends `color: 'var(--brand-gold)'` which fails the API's hex regex. The **primary** dashboard create modal (the one extended this sprint) sends hex and is fine. Flagging for cleanup.

---

## 8. Honest self-assessment (Bartlett)

**Does the Convergence hold together?** Architecturally, yes — and cleaner than the
brief feared. The keystone (intent → foreground) is real and the depth tools (palette,
find/replace, git, multi-file, explorer ops) are all present and reachable without a
single mode toggle. The biggest pleasant surprise: multi-file was already in the data
model, so Slice 3 became a small, safe UI wire-up instead of a 16h lift.

**Where does it still feel like two products?** Two honest seams remain. (a) The
multi-session workspace (`CodeWorkspace`) and the classic editor (`CodeTabClassic`)
are still two code paths; intent-foreground only lives in the multi-session one, so a
user who lands in the classic fallback gets none of the convergence. Unifying them is
the real next refactor. (b) The file **explorer** (`/files`) and the **Code Tab** are
still separate surfaces — Slice 6's deferred session-linked tree is exactly the bridge
that would close that seam.

**What would a v3 audit say tomorrow?** Dario: "positioning is now demonstrable, but
ship it — none of this is verified with a real user yet." Max: "still calm; the intent
cards didn't scare me and the git pill stayed out of my way." Sofia: "palette + multi-
cursor + multi-file + a real git commit — finally a tool I'd actually code in; now give
me the tree inside the editor and stop making me leave for /files."

**The limitation I most want flagged:** I verified UI, not behavior. The CORS wall
meant I could not watch a single AI generation stream into a multi-file session, run a
real Ctrl+D, or push a real commit from this environment. The code is correct by
construction and review; it is not proven by use. That proof is step 3–4 above.

---

## 9. Beta-readiness verdict

With Sprint 10 built and the model paths working, the gap to first **non-founder beta
users** is now small and concrete:

1. Founder applies 0057 + pushes + deploys (≈30 min).
2. Founder walks Max + Sofia on prod and fixes anything the CORS wall hid from me.
3. Unify the classic/multi-session Code Tab paths so every user gets the convergence
   (the one architectural debt that could make a beta user fall into the lesser surface).

After 1–2, Goblin is a coherent **new category** — "Cursor-power from the beach,
no-hardware, BYOK" — ready for a small, watched beta. Item 3 is the first thing I'd
do in Sprint 11 before widening that beta.
