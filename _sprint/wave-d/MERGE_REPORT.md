# WAVE-D — Sicherheit vor Menschen · Report
**Branch `claude/wave-d-security-7whp2y` · base `origin/master` @ 7f351d2 · Opus · 2026-07-11**

## Context (3 lines)
The FEEL-3 agent executes tools server-side against project storage; users will soon be
strangers, not the founder. This wave audited the attack surface a real (or malicious)
user opens — tool sandbox, abuse economics, secret leakage, auth/BYOK, deletion — and
fixed every hole that was a ≤1-commit in-scope fix, ticketing/founder-gating the rest.
State-first check: local `master` ref was stale (8b1259a); branch is correctly based on
**origin/master @ 7f351d2** — the diff below is against that true base.

## Per-unit table
| Unit | Commit | What | Gate evidence | Status |
|---|---|---|---|---|
| D-1 | `4b39023` | Agent tool path sandbox: canonicalize + prefix-assert + type/size, 2 layers | `project-path.test.ts` (67), `tools.security.test.ts` (22), `file-storage.security.test.ts` (17) | **FIXED** |
| D-2 | `132ab04` | Per-user/window abuse caps (agent runs/publishes/uploads/builds), German 429 | `abuse-caps.test.ts` (6), `rate-limit.test.ts` (4), publish-cap in `tools.security.test.ts` | **FIXED** |
| D-3 | `c49484e` | Central secret scrubbing on logs / agent_runs / chat / errors | `scrub-secrets.test.ts` (23), `run-store.security.test.ts` (1) | **FIXED** |
| D-4 | — (audit) | BYOK strong; RLS defense-in-depth; RLS probe + #8/#9 founder-gated | `SECURITY_AUDIT.md` | **VERIFIED-SAFE / FOUNDER-GATE** |
| D-5 | `d247d41` | Deletion completeness: Vercel teardown on purge + Vault KEK (0090) | `account-deletion-teardown.security.test.ts` (4) | **FIXED** |
| D-6 | (this) | `SECURITY_AUDIT.md` findings register + this report | — | **DONE** |

Numeric acceptance: **new adversarial/security tests = 84** (67+22+17 overlap counted once per file: project-path 67, tools.security 22, file-storage.security 17, scrub-secrets 23, run-store.security 1, abuse-caps 6, rate-limit 4, account-deletion-teardown 4). Full API suite **658 passed / 16 skipped / 0 failed**; **tsc clean**. Skips are pre-existing (Stripe/live-env gated), unchanged by this wave.

## Self-review checklist (OS §3, explicit)
1. **Evidence audit** — every gate above maps to a test file that was re-run green in this session (final run 08:48, 658 passed). Claims match artifacts.
2. **Diffstat vs scope** — `git diff origin/master..HEAD` = **24 files**, each justified by a D-ticket (D-1: project-path/tools/file-storage; D-2: abuse-caps/rate-limit/code-sessions/attachments/deploy/transcribe/tools; D-3: scrub-secrets/logger/run-store/chat/code-sessions; D-5: account-deletion/0090; ledger: D-2). No drive-by edits. Consumption path (D-2 caps) listed in the ledger, same commit.
3. **Regression** — full API suite green including the pre-existing `.trash/`-exclusion, cross-project-move, and account-deletion-events-purge tests (proves the `storageKey` guard and the deletion changes didn't break non-targeted paths). Legit messy paths canonicalize; legit uploads/publishes under cap unaffected (tested).
4. **Honesty sweep** — new user-facing strings are German, honest, actionable (`invalid_path`, `forbidden_file`, rate-limit copy with real limit numbers + Retry-After). No fake timings, no English leaks, no phantom affordance, no self-label.
5. **Ledger** — D-2 changes per-user COGS exposure → WAVE-D note added same commit (`132ab04`): trigger, knob + location, billing side (unchanged — ceilings, not charges), per-instance limitation + durable-counter founder-gate.
6. **Report completeness** — per-unit commit SHAs, evidence refs, Honest-Limitations, founder actions, numeric pass rates all present (here + `SECURITY_AUDIT.md`).
7. **Steven question** — "would a skeptical reviewer, seeing only my evidence, reach my verdict?" For D-1/D-2/D-3/D-5: yes (adversarial tests, green suite). For D-4: the honest verdict IS "verified-safe where auditable, founder-gated where a live secret/auth-flow is required" — not a false green.

## Migrations (authored, NOT applied — founder action)
- `supabase/migrations/0090_delete_user_kek.sql` — service-role-only idempotent RPC to purge a user's Vault KEK on deletion. Code is pre-migration tolerant (missing function → logged, delete still completes).

## Merge decision — **HALT, no merge performed**
CLOUD RIDER rule 1 (BRANCH + PR, NEVER MERGE — merge is founder-granted only) and OS §3
(conditional merges execute only when every gate is evidenced AND the founder grants the
outward step). The founder has **not** pasted a merge grant in this invocation, so I stop
at branch + PR. The wave's CI ground-truth check, `--no-ff` merge, `/api/version` twins,
and the prod adversarial smoke (path-traversal + cross-project probe) are the founder-
granted half — to run only after a merge grant, against the real deploy (rider #5/#6:
headless browser + prod secrets this session must not hold).

## Founder actions
1. Review + grant merge (then run the prod smoke: one path-traversal write attempt denied, one cross-project read denied — captured).
2. Apply migration 0090.
3. Run the D-4 RLS cross-read probe (two test users, anon key) — steps in `SECURITY_AUDIT.md`.
4. Decide the durable (cross-replica) rate-limit upgrade before horizontal scaling (D-2 decision table).
5. Keep #8/#9 GitHub tickets open; schedule with web + live auth.
6. Optionally tune the new env knobs (all have safe defaults).

## Honest limitations
- **No merge, no prod smoke this session** — founder-gated (above).
- **D-2 caps are in-memory/per-instance** — reset on deploy, not cross-replica (matches existing M8/M11); durable upgrade is a recorded founder decision.
- **D-4 RLS cross-read + #8/#9** — audited, not probed/fixed here (live secret + auth-flow class, OS §4). BYOK-at-rest and app-level authorization are verified-safe from code.
- **Named follow-up tickets** (out of per-ticket scope): fold the 3 legacy PII regex sets onto the shared scrubber (D-3); batch the interactive `deleteProject()` DeleteObjects (D-5).
- CI conclusion not yet observed for this branch (no push at time of writing) — the founder/PR check is authoritative before any merge-adjacent step (rider #6).
