# FOUNDER-WALK-5 — Merge Report

**Branch:** `claude/lock-screen-deleted-at-bugs-9a08kn` (from fresh master `6c63710`)
**Two defects, five isolated revert-ready commits.**

Both were diagnosed before anything was changed. U1's diagnosis contradicted the copy that
FOUNDER-WALK-4 shipped, and U2's turned out to be a defect in the *repo*, not in a database.

## Result at a glance

| Gate | Result |
|---|---|
| `pnpm --filter @goblin/shared typecheck` (CI gate) | clean |
| `pnpm --filter @goblin/web typecheck` (CI gate) | clean |
| `pnpm --filter @goblin/web build` (CI gate) | clean |
| Web unit tests (CI gate) | **373 / 32 files** — was 354 / 30 |
| API unit tests (CI gate) | **1566 / 148 files** — was 1551 / 146 |
| Money suites (real test-mode Stripe) | **ran — see "Money suites" below; read at job-log level, not from this table** |
| Web eslint | no new findings; `standalone-chat.tsx` back to the 2 pre-existing errors it carries on master (not a CI gate) |
| `node scripts/schema-drift-sweep.mjs` | exits 1 on 5 **pre-existing, unfixed** findings — see U2 §4 |

**Falsification** was run on the three load-bearing changes; each was reverted in place and
the suite confirmed red, then restored. Per unit below.

---

# U1 — the lock-screen copy made a claim the code could not keep

## 1. The truth for the founder's exact case: does the message exist in the DB?

**No. It does not exist, and no refetch could ever have produced it.**

This was established from the server side rather than argued, because the two candidate
states are indistinguishable from the transcript. `chat-sessions-runtime-abort.test.ts`
runs the real route against a model stream that outlives `CHAT_MAX_RUNTIME_MS`, with an
upstream generator that honours its abort signal the way a real provider SDK does.

Both branches, traced:

