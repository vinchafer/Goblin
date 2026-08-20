-- ═══════════════════════════════════════════════════════════════════════════════
-- 0106 — agent_runs.heartbeat_at (the phantom-session fix, Founder-Walk 2026-08-20 U2)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- WHY THIS EXISTS. `findActiveRun()` (apps/api/src/services/agent/run-store.ts) and
-- the cross-replica poll branch of `streamRunEvents()`
-- (apps/api/src/services/agent/run-registry.ts) both inferred "is this run still
-- alive" purely from elapsed wall-clock time since `agent_runs.created_at` — never
-- from any evidence the run was still doing anything. A process that died mid-run
-- (Railway restart, OOM, uncaught crash) leaves `status='running'` forever; the UI
-- kept rendering "Goblin arbeitet …" for up to ~10.5 minutes on the live SSE poll,
-- and re-offered the same dead run for up to 20 minutes (`staleAfterMs`) on every
-- re-entry via the project folder — a session that LOOKS running with nothing
-- behind it. That is the defect this migration targets: a display that asserts
-- "running" must be backed by verifiable recent activity, not a timeout guess.
--
-- WHAT IT ADDS. One column: the last time this run actually emitted anything
-- (`run-registry.ts`'s single `emit()` path touches it on every frame — meta,
-- narration, step, report, done, error). `findActiveRun` and the live-tail poller
-- now prefer this over `created_at` age: a row is offered as "active"/kept
-- streaming only while its heartbeat is recent; once it goes stale the poller
-- emits an honest terminal `error` frame ("konnte nicht bestätigen, dass der Lauf
-- noch läuft") instead of silently timing out.
--
-- PRE-MIGRATION TOLERANT (Gesetz 4): every read/write of heartbeat_at probes the
-- column once and falls back to the OLD `created_at`-age heuristic on a missing-
-- column error — so before the founder applies this file, behaviour is EXACTLY
-- what it was (same bug, not worse); after applying it, the heartbeat check goes
-- live with no code redeploy needed. See run-store.ts touchRunHeartbeat /
-- isRunHeartbeatStale.
--
-- Idempotent: safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;

COMMENT ON COLUMN agent_runs.heartbeat_at IS
  'Last time this run emitted any SSE frame (meta/narration/step/report/done/error), '
  'touched by the single emit() path in run-registry.ts. NULL on a pre-0106 row or a '
  'run that has not emitted since upgrade. Used to distinguish a genuinely running '
  'run from an orphaned status=''running'' row left by a crashed process — see '
  'findActiveRun() / streamRunEvents() in apps/api/src/services/agent/.';

-- ── VERIFY (read-only) ──────────────────────────────────────────────────────
--
-- select id, status, created_at, heartbeat_at
--   from agent_runs
--  where status = 'running'
--  order by created_at desc
--  limit 20;
--
-- Expected once live: heartbeat_at populated and recent for genuinely running rows;
-- NULL/stale heartbeat_at on any row older than a couple of minutes is a zombie the
-- new check will now stop offering as "active".
