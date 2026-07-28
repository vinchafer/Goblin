# AKT 2 · PHASE 1 (v2 LEAN) — FOUNDATION: CF ADAPTER, BETA FLAG & ROUND-TRIP

**Branch** `claude/phase-1-j5z1az` · **base** `origin/master` @ `a009bbd` · **date** 2026-07-28
**Nothing user-visible changed. Nothing is applied. Nothing is merged.**

---

## Unit SHAs

| Unit | SHA | What landed |
|---|---|---|
| U1.1 | `a5fa297` | The Act-2 beta allowlist gate + middleware + master-plan contract paragraph |
| U1.2 | `763b3cc` | Typed Cloudflare adapter (R2 + KV + Workers) **+ ledger M-H1 in the same commit** |
| U1.3 | `0307abf` | `GET /api/ops/health` — four checks, value-blind |
| U1.4 | `f5ee0a4` | Migration `0099_ops_apps.sql` (AUTHORED, not applied) + pre-migration-tolerant reader |
| U1.5 | `86f7506` | `POST /api/ops/selftest` — the real-API round-trip, run by the deployed API |
| — | `504a1ec`, `a072a97` | Evidence artifacts + report |
| — | `8ceb09e` | Founder amendment (G1 parallel-build) + `goblin.app` → `justgoblin.app` |

Scope: **16 files, +3218 lines, 0 deletions.** Three files modified, thirteen new. The only modified
*code* file is `apps/api/src/index.ts`, +5 lines (an import, a comment, the mount).

---

## Per-gate evidence

| Gate | Result | Evidence |
|---|---|---|
| **U1.1 tests green (numbers)** | **22/22** — 14 helper (truth table: admits in exactly 1 of 7 configurations) + 8 middleware | `test-results.txt` §A |
| **U1.5 round-trips 3/3** | **BLOCKED-ON-FOUNDER.** Not green, not claimed green. | `founder-roundtrip-command.md` |
| **Migration exists, NOT applied** | **GREEN.** `0099_ops_apps.sql` present; `startup-migrations.ts` (the only startup schema hook) validates columns and never executes a `.sql` file — read this session | `test-results.txt` §E |
| **`OPS_HOSTING_ENABLED=false` everywhere** | **GREEN in code; NOT verifiable from here.** Default is OFF; only the exact string `true` opens the gate (7-row truth table). The Railway value is founder-owned and this session never reads env values — see Limitation 2. | `ops-beta.test.ts` |
| **Cohort-invisibility: no new route reachable without the allowlist** | **GREEN**, and **one real defect found and fixed** — see FINDING 1 | `test-results.txt` §A, `cohort-invisibility-probe.txt` |
| **Regression: one Act-1 flow (publish) unchanged** | **GREEN — 16/16 at `origin/master` in a worktree, 16/16 here.** Both sides run and compared, not assumed | `test-results.txt` §B, §D |
| **M-H1 ledger line in the same commit as the adapter** | **GREEN** — `763b3cc` contains both `cf-deploy.ts` and the ledger row | `git show --stat 763b3cc` |
| Full API suite | **127 files / 1112 tests passed** (was 121 / 1018; this PR adds 6 / 94) | `test-results.txt` §C |
| Typecheck | `tsc --noEmit` clean | `test-results.txt` §C |

---

## FINDINGS

**FINDING 1 — the gate leaked its own existence, and only a live request revealed it.**
The Act-2 gate refused with `{"error":"not_found"}` in JSON. Probing the live production API showed
that its own unrouted 404 is `text/plain; charset=UTF-8` with the body `404 Not Found`. Comparing
`/api/ops/xyz` with `/api/xyz` would therefore have revealed that an `/api/ops` mount exists — the
exact fact the gate exists to hide, on the surface whose entire purpose is invisibility. **Fixed in
`86f7506`**: the refusal now reproduces the framework default verbatim (status, content type, bytes),
asserted in a test against a bare Hono app's own 404 so it cannot drift. Reasoning about the gate did
not find this; running one request against the real server did.

