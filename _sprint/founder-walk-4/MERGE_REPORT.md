# FOUNDER-WALK-4 — Merge Report

**Branch:** `claude/lock-screen-admin-insight-t0ldfw` (from fresh master `9e92d8e`)
**Two units, two isolated revert-ready commits.**

Both defects were re-derived from scratch, not iterated. Neither fix is a variant of
the one that preceded it: U1's previous fix was aimed at the wrong *writer*, and U2's
500 turned out to be unreadable **by construction** rather than caused by any one thing.

## Result at a glance

| Gate | Result |
|---|---|
| `pnpm --filter @goblin/web typecheck` (CI gate) | clean |
| `pnpm --filter @goblin/web build` (CI gate) | clean |
| Web unit tests (CI gate) | **347 / 30 files** — was 318 / 29 |
| API unit tests (CI gate) | **1551 / 146 files** — was 1546 / 145 |
| Money suites (real-Stripe: proration / subscribe / tier) | **see "Money suites" below — must be read at job-log level, not from this table** |
| Web eslint | 135 errors before, 135 after — **no new**, all pre-existing (not a CI gate) |
| Root `tsc -p tsconfig.json` | +8 errors, all the pre-existing "root config cannot resolve apps/web's `@/` alias" class; the alias-aware gate above is clean |

**Falsification** was run for both units — each fix was reverted in place and the
suite confirmed red, then restored. Details per unit.

---

## U1 — the lock-screen defect: the answer WAS found, then overwritten

Commit `7fb732c` — `fix(chat): the lock-screen answer was found and then overwritten`

### The forensic step that redirected the whole diagnosis

The founder's string is not generic. **"Die Verbindung hat kurz gehakt — bitte versuch
es erneut" is `BLIPPED.de` in `friendly-error.ts`, and `connectionErrorMessage()`
returns it on exactly one path: `navigator.onLine !== false` AND a live `/health` ping
answering 200.**

That line therefore *cannot* be written while the phone is asleep or offline. It was
written **after the founder unlocked the phone**. So the dead stream's `catch` was
still running at thaw — and it wrote last.

That single fact rules out the entire category the previous fix addressed (the server
discarding the answer) and points at an ordering problem on the client.

### What is actually lost — each of the three candidates, answered

| Candidate | Verdict |
|---|---|
| The request is killed by iOS suspension before reaching the server | **Possible, and now detected at runtime rather than guessed.** The recovery compares the server transcript against the prompt in flight: our message absent ⇒ `never-arrived` ⇒ the only case that offers a resend. |
| The server completes but the response has nowhere to land | **Confirmed as the founder's case** — `chat-sessions.ts` finishes and persists on a disconnect (that half of the previous fix holds), and the client's recovery *did* find it. It then lost the race. |
| The client holds a dead stream it never retries | **Confirmed, and worse than "never retries":** under one common iOS behaviour the recovery never fired at all. See Defect 2. |

### Defect 1 — two writers, one piece of state, no rule between them

At thaw, both of these wake up and both write `error` / `sendFailed`:

```
thaw ─┬─ visibilitychange → recoverAfterDisconnect() → import + getSession + fetch
      │                                              + up to 5 polls → setError(null)
      └─ frozen socket's rejection → catch → await connectionErrorMessage()  (3s
                                            health-ping budget) → setError(BLIPPED)
```

Last writer wins, and the recovery path is by far the slower of the two. The recovery
could do everything right — find the finished answer, adopt the transcript, clear the
banner — and be overwritten milliseconds later by a turn that had already been
superseded. Nothing in the component said *this turn is over, its writes no longer
count*.

**Fix:** `createTurnGuard()` in `lib/chat-recovery.ts`. A recovery retires the turn's
epoch; its terminal writes are refused from that moment, permanently. Frames that
*arrived* (delta / done / server-error) are still applied — they came over a socket
that is demonstrably alive, and the recovery backs off when it sees one. The one
writer that must yield is the local connection-failure verdict, which is a *guess
about a socket*, not a message from the server.

### Defect 2 — the trigger depended on an event surviving a freeze

`createResumeDetector` recovered only when it had **measured** a long hide. But a
`visibilitychange` delivered to a page iOS has already suspended runs at **thaw**,
reads `document.visibilityState === 'visible'`, and takes the return branch with no
recorded hide at all → `force: false` → **the recovery never fires**.
`resume-on-return.test.ts` pinned that as intended behaviour.

