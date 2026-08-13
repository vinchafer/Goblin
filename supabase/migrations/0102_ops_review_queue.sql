-- AKT 2 · PHASE 3 · U3.2 — the review queue: publishes held for a human.
--
-- AUTHORED, NOT APPLIED (Law 4 / sprint hard rule): the founder applies this via the
-- Supabase SQL Editor on merge. Nothing breaks before that. `ops-review-queue.ts`
-- FEATURE-DETECTS the table exactly like the 0099 reader and the 0100 audit writer,
-- and the publish path treats an unavailable queue as a REFUSAL to publish, never as
-- permission to proceed — see the comment on `enqueueReview()`. Additive and
-- idempotent; it touches no existing table.
--
-- ── WHAT A ROW IS ───────────────────────────────────────────────────────────────
-- One row = one publish attempt that passed the deterministic scan (stage 1) and was
-- then HELD by the classifier (stage 2). Nothing was uploaded: no R2 bytes, no KV
-- route, no `ops_apps` row. The row is therefore about a CANDIDATE, not about an app,
-- which is why it has no `app_id` and cannot reference `ops_apps`.
--
-- ── WHY THE CANDIDATE IS A REFERENCE AND NOT A COPY ─────────────────────────────
-- The row stores `user_id` + `project_id` + the requested name, not the artifact. The
-- operator surface re-reads the files from the project's own B2 storage when it needs
-- a preview. Two reasons, both about not making the problem worse:
--
--   • Copying a possibly-hostile artifact into Postgres creates a second copy of
--     content we have not cleared, in a place with no takedown path of its own.
--   • The builder may fix and re-publish while the row is pending. A stored copy would
--     let an operator approve a version that no longer exists — approving bytes rather
--     than approving an app. Re-reading means an approval always acts on what is
--     actually there.
--
-- The honest cost of that choice is recorded in the phase report: if the project is
-- deleted while the row is pending, the preview is gone and the row cascades away with
-- it. A pending review whose subject no longer exists is not a review anyone needs.
--
-- ── WHY NOT `ops_app_audit` (0100) ──────────────────────────────────────────────
-- That table is the record of what an OPERATOR DID, retained 12 months and deliberately
-- outliving the account. This one is a WORK QUEUE with a status that changes. Folding a
-- mutable queue into an append-only evidence trail would make both worse. The operator's
-- decision on a queue row still writes its own `ops_app_audit` line — the queue says
-- what is waiting, the audit says what was done.

create table if not exists public.ops_review_queue (
  id uuid primary key default gen_random_uuid(),

  -- Who tried to publish. Cascade: a deleted account has no pending publishes.
  user_id uuid not null references public.users(id) on delete cascade,

  -- The project the artifact would come from. NULLABLE for the same reason
  -- `ops_apps.project_id` is (0099): a publish that owns no project is expressible,
  -- and '' is not a uuid. Cascade — see the header on what a deleted project means.
  project_id uuid references public.projects(id) on delete cascade,

  -- The name the builder asked for. NOT claimed and NOT reserved while pending: the
  -- name check has always been "is it free right now", never a hold, and a queue that
  -- silently reserved names would make that sentence false. If the name is gone by the
  -- time an operator approves, the approved publish fails at the name stage and says so.
  requested_name text not null,

  -- pending | approved | blocked. Free text, not a CHECK, for the same reason 0100's
  -- `action` is: a later phase adding a status must not need a migration first.
  status text not null default 'pending',

  -- ── Both stage verdicts, kept separately ──────────────────────────────────────
  -- Stage 1 is 'pass' for every row here by construction (a stage-1 block never
  -- reaches the queue). It is stored anyway rather than assumed: if a later phase lets
  -- something else enqueue, a row that records only "held" would not say what held it.
  stage1_verdict text not null,
  stage1_rule_ids text[] not null default '{}',

  stage2_verdict text not null,
  -- flagged | over_budget | unavailable | timeout | unparseable — the operator-facing
  -- vocabulary from abuse-classifier.ts. This is the column that separates "the model
  -- read it and wondered" from "the check could not run", which are very different
  -- things for the human about to spend attention on the row.
  stage2_reason text not null,
  -- AUP categories, possibly empty (an incomplete check names none).
  categories text[] not null default '{}',
  stage2_confidence text,

  -- Metadata only, for the ledger and for judging whether a hold was worth it.
  -- NEVER file contents, NEVER model output.
  scanned_files integer,
  scanned_bytes bigint,
  tokens_input integer,
  tokens_output integer,

  -- ── The decision ──────────────────────────────────────────────────────────────
  -- `decided_by` is a human identifier (the operator's email), matching 0100's `actor`.
  decided_by text,
  decided_at timestamptz,
  -- Required by the application for a block, per ABUSE_RESPONSE §8.4: the user is owed
  -- the sentence. Not enforced here — a NOT NULL would make a pre-decision row invalid.
  decision_reason text,

  created_at timestamptz not null default now()
);

alter table public.ops_review_queue enable row level security;

-- No policy for authenticated users, deliberately, exactly as 0100: this is an operator
-- work queue reached only through the service-role API path behind the founder gate.
-- With RLS on and no policy, an anon/authenticated client reaches nothing. A builder
-- learns their publish is held from the publish response, not by reading this table.

-- "What is waiting?" — the console's only list query.
create index if not exists idx_ops_review_queue_pending
  on public.ops_review_queue (created_at desc)
  where status = 'pending';

-- "Has this builder been held before?" — context for a decision, and the signal that
-- someone is probing the check rather than building.
create index if not exists idx_ops_review_queue_user
  on public.ops_review_queue (user_id, created_at desc);

comment on table public.ops_review_queue is
  'AKT 2 · Phase 3 — hosted publishes held by the stage-2 classifier for human review. A row is a CANDIDATE, not an app: nothing was uploaded. The artifact is referenced (user+project), never copied. Operator decisions also write ops_app_audit.';