**FINDING 2 — the master plan's Phase-1 unit list is superseded, and the domain differed everywhere.**
*(Domain half RESOLVED 2026-07-28 on founder instruction: Phases 2 and 3 now say `justgoblin.app`;
Phase 12 never named a domain, so there was nothing there to correct. `OPS_SPIKE_0_DECISION_TABLE.md`
still says `goblin.app` and is deliberately left alone — it is a dated evidence record.)*
The plan (and `OPS_SPIKE_0`) specify `CF_DISPATCH_NAMESPACE`, Workers for Platforms, per-app Workers
and per-app D1 — all of which the lean/Free amendment removes — and name the apps domain
`goblin.app`, while the environment and this phase use **`justgoblin.app`**. Repo-over-prompt was not
in conflict here (the prompt is the written record of the amendment), so this was recorded rather than
halted: the amendment is now written into the master plan's Phase-1 section in `a5fa297`. Phases 2 and 3 have since been corrected in this document; the spike is not, by design.

**FINDING 3 — `OPS_SPIKE_0` §7 limitation 1 is now partly answered, and nobody wrote it down.**
The spike's largest open unknown was "`goblin.app` was never verified". The environment carries
`OPS_APPS_DOMAIN=justgoblin.app`, which implies the founder resolved it by choosing a different
domain. That resolution is not recorded in any document. It should be, before Phase 2 builds wildcard
DNS against it.

**FINDING 4 — the `project_id` cascade deletes the row, not the hosted app.**
`ops_apps.project_id` cascades on project deletion. That removes the registry row while leaving the R2
objects and the KV route live — a public URL with nothing pointing at it: an abuse-SOP hole (no owner
to contact, no row to suspend) and unbounded storage COGS. Flagged in the migration itself as a
**Phase-2 obligation**: delete R2 prefix and KV route *before* the row. Not fixable here — Phase 1 has
no delete path to hook.

**FINDING 5 — `CF_R2_API_TOKEN` is genuinely unused.** As the prompt anticipated: the S3 credentials
suffice for every R2 call. It is not read by the adapter, not in `CF_ENV_VARS`, and there is a test
asserting it is absent from that list. **Left untouched in Railway — reserved-unused.**

---

## HONEST LIMITATIONS

**Mandatory section. "None" would be a lie, and this phase has a large one.**

1. **THE ROUND-TRIP NEVER RAN. No Cloudflare API has been called by anything in this PR.** Not once,
   not in any form. Every claim about R2, KV and Workers behaviour rests on Cloudflare's documentation
   and on mocked tests. Production runs `a009bbd`, so the self-test endpoint does not exist on any
   running server. **U1.5 is BLOCKED-ON-FOUNDER, and the adapter must be treated as unproven against
   the real substrate until `founder-roundtrip-command.md` has been run and its output pasted here.**

2. **`OPS_HOSTING_ENABLED=false` is verified in code, not in Railway.** This session never reads env
   values (Rule 4). "The flag is off in production" is a founder statement I cannot check; what I can
   and did check is that the code is off *by default* and that only the exact string `true` opens it.

3. **Two request shapes are unverified against the live API, and they are the most likely thing to
   break in step 3b.** (a) The KV write endpoint is called with `multipart/form-data` carrying `value`
   and `metadata`; older clients sent a raw body, and which shape today's API requires was not tested.
   (b) The Worker upload is a `multipart/form-data` ES-module upload with `main_module` metadata. Both
   follow Cloudflare's documented shapes; neither has met a real server. If the self-test fails, look
   here first.

4. **The Workers `compatibility_date` is a guess with a rationale, not a verified value.** Fixed at
   `2025-01-01` so deploys are reproducible instead of drifting with the calendar. Cloudflare may
   reject or reinterpret it; `CF_WORKER_COMPAT_DATE` overrides it without a deploy.

