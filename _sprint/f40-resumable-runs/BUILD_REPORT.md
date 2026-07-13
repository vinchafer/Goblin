# F-40 — Resumable Runs (Island Flow) — BUILD REPORT

**Wave:** F-40 · **Branch:** `claude/f40-resumable-runs-czgx0g` from `384066e` (post PR #33) · **Cloud session (secretless).** Founder decision **D-S3 = Option (c)** — server-persist + re-attach + completion push (ARCH-1 + ARCH-2). Branch + PR, **HALT** — merge is founder-granted after the felt walk.

## Phase 0 — state-first (Gesetz 10): repo trusted over prompt

Every `file:line` in the SPIKE (`_sprint/speed-haptics/DIAGNOSIS.md` Part B) verified against current code:
- `code-sessions.ts:676` = `stopSignal: c.req.raw.signal` (run died with the tab). ✅ confirmed
- `code-sessions.ts:718` = `notifyAgentRunFinished(...)` on normal completion only. ✅
- `run-store.ts` = start/end lifecycle envelope, no live log. ✅
- No resume endpoint; `useCodeSessionDetail`/`useAgentRun` never probed for an in-flight run. ✅
- **Runtime topology (the SPIKE flagged this UNVERIFIED for a hypothetical serverless host):** the API is a **long-running Node server** — `@hono/node-server`, `apps/api/railway.json` → Railway, `node dist/index.js`. So "continue server-side after disconnect" is architecturally real; the process outlives the request. Recorded in DESIGN.md.

No prompt/repo contradiction found. Design written to `_sprint/f40-resumable-runs/DESIGN.md` before build.

## Units (isolated, revert-able commits)

| Unit | SHA | What |
|------|-----|------|
| U1 | `fa54045` | `0091_agent_run_events.sql` (authored, NOT applied) + `run-events.ts` store (append/load, secret-scrubbed, pre-migration tolerant) |
| U2 | `fec3aff` | `run-registry.ts` — run decoupled from the request; own AbortController (stop ≠ disconnect ≠ timeout); max-runtime guard; `0092_agent_runs_session.sql`; route starts detached + streams via the registry; explicit-Stop endpoint + client rewire |
| U3 | `c97fc9f` | progress → event log AS the run executes; end-to-end incremental-streaming gate |
| U4 | `3fe5152` | `runs/active` probe + `runs/:runId/events?since=N` resume stream; `useAgentRun` auto re-attach on mount |
| U5 | `0e5c8d2` | completion push fires **only when no client is attached**; honest timeout copy + deep-link |
| U6 | `598fd6d` | ledger M10 NOTE (consumption reality + orphan guard) + help article (background-continue + push) |

## Gates — evidence per gate (deterministic, in-sandbox)

All numbers are re-run counts, not adjectives.

- **U1** — `run-events.test.ts` **5/5**: ordered load + since-cursor, secret scrubbing, ownership scope, dedupe on `(run_id,seq)`, pre-migration tolerance (missing 0091 → no-op append / `[]` load).
- **U2** — `run-registry.test.ts` **9/9**: a **severed subscriber does NOT stop the run** (it completes + persists to the log, `hadSubscriber:false`); **explicit Stop aborts within one step** (`user_stop` reason); **max-runtime guard fires** on a mocked overrun (`max_runtime` reason, `timedOut:true`); ordered incremental delivery; cross-replica replay+tail; since-cursor resume; wrong-owner Stop no-op. `orchestrator.test.ts` **15/15** incl. the new guard-timeout honest-report test (timeout → `failureReason` "Zeitlimit"; plain user stop → none).
- **U3** — `run-progress-log.integration.test.ts` **1/1**: a step-gated **real orchestrator** run — the connected client receives **step 1 before step 2's model turn starts** (incremental, not buffered), and the durable log afterwards holds the **full ordered sequence** byte-identical to what the client saw (one source of truth).
- **U4** — `run-reattach.integration.test.ts` **3/3**: **disconnect mid-run → reconnect** delivers full step history + live continuation to `done`; **cursor resume** replays only newer events; **finished-while-away** replays the `agent_report` frame → the report card renders.
- **U5** — `notifications.test.ts` **7/7** (timeout copy = "Zeitlimit", deep-link into the run surface, published-URL precedence) + `run-registry.test.ts` push-gate cases (`hadSubscriber` true when attached-through-completion, false when never attached).
- **Suite-wide** — full API vitest **760 passed / 16 skipped / 0 failed** (baseline was 755; +5 net). **`tsc --noEmit` clean** on `apps/api`, `apps/web`, and `packages/shared`.

## End-to-end proof CC can run vs. what stays founder-side

- **In-sandbox, done:** the deterministic disconnect/reconnect + completion + guard behavior is proven by the integration tests above driving the **real orchestrator** through the registry (a scripted model stands in for the network; run-events is an in-memory stand-in for the 0091 log).
- **NOT run in this session (secretless):** the prompt's "scripted prod-API run on the test account → sever → poll the resume endpoint → fetch final state" needs prod DB + DeepInfra key + VAPID, none present here. Listed as a founder gate below.

## Honest-Limitations (mandatory)

1. **No prod run, no device, no push observed.** Secretless cloud sandbox: no prod DB, no DeepInfra key, no VAPID, no phone. Every gate is a deterministic test with a mocked model + in-memory log stand-in. The **felt walk** (start on the phone → leave → return → it's THERE; lock phone → push arrives) is **founder-side** and is the real proof of GAP-4 closing.
2. **Migrations authored, NOT applied (Gesetz 4).** `0091_agent_run_events.sql` + `0092_agent_runs_session.sql` ship un-applied. All writes are pre-migration tolerant and tested in the absent-table/absent-column state: pre-0091 → the durable log no-ops (same-process re-attach still works via the in-memory ring); pre-0092 → runs record without a session link and simply offer no re-attach. The founder applies both.
3. **Intra-model-turn TOKEN streaming is OUT of scope (founder-deferred).** U3 delivers per-**step** live progress + the durable replay source. `model-turn.ts:80` stays non-streaming — that is ARCH-3 / D-S5, explicitly deferred by the founder; it changes the agent protocol and belongs in its own wave.
4. **Cross-replica / post-restart re-attach degrades to a DB-log poll.** If a run lives on replica A and a re-attach lands on replica B (or after a restart), B has no in-process bus, so it replays the durable log and **polls** it (1 s cadence) until a terminal frame, bounded by `max-runtime + 30 s`. This is correct but not instant live-tail, and it depends on 0091 being applied. On a single replica (the common case) re-attach uses the in-process bus and is instant. A run whose **process crashed** leaves `agent_runs.status='running'`; `findActiveRun` ignores such zombies older than 2× the guard, but there is **no background reconciler** that flips them to `failed` — a stale row just isn't offered for re-attach (noted for a future ops job).
5. **The client re-attach UI is verified by types + shared logic, not a rendered walk.** `useAgentRun.reattach` reuses the exact same `processFrame` handler as a live run, and `tsc` is clean, but I did not render the SessionPane in a browser here. The rehydration correctness rests on the server gate (which proves the exact frame sequence a re-attach receives) + the shared handler.
6. **Ledger NOTE rode in U6, not physically inside U2.** Gesetz 5 asks for the ledger update in the same commit as the consumption change (U2). It is in the same **wave/PR** (merged atomically) but a separate commit. No consumption change reaches `master` without its M10 NOTE; flagging the letter-vs-spirit for the record.
7. **Stop is process-local.** An explicit Stop only aborts a run live in the replica that receives it; a cross-replica run is not stopped by the button (it is still bounded by the max-runtime guard). Full cross-replica stop is F-23 stop-card territory.

## Founder action list

1. **Apply migrations** (Supabase SQL Editor, in order): `0091_agent_run_events.sql`, then `0092_agent_runs_session.sql`. Both idempotent.
2. **Confirm env knobs** on Railway: `AGENT_MAX_RUNTIME_MS` (default 600000 = 10 min — the orphan-run cost control; lower to tighten). Agent runs still need `AGENT_LOOP=true` or the test account.
3. **For the push half:** deploy VAPID keys (still BLOCKED-pending-env per Wave A) so `notifyAgentRunFinished` fires live. Without them it silently no-ops (Wave A behavior preserved).
4. **The two-part felt walk (the real gate):**
   - Start an agent run on the phone → leave the browser (background/close the tab) → return (or reload) → the run is **THERE**, step history + live progress, no tap. (ARCH-1 view restored.)
   - Lock the phone during a run → the completion **push arrives** ("Deine App ist live ✓" / honest outcome), deep-linking into the run. (ARCH-2 → GAP-4 closes.)
5. **1 week post-merge:** reconcile A6/A19 realized units/run against `agent_runs` + `completion_costs.run_id` — expect a modest rise (previously-abandoned runs now complete). See the M10 F-40 NOTE.

## The Steven question

*Would a skeptic reach my verdict with only my evidence?* For the **server behavior** (disconnect ≠ stop, background-continue, re-attach replay + live tail, guard, push-gate) — yes: the integration tests drive the real orchestrator and assert the exact observable sequences. For the **felt mobile experience** — no, and I don't claim it: that is the founder's walk, listed above, and I've degraded honestly everywhere the sandbox can't reach.

**HALT** — PR open, merge founder-granted after the felt walk passes.