**Fix:** the decision now uses the local stream's **silence**, which a freeze cannot
hide (`shouldAskServerOnReturn`). `ResumeVerdict` reports `hiddenForMs: null` — "no
measurement" — as distinct from a short hide, so the two can never be conflated again.

### Honest limitation, stated plainly

**An in-flight `fetch` does not survive iOS suspending the app.** There is no
client-side trick that keeps the SSE socket alive through a screen lock, and nothing
in this commit pretends otherwise. What is fixable is everything *after*: the server
finishes and persists, and on return the client asks the server and reports only what
it saw. Three truths, three lines, replacing one vague "try again":

| Server said | Copy | Resend offered? |
|---|---|---|
| the answer is there | *(silent — it just appears)* | — |
| our message arrived, no answer yet | "läuft auf dem Server zu Ende — öffne diesen Chat gleich nochmal" | **no** — that work is already paid for |
| our message is not there at all | "hat den Server nie erreicht … schick sie einfach nochmal" | **yes** — the only case where it is true |
| could not ask | "Der Server war nicht erreichbar …" | no |

### Proof

`lib/chat-recovery.test.ts` (19 tests) replays the device sequence — send → freeze →
late rejection → return — with the rejection landing **before**, **during** and
**after** the recovery, plus the no-hide-measurement case, plus the "a slow first
token must not be mistaken for a dead stream" case. Clock- and sleep-injected, so it
runs in the `node` environment the web vitest config uses.

**Falsified:** restoring last-writer-wins (drop the `recovering` check in `mayFinish`,
stop retiring the epoch in `endRecovery`) turns exactly the two ordering tests and the
guard test red — `rejection lands DURING`, `rejection lands AFTER`, `refuses a
superseded turn its terminal write` — while `rejection lands FIRST` stays green,
because in that one interleaving the recovery legitimately writes last. The suite
discriminates; it does not just assert "green".

### Not fixed, and why — the 2-minute server guard

`CHAT_MAX_RUNTIME_MS` (default 120s) aborts the upstream model stream, and the loop's
`if (abortController.signal.aborted) break` exits **before** the persistence branch.
A turn that legitimately runs longer than two minutes is therefore still discarded —
the same class of loss the previous fix closed for disconnects, on a different trigger.
Left unfixed deliberately: the only cheap repair is to persist the partial text, and
an incomplete answer presented as complete is a worse lie than an honest failure. It
is bounded (a normal chat turn is seconds) and it is **not** the founder's reported
symptom. Flagged here rather than silently expanded into this unit.

---

## U2 — /admin/insight 500: unreadable by construction

Commit `3c90efe` — `fix(admin): /admin/insight's 500 was unreadable by construction`

### What was verified against production (9e92d8e, build 2026-08-06T07:56Z)

A logged-out `GET https://www.justgoblin.com/api/admin/insight` answers:

```
x-matched-path: /api/admin/[...path]
403  {"error":"Forbidden"}
```

`403 Forbidden` is the **proxy's own** gate (`route.ts`), not Hono's `401
Unauthorized`. **PR #72 worked; the proxy is reached.** The failure is behind it.

### The 500 could not be read, at three separate layers

| Layer | What it did |
|---|---|
| `admin.ts` `/insight` | `catch → { error: <message> }` |
| `insight/page.tsx` | read **`detail`** — a key only the *web proxy's* body carries — and only on status 500 |
| `admin-error.ts` | → `"Konfigurationsfehler — …"`, asserting a **cause nobody had observed** |

The third one is the retracted 401 verdict's failure mode, one surface down.
"Konfigurationsfehler" is true for the proxy's own `admin_key_unconfigured` and false
for an API read failing behind it — and it sends the founder back to the env vars they
had already spent days verifying.

### What the code proves about the 500 itself

- `/api/admin/insight` is the **only** admin endpoint that reads `platform_events`
  (`/telemetry` → `completion_costs`, `/users` and `/stats` → `users`, `/health` →
  `projects`). That is exactly the shape of "one admin page 500s, the others work".
- `buildInsight` was the **only** admin data path that turned a Supabase read error
  into a throw, and this the only handler with a blanket catch → 500.
- `platform_events` comes from migrations **0078 + 0085**, both of which state "NOT
  applied automatically — founder applies via Supabase SQL Editor", and which
  `GOBLIN_CONSUMPTION_LEDGER.md` records as authored-not-applied. Every **other**
  consumer of that table is pre-migration tolerant by contract
  (`insertPlatformEvent` silent-fails; `/admin/promo` answers `available: false`).
  Insight was the sole hard-failing one.

