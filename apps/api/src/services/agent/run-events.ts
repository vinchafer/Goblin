// F-40 (resumable runs) — the per-run event-log store (U1 data layer).
//
// One row per emitted event in agent_run_events (migration 0091), append-only, ordered
// by a per-run monotonic `seq`. This is the durable replay source a re-attaching client
// reads (GET …/runs/:runId/events?since=N) and the "one source of truth" for what a run
// did — the ordered twin of the agent_runs.step_log/report envelope.
//
// PRE-MIGRATION TOLERANT (Gesetz 4): every write/read probes the table once. Before the
// founder applies 0091 the table is absent — appendRunEvent silently no-ops and
// loadRunEvents returns [], so the in-memory ring in run-registry still serves same-process
// re-attach and a run never crashes on a pre-0091 DB. The probe result is cached per
// process so we don't hammer the DB with failing inserts.

import { getSupabaseAdmin } from '../../lib/supabase';
import logger from '../../lib/logger';
import { scrubSecrets } from '../../lib/scrub-secrets';

/** The SSE frame types the client switches on — persisted verbatim as the row `type`. */
export type RunEventType =
  | 'meta'
  | 'agent_narration'
  | 'agent_plan'
  | 'agent_step'
  | 'agent_report'
  | 'done'
  | 'error';

/** A persisted (or in-memory) event: the resume cursor `seq`, the `type`, and the body. */
export interface RunEvent {
  seq: number;
  type: RunEventType;
  /** The event body minus its type (already scrubbed on write). */
  payload: Record<string, unknown>;
}

export interface AppendRunEventInput {
  runId: string;
  userId: string;
  projectId: string;
  seq: number;
  type: RunEventType;
  payload: Record<string, unknown>;
}

// null = unprobed; true/false = the 0091 table is present/absent in this DB. Cached per
// process (a deploy re-probes). We only flip to `false` on a relation-missing error so a
// transient failure doesn't permanently disable the log.
let tablePresent: boolean | null = null;

/** A relation-missing error means the migration isn't applied yet (pre-0091 DB). */
function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  // Postgres undefined_table = 42P01; PostgREST surfaces it as PGRST205 / a message hint.
  return (
    err.code === '42P01' ||
    err.code === 'PGRST205' ||
    /agent_run_events/i.test(err.message ?? '') && /(does not exist|not find|schema cache)/i.test(err.message ?? '')
  );
}

/**
 * Append one event row. Scrubs the payload (Wave-D) so no upstream key can land in the
 * log via narration/report text. Best-effort + pre-migration tolerant: a missing table
 * flips the cached probe and no-ops thereafter; any other error is logged, never thrown
 * (the run must not die because its log write failed).
 */
export async function appendRunEvent(input: AppendRunEventInput): Promise<void> {
  if (tablePresent === false) return; // known-absent — in-memory ring is the only log
  try {
    const sb = getSupabaseAdmin();
    const payload = scrubSecrets(input.payload) as Record<string, unknown>;
    const { error } = await sb.from('agent_run_events').insert({
      run_id: input.runId,
      user_id: input.userId,
      project_id: input.projectId,
      seq: input.seq,
      type: input.type,
      payload,
    });
    if (error) {
      if (isMissingTable(error)) {
        tablePresent = false;
        logger.warn({ err: error.message }, 'agent_run_events_absent_premigration');
        return;
      }
      // A duplicate (run_id, seq) is a benign retry — do not log-spam or disable.
      if (error.code !== '23505') {
        logger.warn({ err: error.message, runId: input.runId, seq: input.seq }, 'agent_run_event_append_failed');
      }
      return;
    }
    tablePresent = true;
  } catch (e) {
    logger.warn({ err: (e as Error).message, runId: input.runId }, 'agent_run_event_append_threw');
  }
}

/**
 * Load a run's events with seq > sinceSeq, ordered. Ownership-scoped to the caller.
 * Returns [] on a pre-0091 DB or any error (the caller then relies on the in-memory ring
 * for a same-process re-attach, or renders whatever it already has).
 */
export async function loadRunEvents(
  runId: string,
  userId: string,
  sinceSeq = 0,
  limit = 2000,
): Promise<RunEvent[]> {
  if (tablePresent === false) return [];
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('agent_run_events')
      .select('seq, type, payload')
      .eq('run_id', runId)
      .eq('user_id', userId)
      .gt('seq', sinceSeq)
      .order('seq', { ascending: true })
      .limit(limit);
    if (error) {
      if (isMissingTable(error)) {
        tablePresent = false;
        return [];
      }
      logger.warn({ err: error.message, runId }, 'agent_run_events_load_failed');
      return [];
    }
    tablePresent = true;
    return (data ?? []).map((r) => ({
      seq: r.seq as number,
      type: r.type as RunEventType,
      payload: (r.payload ?? {}) as Record<string, unknown>,
    }));
  } catch (e) {
    logger.warn({ err: (e as Error).message, runId }, 'agent_run_events_load_threw');
    return [];
  }
}

/** Test seam — reset the cached table probe between unit tests. */
export function __resetRunEventsProbe(): void {
  tablePresent = null;
}
