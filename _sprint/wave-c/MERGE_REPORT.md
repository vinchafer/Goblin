# WAVE C — Workspace-Explorer — MERGE REPORT

**Branch:** `claude/titel-wave-c-m9p942` · **Base:** `origin/master` · **Author:** CC/Opus · **Date:** 2026-07-17
**Design source:** `docs/GOBLIN_WORKSPACE1_SPEC.md` (founder-supplied this session; committed `d60fd08`)

## Context (3 lines)
Phase 0 HALTed because the mandatory spec was absent (`_sprint/wave-c/HALT_REPORT.md`); the founder supplied it, confirmed "extend the existing `FileExplorer` in place," and authorized the `deleteProject` fix. The Dateien section already had list/upload/folder/zip/`.trash`/reader/editor; this wave assembles them into a first-class Explorer and wires files↔chat. All changes are additive to a live-user surface; the code-session editing workflow was deliberately left untouched.

## Per-unit table
| Unit | Commit | What shipped | Gate evidence | Status |
|---|---|---|---|---|
| Spec | `d60fd08` | Committed `GOBLIN_WORKSPACE1_SPEC.md` (unblocks Phase 0) | file in repo | ✅ |
| #18 | `c89ef88` | `deleteProject` DeleteObjects chunked ≤1000/req | `delete-project-batching.test.ts` (mocks S3, 2500 objs, asserts ≤1000/batch + all deleted) — **runs green** | ✅ |
| C-3 back | `9d2c3d3` | Reversible trash scheme; `listTrashFiles`/`purgeTrash` (batched); `GET /:id/trash`, `POST /:id/files/restore`; batched purge route | `trash-lifecycle.test.ts` (4 tests: round-trip incl. umlaut, 409 conflict, purge, legacy-400) — **green**; B6 + zip-trash tests still green | ✅ |
| C-1 | `4dbacff` | Instant whole-tree name filter on the one FileExplorer | web tsc clean | ✅ (visual gate → founder) |
| C-2 | `d910b11` | New-file templates (leer/md/html) + in-Explorer Bearbeiten→CodeEditor→Speichern (PUT /:id/files/*) | web tsc clean | ✅ (visual gate → founder) |
| C-3 UI | `eca9158` | Papierkorb view (restore + endgültig löschen) + Duplizieren | web tsc clean | ✅ (visual gate → founder) |
| C-3 UI | `1c2bb45` | Long-press multi-select → batch delete + download | web tsc clean | ✅ (batch move/zip = v1.1) |
| C-4 | `63ccfaa` | "Im Chat anhängen" + "Goblin dazu fragen" → seeds the C2 attach path (`initialAttachments`) | web tsc clean; B6 regression green (887/887) | ✅ (visual/real-model → founder) |
| C-6 | `fb148ca` | `FileDataSource` abstraction; Explorer reads via swappable source; project impl shipped | web tsc clean; type-level swappability | ✅ abstraction; global surface = v1.1 |
| Accept | `70ebcbc` | §6 acceptance sequence as Playwright spec @375px (+ testids) | compiles + `--list` OK; `@local-only` | 🟡 authored, **unrun** (founder prod walk) |

## Self-review checklist (OPUS_OPERATING_SYSTEM §3)
1. **Evidence audit** — backend claims backed by tests that were re-run green (API 887/887, +5 vs the 882 baseline). Frontend claims backed by `web tsc` clean; visual/E2E claims are explicitly downgraded to founder-pending (below).
2. **Diffstat vs scope** — `git diff origin/master..HEAD`: 12 files, all Wave-C. No drive-by edits; billing/money/checkpoints/deploy untouched.
3. **Regression** — B6 (`.trash/` never in agent context) holds: the reversible scheme keeps the `.trash/` prefix, `project-context.test.ts` + `agent/tools.test.ts` stay green. `create-zip-trash` (trash excluded from zip) green. No existing test changed.
4. **Honesty sweep** — new user strings are DE+EN via `t()`, design tokens only. No phantom affordances: legacy trash shows a disabled honest label (not a fake restore); non-text chat-attach is honestly gated; the global tab is NOT shown (v1.1). No fake timings, no self-labels.
5. **Ledger** — **no change.** The only consumption-adjacent path is C-4 attach, which reuses `composeMessageWithAttachments` (billed like any input) — exactly the "expected zero" the runbook predicted. No new token/API mechanism ⇒ no `GOBLIN_CONSUMPTION_LEDGER.md` row. Content search (a would-be new cost) was **not** shipped (C-5 = name-only).
6. **Report completeness** — this file: per-unit table, evidence refs, honest limits, founder actions, numeric figures. ✅
7. **The skeptical-reviewer test** — a reviewer with only this evidence would agree the backend is proven and the frontend is built-and-typechecked-but-not-yet-visually-walked. That is exactly what is claimed.

## Numeric figures
- API suite: **887/887** passing (baseline 882 → +1 batching, +4 trash-lifecycle). API tsc: clean. Web tsc: clean.
- Money suites: self-skip locally (no `sk_test_`); the `money-suite-guard` test passes. **17/17 in CI** is the founder's CI gate — no billing/money code was touched.
- Acceptance sequence steps encoded as E2E: 8/8 (folder→md create+edit+save→attach→rename→trash→restore→zip); executed here: 0 (no browser/prod — see limits).

## Honest Limitations (mandatory)
- **Frontend is typecheck-gated, not visually gated.** This build container has no browser, no prod, no Supabase/Stripe secrets, so I could not run the app, take the 375px/1440px dark+light screenshots, or execute the acceptance E2E. Per "grün ist was gesehen wurde," those gates are **founder-pending**, not claimed green. The runbook already assigns the prod 375px walk to the founder-action list.
- **The acceptance E2E (`47-...spec.ts`) is authored but unrun.** It compiles and lists under Playwright; selectors use the real testids I added, but it has not been executed against a running stack. Treat it as a harness that may need small selector fixes on first run.
- **Code-tab "one component" (C-1) — deliberate, documented decision.** The Code tab's file list is backed by the *code-sessions* API (draft/saved/deployed state) — a genuinely different data model from the project files-tree the Explorer reads. Collapsing them would touch the live code-editing/deploy workflow ("nothing may disrupt an active session"). I did **not** rip it out. The Explorer is the one canonical *project-files* surface (dashboard mount); fully absorbing the code-session file-nav into it is a founder decision (see below), not something I did silently.
- **C-5 content search = v1.1.** Name/path filter shipped (C-1); server-side in-file content search was not built (spec explicitly permits name-only + say-which-shipped). No half-built search UI.
- **C-6 global "Meine Dateien" = v1.1.** The data-source abstraction is defined, type-proven, and consumed by the Explorer's read path; the global surface, its backing endpoint, widening the interface to cover mutations, and a runtime test are v1.1 (the web app has no unit-test runner yet). No half-global tab shipped.
- **Legacy trash is not auto-restorable.** Entries soft-deleted before this wave used the lossy `.trash/<ts>_<flat>` scheme; their original path is genuinely unrecoverable, so restore honestly refuses them (400 `legacy_unrestorable`). They remain listable/downloadable/purgeable. New deletes are fully restorable.
- **`#18` tracking ID.** There is **no** GitHub issue #18 for the unbatched delete — GH #18 is an unrelated merged docs PR, issue search for deleteProject/batched/purge is empty, and the DD register uses a different ID scheme. `#18` is the spec/runbook's internal reference. The concern was real (confirmed in code) and is fixed + regression-tested. The one genuinely-relevant *open* GitHub issue found is **#11** (Explorer hydration flash) — a separate code-session `useCodeSessionDetail` bug, out of scope here, noted for a future unit.

## Founder actions
1. **Prod 375px acceptance walk on the test account** (`vinc.hafner3@`): create folder → create+edit+save md → **Im Chat anhängen** → **Goblin dazu fragen** (real-model leg, prod API) → rename → trash → **restore** → download zip. Screenshot each step. Optionally run `47-workspace-explorer.spec.ts --project=auth-mobile` locally first.
2. **Decide the Code-tab merge** (C-1's "absorb the current list"): keep the code-session file-nav as the editing surface (current, non-regressing) vs. collapse it into the Explorer — a change to the live editing/deploy flow. My recommendation: keep it for now; schedule the collapse as its own gated unit.
3. **Confirm v1.1 backlog:** content search (C-5), global "Meine Dateien" + its endpoint (C-6), batch move / zip-of-selection (C-3), and address open issue **#11**.
4. **Merge** is founder-granted per the runbook (branch+PR, never self-merge).

**PR opened → HALT. Merge founder-granted.**
