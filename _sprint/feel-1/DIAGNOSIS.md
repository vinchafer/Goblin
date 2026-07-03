# FEEL-1 Phase 0 — Diagnosis

Date: 2026-07-02. Branch `feel-sprint-1-2026-07-02`.
Note: `FEELING_GRADING_2026-07.md` was not found anywhere on this machine (searched project tree, sibling project dirs, Desktop/Downloads/Documents). Diagnosis and sprint executed from the sprint prompt + `walk-evidence/` (OBSERVATIONS.md, RAW_LOG.md, TIMINGS.md, transcripts).

---

## D1 — Outage confirmation (server side)

**Access constraint:** No Railway CLI/token exists on this machine (searched env files, password store; `railway` not installed, `~/.railway` has no session) and the Chrome extension for dashboard access was not connected. Railway request logs/metrics could NOT be pulled directly.

**Indirect server-side evidence (strong):**
- `GET /health/deep` at 2026-07-02T18:02:26Z returned `uptime: 150576` seconds. The `uptime` counter is process-lifetime (`START_TIME = Date.now()` at module load, `apps/api/src/routes/health.ts:7`).
- Process start = 2026-07-02T18:02:26Z − 150,576s = **2026-07-01T00:12:50Z**.
- Both walker outage windows (2026-07-01 18:05–18:11 UTC and 20:09–20:12 UTC) fall INSIDE this uninterrupted process lifetime.

**Conclusion:**
- **No crash, no OOM kill, no restart, no deploy** of the API service occurred during or between the two outage windows — the same Node process served before, through, and after them. Railway's `restartPolicyType: ON_FAILURE` would have produced a fresh process (uptime reset) on any crash.
- The one edge-level "upstream error" the walker recorded at ~20:09 local (18:09 UTC, first window) is therefore NOT a dead process. Remaining candidates: Railway edge/network blip, transient event-loop stall, or walker-side connectivity. The walker's other symptoms (intermittent single-request timeouts at 22:26 and 06:06, spread over 8+ hours) are consistent with client-side/network flakiness.
- Without request logs we cannot 100% exclude a brief app-level stall, but there is **no identified server-side defect to fix**.

**Gate decision: P0.1 is OUT of scope.** Recorded: *client-resilience is the real workstream* — implemented in this sprint as P0.4 (idempotent create + honest error copy) and P0.5 (chat-send resilience). Follow-up ticket filed for observability (no log access = diagnosis by inference; the platform should have reachable logs/metrics for the founder’s tooling).

## D2 — Truncated-serve re-verification

**Method:** temporary GitHub Actions workflow `d2-deploy-poll.yml` (cloud runner, NOT local): triggers a real deploy of test project "Habit Tracker Walk" (`7b8408d5`, account vinc.hafner3) through the normal `POST /api/deploy/vercel` pipeline, then polls the returned URL every 5s for 5 minutes logging HTTP status + byte length + SHA-256. Three cycles.

**Result (run 28611500452, 2026-07-02T18:07–18:22Z, evidence/d2-poll-log.txt):**
- 3 deploys, each SSE `success` in ~9s.
- **63 polls returned HTTP 200 — every single one byte-identical: 5,471 bytes, SHA-256 prefix `a07fb2d7`,** matching the same URL fetched independently afterwards. The FIRST poll (5ms after the success event) already served the complete, correct file.
- 114 polls returned 403 with ~33KB variable bodies, starting after ~168s of continuous 5s-interval polling in iteration 1 and covering iterations 2–3: that is Vercel's bot/rate protection blocking the GitHub-runner IP (challenge page), not a content problem.

**Verdict:** the platform did NOT serve truncated or stale content after reporting Live — not even once, not even in the first seconds. The walk's 7,870-byte truncated read (~2 min after Live) was a **client-side transfer artifact** of the walker's flaky connection.

**Calibration for P0.2:** no propagation wait needed. Verification = fetch entry URL (expect 200 + entry-content hash match) + HEAD/GET each referenced asset (expect 200), few retries over ~30–60s max; failure after that is a real problem, not propagation.

## D3 — Failed-send semantics

**Code path** (`apps/api/src/routes/chat.ts`):
1. `POST /api/chat/stream` **persists the user message to `chat_messages` BEFORE calling the model** (line 73).
2. On client disconnect mid-stream, the request-abort signal breaks the token loop and the **fallback path persists the PARTIAL assistant response** (line 178).
3. There is **no idempotency key** on chat messages: a client retry inserts a duplicate user row.
4. History for the next turn = last 50 `chat_messages` rows → **every "failed" send (and any truncated partial reply) enters the model's context on the next successful turn.**

**Empirical confirmation (prod, test account, 2026-07-02T18:08Z):**
- Sent `D3-DIAGNOSTIC-MARKER-7392…` via curl, killed the connection at +3.5s mid-stream.
- DB afterwards: user row persisted (18:08:38) + assistant row persisted **truncated at 68 chars, cut mid-word** ("…regelmäßige Gewohn") (18:08:41).
- An earlier send that ended in a stream `error` event (`MARKER-7391`) also left its user row persisted, with no assistant row.

**Documented semantics:** the send "dies" only in the client's perception. Once the request reaches the API, the message is committed to history regardless of what the client sees; the model receives it on the next turn even when the UI reported the send as failed. There is no server- or client-side retry; the failure toast is generated by the client fetch failing/aborting. This matches the walk's observation that a later reply referenced content from "failed" sends.

**Implication for P0.5:** client-generated message ID + server dedupe; a message whose delivery is unconfirmed must be shown as "wartet — erneut senden", and retry must not duplicate; truncated partial assistant rows should be marked/handled.
