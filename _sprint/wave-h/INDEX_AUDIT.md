# WAVE-H · H6 — DB & Storage Under Scale (index audit + N+1 hunt)

Audit of the hot queries the Code-DD and the H1 baseline point at, each cross-checked against
the indexes that actually exist in `supabase/migrations/`. Verdict per row: **OK** (an index
already serves it) / **GAP** (no supporting index → fixed here) / **NOTE** (adequate, watch).

## Index coverage of the hot read paths

| Table | Hot query (call site) | Serving index | Verdict |
|-------|-----------------------|---------------|---------|
| `agent_run_events` | replay/poll: `run_id = ? AND seq > ? ORDER BY seq` (`run-events.ts:113`) | `idx_agent_run_events_run_seq (run_id, seq)` (0091) | **OK** — leading `run_id` eq + `seq` range/order is the exact index shape. |
| `agent_runs` | re-attach probe: `session_id=? AND user_id=? AND status='running' ORDER BY created_at DESC LIMIT 1` (`run-store.ts:118`) | `idx_agent_runs_session_status (session_id, status)` (0092) | **NOTE** — index gives (session,status); the running set per session is ≤1–2 rows, so the created_at sort is trivial. Adequate; no change. |
| `agent_runs` | history: `user_id=? ORDER BY created_at DESC` | `idx_agent_runs_user_created (user_id, created_at DESC)` (0001) | **OK**. |
| `completion_costs` | cost reconciliation by run: `run_id=?` (`billing`/telemetry) | `idx_completion_costs_run (run_id)` (0081) + user/project/provider idxs (0038/0077) | **OK**. |
| `project_checkpoints` | F3 timeline: `project_id=? ORDER BY created_at DESC` (`checkpoint-store.ts:225`) | `idx_project_checkpoints_project_created (project_id, created_at DESC)` (0095) | **OK**. |
| `project_checkpoints` | F4 publish history: `project_id=? AND created_by='publish'` | partial `idx_project_checkpoints_publish … where created_by='publish'` (0095) | **OK**. |
| `project_checkpoints` | **F5 prune cron (global):** `created_by='agent-run' AND created_at < cutoff` and `created_by='agent-run' … ORDER BY created_at DESC LIMIT keepRuns` (`retention.ts:66,84`) | — none (both 0095 idxs are project-scoped; the partial covers only `publish`) | **GAP → FIXED** (0097). |
| `chat_sessions` | `user_id=? ORDER BY updated_at DESC` | `idx_chat_sessions_user_updated` (0065) | **OK**. |
| `standalone_messages` | `session_id=? ORDER BY created_at ASC` | `idx_standalone_messages_session` (0065) | **OK**. |
| `code_session_messages` | `session_id=? ORDER BY created_at` | `idx_code_session_messages_session` (0055) | **OK**. |
| `daily_request_counts` | soft-limit RPC: `(user_id, date)` | `idx_daily_request_counts_user_date` (0047) | **OK**. |
| `platform_events` | funnel/insight reads | `platform_events_funnel_idx` / `_user_idx` / `_type_idx` / `_project_idx` (0078/0085) | **OK**. |

**One genuine gap in twelve hot paths** — the codebase's indexing is already disciplined
(consistent with the Code-DD's "unusually disciplined" verdict). The gap is the F5 prune
cron, whose two global `created_by='agent-run'` scans had no supporting index.

### The fix — migration 0097 (authored, NOT applied)

```sql
create index if not exists idx_project_checkpoints_agentrun_created
  on public.project_checkpoints (created_at desc)
  where created_by = 'agent-run';
```

A partial index on the agent-run partition (mirroring the existing publish partial index),
ordered `created_at DESC`. Serves the `LIMIT keepRuns` scan directly and the `created_at <
cutoff` range as a partitioned index — both prune queries go from a full-table SEQ SCAN to an
index read over only the agent-run rows. Pre-index tolerant (the prune code is unchanged and
works with or without it), so applying it is a pure performance win. Founder applies.

## N+1 hunt

| Path | Finding | Action |
|------|---------|--------|
| `hydrateSessionFiles` (`code-sessions.ts`) — runs at the start of EVERY agent run | Read up to **50 files one-at-a-time** (`for … await getFile`) — N storage round-trips in series. The parallel pattern already exists elsewhere (`getSessionFilesForContext`, `code-sessions.ts:744` `files.map(async … await getFile)` + `Promise.all`). | **FIXED** — bounded-parallel read (concurrency 8): `ceil(N/8)` sequential waves instead of N. Bounded (not an unbounded `Promise.all` over 50) so it speeds the common case without flooding storage under load. Semantics-preserving (same rows, `content==null` skipped, `≤50`, same upsert). |
| `deleteProject` DeleteObjects (`file-storage.ts`) | Already chunked to ≤1000 keys per call (`c89ef88`, closes #18) | **OK** — no per-file loop. |
| checkpoint blob writes (`checkpoint-store.ts`) | Content-addressed + dedup'd; blobs written once per unique content, manifest is one row | **OK** — not per-file N+1. |
| `agent_run_events` insert-per-event (`run-registry.ts:130`) | Fire-and-forget insert per emitted event × N runs (the Code-DD's "event-insert storm") | **NOTE, not changed** — batching would delay durability (a crash would lose more of the run log); the per-event write is a deliberate F-40 durability choice. Bounded instead by the H4 concurrency cap (fewer concurrent runs = fewer concurrent insert streams) and left as an N-2/N-3 shared-store infra decision. |

## Honest limitations (this unit)

1. **No before/after wall-clock timings.** The gate asks for timings on the top-5 slowest
   queries from H1; producing them needs a populated Postgres with `EXPLAIN ANALYZE`, which
   this sandbox does not have (the in-memory storage backend makes the N+1 fix instant here,
   understating the real-storage win). The **round-trip-count** improvement is deterministic
   (50 serial → 7 waves; two full scans → index reads); the **millisecond** improvement is
   **founder-run** via the recipe below and is UNVERIFIED in this wave.
2. Migration 0097 is **authored, not applied** (Gesetz 4). The prune code is pre-index
   tolerant, so the index changes only the query plan, never behaviour.

### Founder-run before/after recipe (needs the real test DB)

```sql
-- BEFORE 0097 — expect a Seq Scan / Filter on project_checkpoints:
EXPLAIN ANALYZE
  SELECT id, project_id, run_id FROM project_checkpoints
  WHERE created_by = 'agent-run' AND created_at < now() - interval '30 days';
-- Apply 0097, then re-run — expect an Index Scan using idx_project_checkpoints_agentrun_created.
```
For the hydrate N+1: time one agent-run start (`POST /:sessionId/agent`) on a project with
~30–50 files against a real storage backend, before vs after this commit — the file-read phase
should drop from ~N×RTT to ~⌈N/8⌉×RTT.