| Branch | What happens | Assistant row? |
|---|---|---|
| The model finishes **before** the 120s guard | `done` frame → the persistence branch at `chat-sessions.ts` writes the row | **Yes.** A refetch on return finds it. |
| The model is still streaming **at** 120s (the founder's turn) | `guard` fires → `abortController.abort()` → the loop's `if (signal.aborted) break` runs **before** the `done` case → the persistence branch is never reached | **No.** Tokens spent, answer discarded. |

The founder waited and nothing appeared, which is the second branch. So the instruction's
first fork applies: **the copy was a false claim and must never appear for an unrecoverable
turn.** The client-refetch fork does not apply — there was nothing to refetch. (The refetch
path already exists from FOUNDER-WALK-4 and is unchanged; it is what surfaces the *first*
branch correctly.)

This is exactly the contradiction the task named: the copy promised a completion that the
known 120s defect makes impossible.

## 2. Why the client said it anyway

`recoverTurn` reached `still-running` as a **fall-through**:

```
our message is in the transcript
+ no assistant message follows it
⇒ the turn must still be running
```

That inference is invalid. Absence of an answer is not evidence of a running turn; it is
equally the signature of a discarded one. Nothing in the system could tell the two apart,
and the code resolved the ambiguity in the flattering direction.

## 3. What was changed

### Commit `759214a` — the server stops discarding, and starts recording

**Two things, both server-side.**

**(a) A completion the model already produced can no longer be lost to the guard.** The
abort check sat *before* the frame was parsed and broke out on any aborted signal — so a
`done` that arrived in the gap between the generator yielding and the loop body running
(Node resumes a `for await` at an await point, which is exactly where a pending timer runs)
was thrown away. The loop now drains for a bounded window (`ABORT_DRAIN_GRACE_MS`, 5s)
after an abort and honours the trailing `done` in full.

Why honouring a post-abort `done` is safe and not partial-text persistence: `model-router.ts`
emits `done` only after the provider stream loop completes normally (lines 631, 741). An
aborted provider stream throws instead. A `done` frame is therefore the model's own
completion signal, never a truncated answer relabelled. **The deltas are never kept without
it** — that would be the actual sin, persisting a half answer as the finished one.

*My first cut of this got it wrong*, and the test caught it: I dropped post-abort deltas but
kept the `done`, which would have persisted a truncated answer as complete. The drain
semantics above are the corrected version.

**(b) Every turn's fate is recorded.** `services/chat-turn-registry.ts` holds
`running / completed / lost` + reason; `GET /api/chat-sessions/:id/turn-status` serves it.
`completed` is written from exactly one place — the line that puts the row in the
transcript — and a failed insert settles `lost`, because an answer nobody can read is lost
however cleanly the model finished.

**Honest limitation, shipped as behaviour not as a caveat:** the registry is process-local,
like `services/agent/run-registry.ts` and on the same deployment assumption (`apps/api/railway.json`
runs one long-lived `node dist/index.js`, so the process outlives the request). A restart or
a second replica loses the record — and then the endpoint answers **`unknown`, never
`running`**. Making it durable needs a table, i.e. a migration this repo authors but does not
apply; the honest degradation is what ships.

### Commit `3156e2e` — the client claims only what it verified

`recoverTurn` now asks `/turn-status` and reports what came back:

| Outcome | When | Resend offered |
|---|---|---|
| `still-running` | **only** when the server confirmed `state:'running'` | no |
| `lost` | the server recorded the turn as ended with nothing saved | yes |
| `indeterminate` | our message is on the server, no answer, server cannot account for the turn | yes |
| `never-arrived` | our message is not in the transcript | yes |
| `unreachable` | the transcript read failed | no |

**Standing rule 3 is enforced structurally, not by convention.** `"läuft weiter"` has exactly
one route: `lastStatus?.verified && lastStatus.state === 'running'`. A test iterates the four
unverifiable shapes — `null`, `unknown`, `verified:false`, and `completed`-without-a-visible-
answer — and asserts none of them can produce it.

The `lost` line is the founder's case and says so: *"Die Antwort ging verloren — der Lauf hat
auf dem Server sein Zeitlimit erreicht, gespeichert wurde nichts. Ich starte sie neu?"* It
never suggests reopening the chat, because nothing will be there. A `lost` verdict also ends
the recovery on the **first** look — every further poll is another second of the promise the
founder already sat through.

The retry re-runs the **original prompt** with the original `clientMessageId`, so the server
dedupes the user message and only the missing completion is re-run. Affordance labels are
per-state: a discarded turn is not `"wartet auf Verbindung"`, and a message that already
arrived is *re-started*, not *re-sent*. DE + EN throughout.

One correction found while wiring this: reaching `/turn-status` must **not** count as
"reached the server" for the never-arrived decision — only a transcript can tell us whether
our message arrived. A test caught it; a failed transcript read still lands on `unreachable`.

### Commit `4ebdbee` — the visual audit (task item 4)

Both chat banners picked their colour with a regex over the message text: anything not
mentioning an API key was painted in the danger palette. So the **whole** recovery family
arrived red-on-pink with an error border — the "ich prüfe …" progress line, the good-news
"läuft zu Ende" line, and the recoverable never-arrived line.

Two structural faults, not one bad colour:

1. **The tone was inferred from prose**, so any new string silently inherited whatever the
   regex thought of it. `lib/notice-tone.ts` makes tone a carried property; the text
   classifier survives only as the fallback for untagged upstream errors.
2. **The palette was hard-coded** (`#FCA5A5`, `#991B1B`) and did not follow the theme —
   those literals stayed light-mode red on the dark surface. Everything is now token-derived
   (`--info` / `--warning` / `--danger` via `color-mix`), ink on the theme-following neutral,
   matching the 10%-tint shape `/admin/insight` already uses.

Family audit result: `info` for `checking` and `still-running`; `warn` for `lost`,
`indeterminate`, `never-arrived`, `unreachable`, and the connection-blip retry; `error`
reserved for genuine failures. Applied to **both** chat surfaces
(`standalone-chat.tsx`, `workspace/ChatMessages.tsx`), which had drifted into two copies of
the same expression.

**Limitation:** `notice-tone.test.ts` pins the tone *module* and the recovery family's
mapping. The component wiring (that the banner reads `errorTone`) is covered by typecheck
and build, not by a rendering test — this repo's web vitest runs in the `node` environment
with no DOM.

## 4. Falsification

| Change reverted | Result |
|---|---|
| The drain window → back to `if (aborted) break` before the parse | `chat-sessions-runtime-abort.test.ts` — *"never discards a done frame the model already produced"* **fails** |
| The verified-state consultation → back to the `still-running` fall-through | `chat-recovery.test.ts` — **5 tests fail**, incl. *"a turn the runtime guard discarded is NEVER called pending"* and *"läuft weiter is reachable ONLY through a verified running state"* |

Both restored; suites green.

---

# U2 — `users.deleted_at` does not exist, and the notice was wrong

## 1. The two honesty defects, named

| Shown to the founder | Why it is wrong |
|---|---|
| "Die Tabelle `users` fehlt in der Datenbank" | The table is **not** missing — the whole app reads it constantly. One **column** was. A cause nobody observed, stated with confidence; the same failure mode as the retracted 401 verdict. |
| "Spiel Migration `(users.deleted_at — added out of band, no migration in repo)` ein" | A parenthetical engineering note about the repo's own history, rendered verbatim where a **filename** belongs. Nobody can open, paste or apply it. A notice whose action is unactionable is worse than no notice, because it reads as an instruction. |

## 2. Root cause — which of the two possibilities, with file:line

**The code was written against a column that never existed.** Not "added out of band and
lost".

Evidence:

- `grep -rn deleted_at supabase/migrations/` matches **nothing** across 0001–0100.
- `0042_gdpr_account_deletion.sql` is where the soft-delete design landed. It creates
  `account_deletions` (with `status`) and `deletion_audit_log`, and **never touches `users`**.
  The deletion state was deliberately put in its own table.
- The founder's own production 500 proves it was never applied to production either — an
  out-of-band column would still be there.

| Role | Site |
|---|---|
| write (set on request) | `apps/api/src/services/account-deletion.ts:186` |
| write (clear on reactivate) | `apps/api/src/services/account-deletion.ts:288` |
| read | `apps/api/src/routes/admin.ts:42` (`/admin/users` — **the 500**) |
| read | `apps/api/src/routes/admin.ts:159, :164, :171` (`/admin/stats`) |
| read | `apps/api/src/services/insight.ts:90` (`/admin/insight`) |

Why it surfaced as "one admin page 500s": both writes go through `.update()` **without**
`throwOnError()`, so the write side failed silently for the whole life of the feature. Only
the reads were loud.

## 3. The migration (commit `f734626`) — authored, NOT applied

`supabase/migrations/0101_users_deleted_at.sql`:

- `add column if not exists deleted_at timestamptz` — **nullable, no default**, so `NULL` =
  live and every existing row is valid the instant it lands under the `.is('deleted_at', null)`
  filters every reader already uses.
- **A backfill from `account_deletions`, which is not cosmetic.** Without it, applying the
  migration would add the column with every row `NULL` and silently **resurrect** every
  pending-deletion user into `/admin/users`, `/admin/stats` and the Insight funnel — a worse
  state than the 500, because it would look like it worked.
- A partial index on the live-users predicate.
- Idempotent, re-runnable.

**Pre-migration tolerance** (`apps/api/src/lib/users-soft-delete.ts`): the filtered read falls
back to the same read without the filter. This is *correct*, not merely tolerable — if the
column does not exist then nothing was ever written to it, so the filter is a no-op on every
row and the degraded read returns the same rows. `account_deletions` remains authoritative
and is untouched. The equivalence ends the moment 0101 is applied, which is why every caller
reports `degraded` upward (`schemaNotice`) instead of hiding it. The matcher is deliberately
narrow: a missing `users` **table** is not swallowed, because retrying could not fix it.

Applied to `/admin/users`, `/admin/users/:id`, `/admin/stats`, and the Insight users read.

## 4. Sweep for the same class (commit `0445aee`)

`migration_status.sql` asks *"did the migrations I wrote land?"* — it could never have caught
`deleted_at`, because there was no migration to check. That blind spot is the actual defect
class, so both halves were addressed:

- **`scripts/schema-drift-sweep.mjs`** — sweeps every Supabase query-builder read in
  `apps/api` and `apps/web` against the full migration text; no database needed; exits 1 on
  findings. Its header states its own limits: lexical, a column counts as covered if its
  *name* appears anywhere in the migration set, and raw SQL / dynamic names are invisible.
  A clean run means "no completely unauthored object found", **not** "the schema is correct".
- **`migration_status.sql` Part 2** — the same findings, checked against a live database.
  Rows read `PRESENT (out of band)` / `*** ABSENT ***`, not APPLIED/MISSING, because there is
  no migration to apply either way. A worklist, not a status board.

**What it finds today — reported, NOT fixed in this branch:**

| Object | Read at | Effect if absent |
|---|---|---|
| `users.advanced_mode` | `routes/users.ts:50` | **LOUD** — `/api/users/me` select fails → 404 "User not found" |
| `build_runs.commit_message` | web project hub `page.tsx:66` | silent — deploys list renders empty |
| `agent_runs.error_message` | web `admin/health/page.tsx:49` | silent — reads as "no errors" |
| `free_api_usage.user_id` | `routes/models.ts:140` | **0008 never creates it, yet 0021 indexes it — 0021 cannot apply to a clean database** |
| `free_api_usage.used_today` | `routes/models.ts:140` | silent — falls back to defaults |
| table `vercel_tokens` | `services/support-agent.ts:132` | silent — reports no Vercel connection |

**What I can and cannot claim about these.** Verified: no migration in this repo creates
them. *Not* verified: whether they exist in production — I have no database access, and unlike
`deleted_at` there is no founder-observed 500 to settle it. (`advanced_mode` is loud enough
that the app working at all suggests it is present out of band, but that is inference, not a
reading.) Either way the repo cannot rebuild the database, which is the defect.

**The sweep is deliberately NOT wired into CI.** It exits 1 on the five open findings, so
adding it as a gate today would either break the build or have to be neutered into a check
that passes while the drift stands.

## 5. The notice (commit `f734626`)

Fixed at the **shape**, not the string. `InsightReadError` now carries `missing`
(`{kind:'table'}` vs `{kind:'column', column}`) and a real filename, and the API returns
`missing` in the body. `apps/web/lib/schema-notice.ts` renders each case:

- a missing **column** says *"Die Tabelle `users` ist da — die Spalte `deleted_at` fehlt"*,
  positively, so nobody hunts for a table that exists;
- `isRealMigrationFile()` refuses to print anything that is not `NNNN_name.sql` as something
  to apply, and degrades to naming the object and the folder — still actionable, and true;
- real filenames everywhere, including `platform_events` (was `"0078 + 0085"`, a reference
  rather than something to open).
- **DE + EN.** The admin surface was DE-only, which was fine while the copy was one
  hard-coded sentence and is not fine now that it carries a diagnosis.

`schema-notice.test.ts` asserts the founder's exact false sentence is unreachable for a
column gap in both languages, and that the exact placeholder he was shown cannot survive
into the instruction.

## 6. Falsification

| Change reverted | Result |
|---|---|
| `readUsersTolerant` in `insight.ts` → back to the bare filtered read | `admin-insight-degrade.test.ts` — *"recovers from the users.deleted_at gap instead of failing the page"* **fails** |

Restored; suite green.

---

# Money suites

Real test-mode Stripe, from the job log — not inferred from a green summary:

```
✓ plan-change for existing subscribers (real test-mode Stripe)
    PROOF 1 upgrade Build→Pro uses subscriptions.UPDATE; exactly ONE active sub    8225ms
    PROOF 2 downgrade Pro→Build credits proration; still exactly one active sub    5476ms
    PROOF 3 GUARD — existing subscriber on the SUBSCRIBE path creates no 2nd sub   4611ms
    PROOF 4 a genuinely NEW user still subscribes via the original create path     4192ms
    PROOF 7 portal path healthy                                                     806ms
✓ immediate-proration (always_invoice) — real test-mode Stripe
    PROOF A upgrade → proration invoice created AND PAID NOW; amount == preview    7799ms
    PROOF B declined card on the immediate proration → throws; sub UNCHANGED       8323ms
    PROOF C downgrade → $0 due now + credit; sub is Build                          5854ms
✓ account-deletion canonical service (real test-mode Stripe)
    PROOF 1..5 (soft-delete + 10d schedule, cancel retries, reactivate, purge,
                BLOCK path with a live sub)                                       24551ms
✓ src/services/money-suite-guard.test.ts (1 test)
```

Non-zero durations against live Stripe are the evidence they were not skipped.
`account-deletion` PROOFs 1/3/6 exercise the soft-delete write path this branch touches and
are unaffected.

---

# What is NOT proven

- **No device walk.** No iPhone in this environment. U1 is proven at the unit level against
  the real route and the real recovery module; the on-device sequence is the founder's to
  re-run.
- **No database.** 0101 is authored, not applied — by rule. `migration_status.sql` Part 2 and
  the drift sweep were written *because* I cannot read the live schema; they are the
  instrument, not a result.
- **The five drift findings are open**, listed above, deliberately not fixed here.
- **The tone fix is pinned at the module level**, not by a rendering test — see U1 §3.
- **`/turn-status` is process-local.** Across a restart or a second replica it answers
  `unknown`, and the client renders honest uncertainty with a retry rather than a claim.
