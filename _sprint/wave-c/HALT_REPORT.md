# WAVE C (Workspace-Explorer) — HALT at Phase 0

**Date:** 2026-07-17 · **Branch:** `claude/titel-wave-c-m9p942` (from `master` @ `8af3589`) · **Author:** CC/Opus
**Status:** 🛑 HALT — mandated by Phase 0 gate. No units built. No PR. Control returned to founder.

---

## Why this is a HALT (not a session failure)

The Wave-C runbook's Phase 0 gate is explicit and unconditional:

> Phase 0: read `docs/GOBLIN_ARBEITSMETHODIK.md` + `docs/OPUS_OPERATING_SYSTEM.md` + `docs/GOBLIN_WORKSPACE1_SPEC.md` **(absent → HALT)**

`docs/GOBLIN_WORKSPACE1_SPEC.md` **is absent.** This is precisely the failure mode the
doctrine names and prescribes a HALT for:

- `OPUS_OPERATING_SYSTEM.md §5b`: *"This already bit once (a spec referenced a file that was
  never committed …). Verify every file the prompt names as present … **Absent → HALT, name it.**"*
- `GOBLIN_ARBEITSMETHODIK.md` Law 10: *"Der Prompt ist ein Plan; das Repo ist die Wahrheit"* —
  when the prompt contradicts repo reality, trust the repo, HALT, report.

The spec is **load-bearing**, not incidental:
- **ACCEPTANCE** is defined as *"spec §6, verbatim as E2E at 375px"* — the verbatim sequence is the gate.
- **C-6** requires *"the data-source abstraction (spec §3)"*.
- The entire wave is *"assembles them into a real Explorer"* per this spec's target architecture.

Fabricating §3/§6 from memory would violate the anti-pattern catalog
(*"fabricated file contents / invented history"*) and produce an un-gradeable wave. So: HALT.

### Evidence — the file exists nowhere
```
working tree:            (none)
git ls-tree master / origin/master / wave-c / origin/wave-c:  (none, all four)
git log --all -- docs/GOBLIN_WORKSPACE1_SPEC.md:              (no commit ever touched it)
grep docs/ for "Meine Dateien" / "data-source abstraction" / "WORKSPACE1":  (0 hits)
```

---

## State-first inventory (mandatory) — deltas vs. the runbook's premises

While halted I still did the state-first pass the runbook demanded. Three of the prompt's own
premises are **stale against repo truth** — further reason not to build blind:

### Delta 1 — A unified Explorer already largely exists (C-1..C-3 partly shipped)
The runbook frames the file section as loose pieces "to assemble into a real Explorer." Repo truth:
`apps/web/components/files/FileExplorer.tsx` (**~40 KB, one component**) already implements:
- breadcrumb path, type icons, size/date, name column (**≈ C-1**)
- "Neuer Ordner" / "Neue Datei" (**≈ C-2**)
- rename, in-project move (path edit), **cross-project move picker** (labelled `WS-B.1`),
  per-file delete, folder delete (**≈ C-3, minus Papierkorb/restore/multi-select**)
- `.trash/` is already filtered out of the listing on load

Apparently **not yet present** (needs spec to design correctly): Papierkorb/restore view,
"endgültig löschen" batched purge, long-press multi-select, "Im Chat anhängen" / "Goblin dazu
fragen" (C-4), server-side content search (C-5), global "Meine Dateien" (C-6).
Building on this without §3 risks duplicating or diverging from the intended architecture —
exactly the "reuse, never duplicate" hazard the runbook flags.

### Delta 2 — Ticket "#18" mapping is wrong
Runbook: *"closes ticket #18 (unbatched `deleteProject()`)"*. Repo truth: **issue/PR #18 is a
merged docs PR** — *"docs(sprint): WH4 + webhook hardening report, monitor setup, evidence"*
(closed 2026-07-10 by vinchafer). It has nothing to do with `deleteProject()`. The runbook's
issue-number reference does not resolve to the described ticket.

### Delta 3 — `deleteProject()` batching is *partial*, not resolved (an honest finding)
`apps/api/src/services/file-storage.ts:428` **paginates the LIST** correctly (continuation-token
loop). But it then passes the **entire** key array to a single `DeleteObjectsCommand`
(`Delete: { Objects: keys }`) despite the comment *"Delete in batches of 1000 (S3 limit)."* —
the delete is **not** chunked to 1000. On a project with >1000 objects this call would reject /
drop beyond the S3 per-request cap. So the C-3 ">1000-file" concern is **still open**, and the
runbook's "VERIFY FIRST whether it's already closed" answer is: *no, not fully.*
> Reported as a finding only — **not fixed here** (out of scope for a Phase-0 HALT; one isolated
> commit per unit). It is a genuine latent bug worth a small dedicated unit.

---

## What unblocks Wave C
1. **Commit `docs/GOBLIN_WORKSPACE1_SPEC.md` to the repo** (doctrine: *"Specs gehören ins Repo,
   nicht nur in den Chat"*). Its §3 (data-source abstraction) and §6 (acceptance sequence) are
   the irreducible inputs.
2. Confirm the intended relationship between the new Explorer and the existing
   `FileExplorer.tsx` — extend it in place (the "one component, two mounts" of C-1), or is a
   different target meant?
3. Confirm the real tracking ID for the unbatched-`deleteProject()` concern (repo #18 is unrelated).

Once the spec lands, a fresh session can run Wave C against it cleanly (one wave per session).

## Honest Limitations
- I did **not** read the spec's actual §3/§6 — the file does not exist; nothing here reconstructs it.
- Inventory deltas are from targeted greps + reading `FileExplorer.tsx` markers and
  `deleteProject()`; I did **not** run the app, the E2E suite, or exhaustively audit every C-unit
  surface (a HALT at Phase 0 does not build or gate units).
- The `deleteProject()` >1000 finding is reasoned from the code path, not reproduced against a
  live >1000-object bucket.

## Founder action list
- [ ] Add `docs/GOBLIN_WORKSPACE1_SPEC.md` to the repo (or point me at where the spec lives).
- [ ] Decide: extend existing `FileExplorer.tsx` vs. new target (answers C-1's "no third rendering path").
- [ ] Give the correct tracking ID for the unbatched-`deleteProject()` item.
- [ ] Optional: authorize a tiny standalone unit to chunk `deleteProject()`'s delete to 1000/req.
