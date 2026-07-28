# AKT 2 · PHASE 1 — evidence index

Branch `claude/phase-1-j5z1az` · based on `origin/master` @ `a009bbd` · 2026-07-28

| File | What it is | How to read it |
|---|---|---|
| `test-results.md` | Real `vitest` / `tsc` / `git` output: the six new suites, the master-vs-branch regression comparison, the full API suite, the diffstat, and the proof that 0099 is not applied | Deterministic. Every number is a count, not an adjective. |
| `cohort-invisibility-probe.md` | `curl` against the **live production API**: which commit it runs, and what `/api/ops/*` returns to an anonymous caller today | Deterministic. Includes the control request to a never-mounted path. |
| `founder-roundtrip-command.md` | **The U1.5 unblock.** Exact commands for the real-Cloudflare round-trip, to run after merge | This is the open item. Read it first. |

## Gate status, honestly

| Gate | Status | Evidence |
|---|---|---|
| U1.1 tests green (numbers) | **GREEN — 22/22** (14 helper + 8 middleware) | `test-results.md` §A |
| U1.5 three round-trips 3/3 | **BLOCKED-ON-FOUNDER** — production runs `a009bbd`, so the endpoint does not exist on any running server yet | `cohort-invisibility-probe.md`, `founder-roundtrip-command.md` |
| Migration exists and is NOT applied | **GREEN** — `0099_ops_apps.sql` present; nothing in the repo applies it | `test-results.md` §E |
| `OPS_HOSTING_ENABLED=false` everywhere | **GREEN in code** — the default is OFF, and only the exact string `true` opens the gate. **Not verifiable from here**: the Railway value is founder-owned and this session never reads env values. | `ops-beta.test.ts` truth table |
| Cohort-invisibility: no new route reachable without the allowlist | **GREEN** — and one real defect found and fixed by probing production rather than by reasoning (see below) | `test-results.md` §A, `cohort-invisibility-probe.md` |
| Regression: one Act-1 flow unchanged | **GREEN** — the publish path's three suites run at `origin/master` in a worktree and here: 16/16 both sides, and the path is not in the diff | `test-results.md` §B, §D |
| M-H1 ledger line in the same commit as the adapter | **GREEN** — commit `763b3cc` | `git show --stat 763b3cc` |

## The defect the probe found

The gate originally refused with `{"error":"not_found"}` as JSON. Probing the live API showed its own
unrouted 404 is `text/plain; charset=UTF-8` with the body `404 Not Found`. That difference is a
disclosure: comparing `/api/ops/xyz` with `/api/xyz` would reveal that an `/api/ops` mount exists —
the exact fact the gate exists to hide. The refusal now reproduces the framework default verbatim,
and the test asserts it against a bare Hono app's own 404 so it cannot drift.

Worth stating plainly: reasoning about the gate did not find this. Running a request against the real
server did.