5. **The M-H1 cost figures are arithmetic on list rates, not observed cost.** No Cloudflare invoice,
   dashboard or usage figure has been seen by anyone. The R2 rates are the spike's, retrieved
   2026-07-25 and **not re-fetched** this session. The 100k-requests/day Free ceiling is inherited
   from the founder's decision record and **was not verified against live Cloudflare docs** — this is
   now stated in the ledger row itself.

6. **There is no orphan sweep and no retention job.** Storage is reclaimed only when
   `deleteAppFiles` is called explicitly. A failed publish that uploads some files and then dies
   leaves them in R2 forever. Bounded today (nothing publishes yet), unbounded the moment Phase 2
   ships. Recorded in M-H1.

7. **`putAppFiles` is not atomic and does not roll back.** A failure mid-upload leaves earlier files
   written; the result reports how far it got (`after 1/3 files`) but does not undo. Whether a partial
   app should be deleted or retried is a Phase-2 publish-flow decision, deliberately not made here.

8. **The self-test is not concurrency-safe.** Two simultaneous runs share one fixed R2 prefix, KV key
   and worker name and would interfere. Acceptable because exactly one human can trigger it, and it
   refuses if a registered app owns the name — but two founder taps at once would produce a confusing
   red report, not a correct one.

9. **`ops_apps` has never been created.** The SQL has not run anywhere — not on a scratch database,
   not locally. It is reviewed SQL, not executed SQL. If it has a syntax error, the founder finds it
   in Supabase Studio.

10. **No web/UI surface was touched, so no Feeling invariant was exercised.** German UI, i18n, design
    tokens, honest degradation: all vacuously satisfied because this phase ships zero pixels. The
    first real test of those is Phase 3.

11. **~~`G1` was not checked.~~ RESOLVED 2026-07-28 — this was my misreading, not a gap.** I raised
    that the master plan hard-gates Phases 1–15 behind G1 and that no G1 artifact exists in the repo.
    The founder's answer: the sequencing was consciously amended on **2026-07-26** — Act-2 **build**
    runs **parallel** to cohort validation, the G1 metrics are still collected, and the Thesis §11
    kill criteria remain binding regardless of build progress. That amendment is now written into the
    master plan's sequencing section (`FOUNDER AMENDMENT 2026-07-27`), which is where it was missing.
    **Phase 1 ran under exactly this rule.** The residual honest cost is stated in the amendment
    itself: parallel building means Act-2 work can be thrown away if the cohort numbers go against the
    thesis — a price knowingly paid for lead time, not an overlooked risk.

12. **The adapter has one caller (the health probe) and one exerciser (the self-test).** No publish
    path, no user path, no job calls it. Its ergonomics under real use are untested by construction.

---

## FOUNDER ACTIONS

1. **Merge this PR** via the GitHub app — **standard merge commit, not squash** (the six unit commits
   are the revert granularity).
2. **Apply migration `0099_ops_apps.sql`** in Supabase Studio.
3. **Run the round-trip** — `evidence/akt2-phase1/founder-roundtrip-command.md`, five steps: flip
   `OPS_HOSTING_ENABLED=true`, get a token for `vinc.hafner3@gmail.com`, run the two curls, flip it
   back to `false`, send both outputs to Steven. **Until that output exists, U1.5 is not green.**
4. **Leave `OPS_HOSTING_ENABLED=false`** after step 3. It is the only thing keeping Act 2 dark for the
   live cohort.
5. **Leave `CF_R2_API_TOKEN` alone** — unused by the adapter, reserved.
6. **Record where `justgoblin.app` came from** (FINDING 3) — it answers the spike's largest open
   question and is currently written down nowhere.
7. **Then say "Phase 2" to Steven.** Phase 2 must be re-issued as **v3** to match this lean
   architecture (router Worker + wildcard DNS + publish). **Do not use the Phase-2 v2 prompt as-is** —
   it assumes a dispatch namespace and per-app Workers that no longer exist. (The domain is now
   correct in the master plan; the v2 *prompt* may still carry the old one.)
