-- AKT 2 · PHASE 5 · U5.2 — the heartbeat's memory: one row per measurement.
--
-- AUTHORED, NOT APPLIED (Law 4 / sprint hard rule): the founder applies this via the
-- Supabase SQL Editor on merge. Nothing breaks before that. `ops-checks-store.ts`
-- FEATURE-DETECTS the table exactly like the 0099 reader, the 0100 audit writer and
-- the 0102 queue: reads answer "not available" (which the surfaces render as UNKNOWN,
-- never as "everything is fine"), and writes answer false rather than throwing. The
-- runner treats an unavailable store as a reason to stop, not as permission to keep
-- making requests nobody records. Additive and idempotent; it touches no existing
-- table.
--
-- ── WHAT A ROW IS ───────────────────────────────────────────────────────────────
-- One row = ONE MEASUREMENT of ONE subject at ONE moment. Nothing else. A row is
-- never updated and never re-interpreted; the newest row for a subject is the only
-- thing that can say what is true now.
--
-- ── WHY THERE IS NO `status` COLUMN — the design decision of this phase ──────────
-- The obvious schema has a second table (or a column on `ops_apps`) holding the
-- CURRENT state: healthy / degraded / down / unknown. This one deliberately does
-- not, and the reason is the whole point of Phase 5.
--
-- A stored state has to be actively RESET when the instrument stops measuring. If
-- the runner dies, if Railway restarts, if the kill switch goes off, a column
-- reading 'healthy' keeps reading 'healthy' — a green that outlives the last thing
-- that could have justified it. The reset is the line somebody forgets, and the
-- failure mode of forgetting it is precisely the fake-green dashboard this product
-- exists to be the opposite of (Thesis §5.3: "we never report a state we did not
-- measure").
--
-- So the state is DERIVED at read time from the newest rows (`ops-check-state.ts`),
-- and a gap in the rows IS the UNKNOWN. There is nothing to reset because there is
-- nothing stored. See docs/ACT2_PHASE5_DECISIONS.md §P5-c and §P5-d.
--
-- ── WHY NOT IN THE APP'S OWN D1 ─────────────────────────────────────────────────
-- That database holds END-CUSTOMER data (Phase 4). Platform telemetry there would
-- land in the owner's CSV export, fall under the owner's delete-everything button,
-- count against their 500 MB, and stop being separable from "submissions travel
-- with the app". Check results are OURS, about the app; submissions are the app's
-- visitors' and about them. Different owners, different tables.
--
-- ── WHY NOT `ops_app_audit` (0100) ──────────────────────────────────────────────
-- That table is the record of what an OPERATOR DID, retained 12 months and
-- deliberately outliving the account. This is machine telemetry with an 8-day
-- retention that a scheduled job PRUNES. Mixing a pruned high-volume stream into an
-- append-only evidence trail would put ~6.000 rows a day into the table whose whole
-- value is that every row in it was written by a human decision.

create table if not exists public.ops_app_checks (
  id uuid primary key default gen_random_uuid(),

  -- ── Which subject was measured ────────────────────────────────────────────────
  -- NULL for platform subjects (Goblin's own web app, its API, the zone's
  -- certificate, the domain registration) — see `subject_key`. Nullable rather than
  -- a second table because the state machine, the retention prune and the operator
  -- view all want ONE stream: the same derivation that says an app is UNKNOWN says
  -- it about Goblin's own surfaces, which is U5.5's "one instrument" in one column.
  --
  -- ON DELETE CASCADE: telemetry about an app that no longer has a registry row is
  -- telemetry about nothing. Note this differs from `markOpsAppDeleted`, which KEEPS
  -- the row as a tombstone — so a torn-down app keeps its checks until the account
  -- itself is deleted, which is the behaviour the operator view needs.
  app_id uuid references public.ops_apps(app_id) on delete cascade,

  -- WHAT was asked. 'entry' | 'form_store' for apps; 'web' | 'api' | 'cert' |
  -- 'domain' for the platform. Free text, not a CHECK, for the same reason 0100's
  -- `action` and 0102's `status` are: a later phase adding a check must not need a
  -- migration first.
  subject_key text not null,

  -- ── What was measured ─────────────────────────────────────────────────────────
  -- 'ok' | 'warn' | 'fail' | 'unknown'. Free text for the reason above.
  --
  -- 'unknown' IS A RESULT AND IS STORED. A timeout, an aborted request, a temporary
  -- DNS failure — anything where the answer could equally be OUR fault — writes a
  -- row saying so. Dropping those rows would leave the previous 'ok' as the newest
  -- row and the derivation would report a green nobody measured. The whole UNKNOWN
  -- contract rests on this value existing in this column.
  outcome text not null,

  -- The HTTP status, when there was one. NULL means no response was received —
  -- which is NOT the same as 0 and NOT the same as 404, and is why this is nullable
  -- rather than defaulted.
  http_status integer,

  -- Round trip in milliseconds, as measured. NULL when the call did not complete.
  latency_ms integer,

  -- Days until expiry, for 'cert' and 'domain' only. NULL everywhere else, and NULL
  -- for a cert/domain check that could not read a date — never 0, which would read
  -- as "expires today".
  days_remaining integer,

  -- A short, bounded, machine-ish reason: 'timeout', 'dns', 'refused', 'tls',
  -- 'status_404', 'no_active_app'. NEVER page content, NEVER a submission, NEVER an
  -- upstream body. The cf-deploy adapter's redaction rules apply on the way in and
  -- the writer truncates; this column is meant to be safe to paste into a report.
  detail text,

  -- WHEN the measurement happened, from the runner's clock. This is the column every
  -- surface renders next to every state, because a state without its measurement
  -- time is the lie by omission the Feeling invariants name.
  measured_at timestamptz not null default now()
);

alter table public.ops_app_checks enable row level security;

-- No policy, deliberately, exactly as 0100 and 0102: this is platform telemetry
-- reached only through the service-role API path. The owner sees THEIR app's state
-- through `/api/ops/apps/:appId/status`, which checks ownership in code and returns
-- a derived summary — not through a client-side read of this table. With RLS on and
-- no policy, an anon/authenticated client reaches nothing.

-- "What is the state of this app right now?" — the derivation's only query: newest
-- rows for one app and one subject. Every read path uses this index.
create index if not exists idx_ops_app_checks_app
  on public.ops_app_checks (app_id, subject_key, measured_at desc);

-- The same question for the platform subjects, which have no app_id. A partial index
-- rather than a second table: same stream, same derivation, one index each.
create index if not exists idx_ops_app_checks_platform
  on public.ops_app_checks (subject_key, measured_at desc)
  where app_id is null;

-- The pruner's index (P5-e: 8 days, deleted in the tick). Without it the retention
-- delete degrades into a sequential scan over the largest table Act 2 writes.
create index if not exists idx_ops_app_checks_measured_at
  on public.ops_app_checks (measured_at);

comment on table public.ops_app_checks is
  'AKT 2 · Phase 5 (K0) — one row per heartbeat measurement, apps and Goblin''s own surfaces alike. Append-only, pruned to 8 days. There is deliberately NO current-state column: state is derived from the newest rows at read time, so a gap in the rows IS the UNKNOWN and no stored green can outlive the instrument. See docs/ACT2_PHASE5_DECISIONS.md.';
