# Commit Report — Working-Tree Structuring (2026-05-29)

Structured ~2 days of working-tree changes (140+ modified, ~25 deleted, ~25 untracked) into 12 atomic commits. No source-code edits beyond the SheetStackProvider fix already in the tree; this pass was git operations + `.gitignore` only. **Not pushed** — local commits only.

---

## 1. Triage outcomes

**Gitignored (TRIAGE B/C):**
- `Anpassungen nach Testing/` — ~4 MB of `.docx` / `.pdf` / screenshot folders (Goblin design-adjustment notes). Project-relevant in content, but non-diffable binaries that would bloat history permanently. User chose gitignore.
- `vercel_live.html` — downloaded Next.js production HTML snapshot (reference/build artifact).

**Committed after inspection:**
- `Dashboard_Design_Export/` (TRIAGE C) — HTML mockups (`built_03_v7`, `built_04_v1/v2`, `built_05_06_v1`, …), `_gen.py`, generator scripts, tailwind-activation snapshots. Project-relevant, source-like → committed in the docs commit.

**Committed as project source (TRIAGE A):** all root report `.md` files, chat `CodeBlock`/`Message`, `SettingsModal`/`sections.ts`/`AppearanceSection`, `lib/syntax/`, `postcss.config.mjs`, token CSS, `_symbols.svg`, the `welcome/` tree, the project `/work` route, `tests/security/`, migrations 0050–0052.

---

## 2. Commit list (`git log --oneline`)

```
6c2b1ed chore(repo): consolidate remaining working-tree changes
2199a87 feat(api): BYOK custom endpoints + oauth/onboarding persistence
91ee09a test(security): chat secret isolation
3a96488 feat(workspace): project /work route
281b8aa docs(history): build reports and mockup archive
72c0d6c feat(db): migrations 0050-0052
8dd9cd7 refactor(onboarding): move /onboarding/ flow to /welcome/
b920ba6 feat(settings): desktop SettingsModal (two-pane) + SheetStackProvider fix
a165bd9 refactor(arch): WS1-WS5 — dark contrast, sidebar data flow, desktop popover, settings registry, cleanup
3dfe7d9 feat(chat): screens 04/05/06 — empty/active/generating
00381b4 feat(brand): activate Tailwind v4, finalize v1.1 design tokens
85636ba chore(repo): gitignore personal notes and build artifacts
6c2a9f3 fix(security): enable RLS on all tables, lock down SECURITY DEFINER functions   <- prior HEAD
```

(Plus this report as a final `docs(repo)` commit on top.)

---

## 3. Per-commit file count

| Commit | Files |
|--------|-------|
| `chore(repo): gitignore …` | 1 |
| `feat(brand): Tailwind v4 + tokens` | 8 |
| `feat(chat): screens 04/05/06` | 17 |
| `refactor(arch): WS1-WS5` | 22 |
| `feat(settings): SettingsModal + fix` | 1 |
| `refactor(onboarding): → /welcome/` | 19 |
| `feat(db): migrations 0050-0052` | 4 |
| `docs(history): reports + mockups` | 50 |
| `feat(workspace): /work route` | 1 |
| `test(security): chat secret isolation` | 1 |
| `feat(api): BYOK + oauth/onboarding` | 5 |
| `chore(repo): consolidate remaining` | 130 |

---

## 4. Final `git status`

Working tree **clean** (gitignored `Anpassungen nach Testing/` + `vercel_live.html` remain untracked-by-design and do not appear in status).

---

## 5. Things that didn't fit the original plan cleanly

- **WS4 fix could not be its own diff (planned Commit 4).** `SettingsModal.tsx` was untracked, so the new modal and the SheetStackProvider crash fix exist only as one never-before-committed file. Splitting "new" from "fix" would have required reconstructing a pre-fix version (a source edit / git surgery — both forbidden). Resolved by committing `SettingsModal.tsx` once with a combined `feat + fix` message that fully documents the crash and its fix. Net: planned Commit 3 and 4 became one arch commit (modal wiring: `sections.ts`, `settings-sheet`, `dashboard-shell`) plus one dedicated `SettingsModal` commit.
- **`schemas.ts` was not brand-related** (it carries the BYOK `custom`/`baseURL` change), so it left planned Commit 1 and joined the API feature commit alongside `byok-keys`/`byok-service`/`github`/`onboarding` — keeping the BYOK + oauth/onboarding feature coherent with migrations 0050–0052.
- **`/work` route and `tests/security/`** were TRIAGE-A source with no home in the planned sequence. Rather than burying them in the catch-all chore, each got an honest dedicated commit (`feat(workspace)`, `test(security)`).
- **`tailwind.config.ts` deletion** logically belongs with the brand/Tailwind-v4 activation (Commit 1) but surfaced during the final sweep; since commits are forward-only (no amend), it landed in the catch-all chore with an explanatory note.
- **`globals.css` and `dashboard/layout.tsx`** are single files touched by multiple concerns. Git can't split file hunks across commits without interactive `add -p` (unavailable here), so each was committed whole — `globals.css` with the chat commit, `dashboard/layout.tsx` with the catch-all.

---

## 6. Surprising / noteworthy

- **CRLF warnings on nearly every file.** Working copy is LF; Git will normalise to CRLF on next touch. No semantic content — flagged in `REFACTOR_2026-05-28.md`. No `.gitattributes` exists; a future `* text=auto eol=lf` could stop the churn but was out of scope (would be a source/repo-config edit).
- **The catch-all is large (130 files)** but genuinely single-concern: site-wide token-clean propagation (`Fraunces`/`DM Sans` → `--font-sans`, `moss` → `--brand-green`) from the brand migration reaching every surface. The diff is overwhelmingly find-and-replace, not logic.
- **Net line delta is deletion-heavy** in several commits (chat −395, arch −430, onboarding churn) — the refactors removed more than they added, consistent with consolidation rather than feature sprawl.
- **No merge conflicts, no history rewrites.** Forward-only as required.