### What is NOT proven — and is not claimed

**Which read fails in the live database.** Reading the production schema needs the
admin key or a direct DB probe; this environment has neither, and the probe attempt
was blocked by the sandbox. `users.deleted_at` is a second candidate — it is filtered
on here *and* in `/admin/users`, yet **no migration in this repo creates it**.

So the fix is **not** a guess at the table. The endpoint diagnoses itself:

- a missing table/column → **200** with `available:false`, the table, and the
  migration to apply (the `/admin/promo` pattern);
- anything else → **500** naming which read failed, in **both** body keys the web side
  has ever read.

Either way the founder now gets the actionable sentence on screen. The page renders it
as a named migration notice and deliberately **not** an empty funnel: "0 registriert"
and "I cannot see the data" must never look the same.

**One command that settles it** (founder, with the admin key — this is the
discriminator this diagnosis could not run):

```
curl -s -H "x-admin-key: $ADMIN_API_KEY" \
  https://goblinapi-production.up.railway.app/api/admin/insight?days=7 | head -c 400
```

`{"available":false,…}` names the missing table + migration. A 500 body now names the
failing read. A `401` means the key is wrong, nothing more.

### The other admin pages behind the proxy have the same fault — several worse

All eight audited (`builds`, `catalog`, `insight`, `models`, `promo`, `status`,
`telemetry`, `users`):

| Page | Fault found | Now |
|---|---|---|
| builds, catalog, promo, status | **swallowed a failed load entirely** (`if (res.ok)` with no `else`) — a 403/500 rendered as an empty list, indistinguishable from "no data". The FW3 U5 defect, on the four pages FW3 never touched. | shared `AdminErrorState` with the server's own words |
| models, telemetry, users | kept the status, discarded the server's reason | detail threaded through |
| insight | the three-layer drop above | fixed + `available:false` state |
| costs | already used `AdminErrorState` | unchanged |
| health, rankings | **not behind the proxy** (direct API/DB reads) — out of this unit | noted, unchanged |

One `readAdminErrorDetail(res)` now reads both body shapes, so no page has to know
which layer answered. `isMissingSchema` replaces three drifted copies of the same
regex — the promo route's copy did not recognise a missing **column**, only a missing
table.

### Proof

`admin-insight-degrade.test.ts` (5 tests). **Falsified:** restoring the bare
`{ error: e.message }` 500 turns 4 of the 5 red.

---

## Money suites

**Read this at job-log level, not from the table above.** The real-Stripe suites
(proration / subscribe / tier) run only when `STRIPE_SECRET_KEY` and the three
`STRIPE_PRICE_*` secrets are present. GitHub sets `CI=true`, which arms
`money-suite-guard.test.ts` — it **fails the `api-tests` job** if those secrets are
missing, so a green build cannot hide a silent money-test skip.

They cannot run in this sandbox (no Stripe test credentials, and obtaining them is a
founder-credential action). The gate that matters is the **`API unit tests (incl.
build-loop net)` job log on the PR**, which is where the guard and the money suites
actually execute. This unit touches `apps/api/src/routes/admin.ts`,
`apps/api/src/services/insight.ts` and a new `apps/api/src/lib/schema-shape.ts` —
none of them on a billing path — but the job log, not that reasoning, is the gate.

## Files

**U1** — `apps/web/lib/chat-recovery.ts` (new), `chat-recovery.test.ts` (new),
`lib/resume-on-return.ts`, `lib/resume-on-return.test.ts`,
`components/chat/standalone-chat.tsx`.

**U2** — `apps/api/src/lib/schema-shape.ts` (new),
`apps/api/src/routes/admin-insight-degrade.test.ts` (new),
`apps/api/src/routes/admin.ts`, `apps/api/src/services/insight.ts`,
`apps/web/lib/admin/admin-error.ts` + test, and the eight `app/admin/*/page.tsx`
surfaces listed above.

## What still needs the founder

1. **U1 on device.** Chat task → lock → return. Expected: the answer simply appears,
   or one of the three named lines — never "die Verbindung hat kurz gehakt". If the
   line that appears is "hat den Server nie erreicht", that is the request dying before
   it left the phone, and it is now stated rather than hidden.
2. **U2 on device.** Open `/admin/insight`. Expected: either the dashboard, or a
   named migration notice, or a 500 that says which read failed — never a bare
   status. Whatever it says is the answer this diagnosis could not obtain remotely.
