# F-40 — Resumable Runs (Island Flow) — DESIGN

**Wave:** F-40 · **Branch:** `claude/f40-resumable-runs-czgx0g` · **Founder decision:** D-S3 = Option (c) — server-persist + re-attach + completion push. Authorized architectural wave (ARCH-1 + ARCH-2).

State-first (Gesetz 10) verified against current code — every `file:line` in `_sprint/speed-haptics/DIAGNOSIS.md` Part B confirmed:
- `code-sessions.ts:676` → `stopSignal: c.req.raw.signal` (run dies with the tab). ✅
- `code-sessions.ts:718` → `notifyAgentRunFinished(...)` fires only on normal completion. ✅
- `run-store.ts` persists only a start/end lifecycle envelope (no live event log). ✅
- No resume/re-attach endpoint; `useCodeSessionDetail` never probes for an in-flight run. ✅
- **Runtime topology confirmed:** the API is a long-running Node server (`@hono/node-server`, `apps/api/railway.json` → Railway, `node dist/index.js`). This makes "continue server-side after disconnect" architecturally real — the process outlives the request. (The DIAGNOSIS flagged this UNVERIFIED for a hypothetical serverless host; the repo says Railway.)

## The reframe: run lives in a process-level registry, not in the request

Today: `route → streamSSE → runAgent(stopSignal = request.signal)`. The computation lives and dies inside one HTTP request.

New: a **process-level run registry** (`services/agent/run-registry.ts`) owns each run:
- its own `AbortController` — **the STOP signal, distinct from the request/disconnect signal** (disconnect ≠ stop, the core requirement);
- an in-memory event ring + a monotonic `seq` counter (fast live tail + replay);
- a set of live subscriber sinks (currently-attached SSE streams);
- a max-runtime timer;
- the final `RunResult` kept briefly for late re-attach.

The route no longer passes `c.req.raw.signal` as the stop signal. Instead:
1. **Start** — `POST …/agent` builds the prompt context (request-time work, unchanged), creates the `agent_runs` row, then hands `runAgent` to the registry to run **detached** (not awaited by the request). The route then **attaches** the current request as a subscriber and streams events. Client disconnect (`c.req.raw.signal` aborts) only **detaches the subscriber** — the run keeps going.
2. **Stop** — `POST …/agent/:runId/stop` → registry aborts THAT run's `AbortController` → orchestrator sees `stop.aborted` → outcome `stopped`. This is the architecturally-distinct explicit stop (preserves F-23 stop-card semantics).
3. **Max-runtime guard** — a registry timer aborts the controller with reason `max_runtime` after `AGENT_MAX_RUNTIME_MS` (default 600000 = 10 min). The orchestrator reads `signal.reason` and lands an honest timeout report.

## One source of truth: the event log (avoids the F-29 parallel-plumbing anti-pattern)

Every event the orchestrator emits (`agent_narration | agent_plan | agent_step | agent_report`) plus control frames (`meta | done | error`) flows through the registry's `emit`, which:
- assigns the next `seq`,
- appends to the in-memory ring,
- appends to `agent_run_events` (durable replay source; pre-migration tolerant — table absent → in-memory only, honest no-op),
- fans out to every live subscriber.

**All streaming — the starting request AND every re-attach — reads from this one path** (`streamRunEvents(runId, sinceSeq, sink)`): replay persisted/ring events since `sinceSeq`, then live-tail (in-process bus if the run is local to this replica; else DB-poll the event log until the run's DB status is terminal — cross-replica safe). No second live mechanism is built.

## Re-attach (U4)

- `GET …/runs/active` → the session's currently-active run `{ runId, status }` or `null` (client mount probe).
- `GET …/runs/:runId/events?since=N` → SSE that replays events since `N` then live-tails (the re-attach stream). If the run already finished, it replays the terminal frames (incl. `agent_report`) and closes → the returning client renders the report card.
- Client: on mount, `useAgentRun` probes `runs/active`; if a run is live it opens the events SSE and rehydrates step history + live progress. Finished-while-away → the persisted `agent_report` frame renders the report card. Guard/failed → honest failure card.

## Completion push (U5)

Moved into the registry's completion path (was inline in the route). When a run reaches a terminal state and **no subscriber is attached**, fire `notifyAgentRunFinished` (env-gated, silent-degrade without VAPID — Wave A behavior preserved exactly). When a client is attached it already saw the live report → no push. Aborted-by-disconnect runs now reach completion server-side, so they DO get the push (closes the B.4 gap-1).

## Consumption reality (U6)

No new token mechanism. But runs that previously died on disconnect now **complete** → tokens that were abandoned are now spent. The cost control is `AGENT_MAX_RUNTIME_MS` (the orphan guard). Ledger M10 gets a NOTE; help corpus article on agent runs documents background-continue + push.

## Explicitly out of scope (founder-deferred)

- **ARCH-3 / D-S5 — native-tool token streaming** (`model-turn.ts:80` non-streaming). U3 delivers per-**step** live progress + the durable event log (which already streamed per-step to connected clients); intra-model-turn token streaming is a separate deferred wave and is NOT touched here (would change the agent protocol).
- **TTFT (ARCH-4), nav caching (ARCH-5)** — separate waves.

## Gates (deterministic, in-sandbox)

- U2: integration test — start run, sever the subscriber stream, run still completes + persists; explicit stop aborts within one step; runtime guard fires on a mocked overrun.
- U3: scripted multi-step run — client receives step events incrementally; the log holds the full ordered sequence afterward.
- U4: simulated disconnect/reconnect — reconnected sink renders full history + subsequent live events; finished-while-away replays the report card.
- U5: unit — push on unattached completion (correct payload), not on attached, silent no-op without env.
- Full API suite green + `tsc` clean.

## Founder gate (felt, out-of-sandbox)

Apply migration `0091`; then the two-part felt walk: (1) start a run on the phone → leave the browser → return → it's THERE (view restored); (2) lock the phone → the push arrives = GAP-4 closes.
