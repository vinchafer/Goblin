# WAVE-F — Versionierung & Zeit (Checkpoints/Undo) — MERGE REPORT

**Branch:** `claude/new-session-3vh3fk` · 2026-07-17 · Opus · Repo `vinchafer/Goblin`
**Status:** PR-ready, HALT for founder merge. Migration 0095 authored, NOT applied.

## Context recap (3 lines)
- Every agent run mutates a project's B2 files with no way back except manual editing. WAVE-F gives the project **time**: every meaningful change is a content-snapshot checkpoint, the user can travel back, history is legible.
- Built on the F-40 run registry (integrated, not duplicated): the pre-run checkpoint is linked to `agent_runs.id`; restore refuses while a run is active.
- **Branch note:** this branch was already 7 commits ahead of master at session start (prior DD-hardening work: idempotency/refunds/deploy-persist/prismjs-CVE — unmerged). Per the keep-unmerged-commits rule, WAVE-F is layered on top; those 7 commits are NOT part of WAVE-F.

## Storage design (the F1 decision)
**Content-addressed blobs + manifest** (chosen over a diff chain, justified): each file's content is hashed (sha256) and stored ONCE per unique content as a blob at `checkpoints/<projectId>/blobs/<sha256>`; the DB row carries only a `{path,hash,size}` manifest. Project files are small text docs that mostly repeat across snapshots (a run touches 1–3 of N files), so per-file content dedup captures ~all the savings a diff chain would, without a diff chain's fragility (a corrupt base breaks every descendant) or replay cost. Blobs are **platform COGS** (written unmetered) — an auto-snapshot never eats the user's storage quota.

## Per-unit table
| Unit | What | Gate evidence | Status |
|---|---|---|---|
| **F1** Checkpoint engine | migration 0095 `project_checkpoints`; `checkpoint-store.snapshotProject` (dedup'd); blob primitives in file-storage; triggers: pre-run (code-sessions), user "Stand sichern" (POST endpoint), verified publish (tools + deploy) | `checkpoint-store.test.ts`: dedup (10 snaps of 20-file project = 1 blob set, **not** 10×), pre-state held after mutation, pre-0095 no-op | ✅ |
| **F2** Restore | `restoreCheckpoint` (byte-exact blob replay, non-destructive, forward history); `restore_checkpoint` agent tool intent-gated (`classifyRestoreIntent`); REST restore endpoint; refuses while run active | `checkpoint-store.test.ts` (byte-identical round-trip incl. add/modify/delete, forward "Wiederhergestellt" checkpoint, run_active refusal, not_found no-mutation); `checkpoint-restore-tool.test.ts` (gated toolset, default-target excludes own snapshot → undoes previous run); `intent.test.ts` (undo intent DE+EN, SAVE-vs-restore false-positive guard) | ✅ |
| **F3** History UI | `SessionHistoryPill` — timeline (label/when/±n/source icon), diff-vs-current, per-file line diff (shared `unifiedDiffLines`), Wiederherstellen (honest confirm) / Nur ansehen; `--ed-*` tokens, 375px-first, dark+light, safe-area; honest-hide pre-0095 | tsc clean (web); wired into SessionPane ⋯ more-menu. **Screenshots: see Honest Limitations.** | ⚠️ (see limits) |
| **F4** Publish history | verified-publish checkpoints carry `deployed_url` (only after the deploy truth-gate); `listPublishVersions` + `/checkpoints/publish` endpoint; UI shows the openable verified URL | publish checkpoint written on both publish paths; `retention.test` exercises publish-kept-forever | ✅ (backend) |
| **F5** Retention & cost | `pruneAgentAutoCheckpoints` (daily cron 03:45 UTC) + orphan-blob GC; keep user/publish forever, protect last-M runs; account/project deletion purge; ledger NOTE (storage, not tokens) | `retention.test.ts`: prune keeps user/publish, protects last-M runs, GC frees only orphans, purge removes rows+blobs | ✅ |

## Self-review checklist (§3)
1. **Evidence audit:** all gate claims map to a passing test re-run (16 checkpoint/restore/intent tests + full suite). Screenshots NOT captured (see limits) — claim downgraded accordingly.
2. **Diffstat vs scope:** every touched file justified by a unit (engine, triggers, endpoints, tool, UI, retention, ledger). No drive-by fixes. Consumption: STORAGE only (ledger NOTE), zero model tokens.
3. **Regression:** full API suite **882/882** (baseline 863 + 19 new); no existing test changed. Non-agent/non-restore runs unaffected (restore tool advertised only on restore intent; toolset unchanged otherwise).
4. **Honesty sweep:** German+EN strings; no fabricated timings; no phantom affordances (pill honest-hides pre-0095; restore refuses honestly under an active run; publish URL only on a VERIFIED gate). Confirm dialog names exactly what changes and that it's reversible.
5. **Ledger:** storage-COGS NOTE added same-commit as the retention wiring; no token path → no M-row.
6. **Report completeness:** unit table, evidence refs, Honest-Limitations (below), founder actions, numeric pass rates — present.
7. **Steven question:** a skeptic with only this evidence would accept F1/F2/F4/F5 (deterministic tests). F3 visual polish is asserted from code + tsc, not screenshots — explicitly flagged.

## Honest Limitations
- **F3 screenshots NOT captured in this environment.** The web app was typechecked (tsc clean) and the component follows the shipped SessionGitPill portal/token/safe-area pattern exactly, but no browser render/Playwright screenshot was taken here. The founder prod-walk (below) is the visual gate.
- **Restore resets canonical project storage (B2), not the open session-draft editor.** The checkpoint layer operates on project files (what publishes/zips and what the next agent run hydrates from). After a UI restore, the pill triggers `detail.refresh()`, but a session whose draft editor is open may still show its drafts until the next hydrate/run — the restore is real and correct at the storage layer; the transient draft view is a separate layer.
- **Binary assets:** blobs round-trip file **strings** (like every other consumer — zip, context, diff). Text (all agent output) is byte-exact; true binary uploads are captured best-effort as UTF-8, consistent with the existing pipeline.
- **`eslint` `react-hooks/set-state-in-effect`** fires on the new pill's mount-probe effect — identical to the shipped `SessionGitPill`; CI gates on tsc, not eslint (no lint job in `.github/workflows`).
- **Money suites** self-skip locally (no `sk_test_` key); they must stay 17/17 in CI — untouched by this wave.

## Founder actions
1. **Apply migration 0095** (`supabase/migrations/0095_project_checkpoints.sql`) via the Supabase SQL Editor. Code is pre-0095 tolerant (UI honest-hides, snapshots no-op) until then.
2. **One prod round-trip on the test account** (`vinc.hafner3@gmail.com`): create a checkpoint (Stand sichern) → mutate a file → restore → confirm byte-exact + a "Wiederhergestellt" checkpoint appears; run an agent build then "mach die letzte Änderung rückgängig" via chat.
3. Optional knobs: `CHECKPOINT_RETENTION_DAYS` (30), `CHECKPOINT_KEEP_LAST_RUNS` (20).

## Numeric acceptance
- API suite: **882/882** (baseline 863 + 19 new). tsc clean (API + web). Migration numbering continues at **0095**.
