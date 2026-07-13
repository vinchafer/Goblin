import { useCallback, useEffect, useRef, useState } from 'react';
import { apiStream, apiStreamGet, API_URL, getAuthHeaders } from '@/lib/api';
import { friendlyError } from '@/lib/friendly-error';

/**
 * A-6: fetch a run's persisted report card. After a stop mid-run the SSE closes before the
 * agent_report frame arrives; the server has still finalized a truthful partial report, so
 * we recover it here. Returns null on 204 (no report persisted yet — pre-0088 / not
 * finalized) or any error — the caller then falls back to whatever it already has.
 */
async function fetchRunReport(sessionId: string, runId: string): Promise<AgentReport | null> {
  // The server finalizes the run (writing the report) just AFTER the abort races the SSE
  // close, so a 204 can mean "not written yet". Retry a few times with backoff before
  // giving up — bounded, so a genuinely report-less run resolves quickly to null.
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/code-sessions/${sessionId}/runs/${runId}/report`, { headers });
      if (res.status === 200) {
        const d = (await res.json()) as { report?: AgentReport };
        return d.report ?? null;
      }
      if (res.status !== 204) return null; // 404/403 etc. — nothing to recover
    } catch {
      return null;
    }
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
  return null;
}

/** One rendered tool step — mirrors the server's agent_step event + a wall clock. */
export interface AgentStep {
  tool: string;
  summary: string;
  ok: boolean;
  ms: number;
}

export interface AgentReportFile {
  path: string;
  classification: 'NEU' | 'GEÄNDERT' | 'IDENTISCH';
  added?: number;
  removed?: number;
}

/** The orchestrator-assembled report (§5.1) — the shape the server emits. */
export interface AgentReport {
  outcome: 'finished' | 'stopped' | 'budget' | 'error';
  state: 'published' | 'draft-saved' | 'draft-unsaved' | 'failed' | 'stopped';
  files: AgentReportFile[];
  unitsConsumed: number;
  modelText: string;
  followUps: Array<'view-changes' | 'go-live' | 'open' | 'confirm-publish'>;
  /** FEEL-3b: the verified live URL when state === 'published'. */
  publishedUrl?: string;
  failureReason?: string;
}

interface SubmitOpts {
  onDone?: (report: AgentReport | null) => void | Promise<void>;
  /** Called when the server declines the agent path (409) — caller falls back to /messages. */
  onNotEligible?: () => void;
  /** FEEL-3b D1: confirmation-chip tap — grants publish for this (publish-only) run. */
  confirmPublish?: boolean;
}

/**
 * Drives one FEEL-3a agent run for a code session. POSTs to /agent and consumes the
 * step stream (agent_narration / agent_step / agent_report), exposing the live step
 * list + final report card for the Code surface. Stop = AbortController (the loop
 * ends after the in-flight tool; the partial report still renders).
 */
export function useAgentRun(sessionId: string | null) {
  const [streaming, setStreaming] = useState(false);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [narration, setNarration] = useState<string>('');
  // A-4 (plan mode): the narrated plan for a mehrschrittige run, rendered as a distinct
  // step above the tool steps. Null on trivial runs (the model never planned).
  const [plan, setPlan] = useState<string[] | null>(null);
  const [report, setReport] = useState<AgentReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  // F-40: true while re-attaching to a run this client did not start (a returning session).
  const [reattached, setReattached] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // F-40: the live run id (from the meta frame). A disconnect no longer stops the run —
  // Stop must call the server explicitly — so cancel() needs the id after the stream ends.
  const runIdRef = useRef<string | null>(null);
  // Latest report, for onDone after the stream closes.
  const reportRef = useRef<AgentReport | null>(null);
  // Mirror of `streaming` for the mount probe (avoid re-attaching over an in-flight run).
  const streamingRef = useRef(false);
  useEffect(() => { streamingRef.current = streaming; }, [streaming]);

  const reset = useCallback(() => {
    setSteps([]); setNarration(''); setPlan(null); setReport(null); setError(null); setReattached(false);
    reportRef.current = null;
  }, []);

  /** The one SSE frame handler — shared by a fresh run (POST) and a re-attach (GET). */
  const processFrame = useCallback((raw: unknown) => {
    const d = raw as {
      type: string; text?: string; tool?: string; summary?: string; ok?: boolean; ms?: number;
      steps?: string[]; report?: AgentReport; run_id?: string | null; message?: string;
    };
    if (d.type === 'meta') {
      // A-6: capture the run id so a stop/abort can recover the report via REST.
      // F-40: also stash it in a ref so Stop can abort the run server-side.
      runIdRef.current = d.run_id ?? runIdRef.current;
    } else if (d.type === 'agent_narration') {
      setNarration(d.text ?? '');
    } else if (d.type === 'agent_plan') {
      setPlan(d.steps ?? null);
    } else if (d.type === 'agent_step') {
      setSteps((prev) => [...prev, { tool: d.tool ?? '', summary: d.summary ?? '', ok: d.ok ?? true, ms: d.ms ?? 0 }]);
    } else if (d.type === 'agent_report') {
      reportRef.current = d.report ?? null;
      setReport(reportRef.current);
    } else if (d.type === 'done') {
      setStreaming(false);
    } else if (d.type === 'error') {
      setError(friendlyError(d.message, 'Agent-Lauf abgebrochen — nochmal?'));
      setStreaming(false);
    }
  }, []);

  const submit = useCallback(async (prompt: string, modelId: string | undefined, opts?: SubmitOpts) => {
    if (!sessionId || !prompt.trim()) return;
    setStreaming(true);
    setError(null);
    setSteps([]);
    setNarration('');
    setPlan(null);
    setReport(null);
    setReattached(false);
    reportRef.current = null;
    runIdRef.current = null;
    abortRef.current = new AbortController();

    try {
      await apiStream(
        `/api/code-sessions/${sessionId}/agent`,
        { prompt, modelId, confirmPublish: opts?.confirmPublish === true },
        processFrame,
        abortRef.current.signal,
      );
      setStreaming(false);
      await opts?.onDone?.(reportRef.current);
    } catch (e) {
      const msg = (e as Error)?.message ?? '';
      // Server declined the agent path — let the caller run the classic /messages flow.
      if (msg === 'agent_not_eligible') {
        setStreaming(false);
        reset();
        opts?.onNotEligible?.();
        return;
      }
      const aborted = (e as Error)?.name === 'AbortError';
      if (!aborted) {
        setError(friendlyError(e, 'Server nicht erreichbar — nochmal versuchen?'));
      }
      setStreaming(false);
      // A-6: a stop mid-run closes the SSE before the agent_report frame arrives. The
      // server has finalized a truthful partial report — recover it via REST so the card
      // renders reliably, not "only by luck". Only when we didn't already get one.
      if (!reportRef.current && runIdRef.current) {
        const recovered = await fetchRunReport(sessionId, runIdRef.current);
        if (recovered) { reportRef.current = recovered; setReport(recovered); }
      }
      await opts?.onDone?.(reportRef.current);
    }
  }, [sessionId, reset, processFrame]);

  /**
   * F-40: re-attach to an in-flight (or just-finished) run — the returning-client path.
   * Rehydrates the run UI from seq 0: replays the full step history, then live-tails until
   * the run finishes. A run that finished while the client was away replays its persisted
   * agent_report frame → the report card renders. No user action; called by the mount probe.
   */
  const reattach = useCallback(async (runId: string, opts?: { onDone?: (r: AgentReport | null) => void | Promise<void> }) => {
    if (!sessionId || !runId || streamingRef.current) return;
    setStreaming(true);
    setReattached(true);
    setError(null);
    setSteps([]);
    setNarration('');
    setPlan(null);
    setReport(null);
    reportRef.current = null;
    runIdRef.current = runId;
    abortRef.current = new AbortController();
    try {
      await apiStreamGet(
        `/api/code-sessions/${sessionId}/runs/${runId}/events?since=0`,
        processFrame,
        abortRef.current.signal,
      );
      setStreaming(false);
      await opts?.onDone?.(reportRef.current);
    } catch (e) {
      const aborted = (e as Error)?.name === 'AbortError';
      // A missing run (finished + evicted, or never ours) is not an error to surface — the
      // thread already shows the persisted assistant message. Stay quiet, just stop.
      if (!aborted && !/not found|404/i.test((e as Error)?.message ?? '')) {
        setError(friendlyError(e, 'Lauf konnte nicht wieder verbunden werden.'));
      }
      setStreaming(false);
    }
  }, [sessionId, processFrame]);

  const cancel = useCallback(() => {
    // F-40: since the run is now decoupled from the request, aborting the fetch only
    // DISCONNECTS — the run would keep going. An explicit Stop must tell the server to
    // abort the run (reason 'user_stop'); the orchestrator then ends the loop after the
    // in-flight tool and persists the partial state. Best-effort + fire-and-forget.
    const rid = runIdRef.current;
    if (sessionId && rid) {
      void (async () => {
        try {
          const headers = await getAuthHeaders();
          await fetch(`${API_URL}/api/code-sessions/${sessionId}/agent/${rid}/stop`, { method: 'POST', headers });
        } catch { /* best-effort — the max-runtime guard still bounds an unreachable run */ }
      })();
    }
    abortRef.current?.abort();
    setStreaming(false);
  }, [sessionId]);

  // F-40: on mount of a session, probe for an in-flight run and re-attach automatically —
  // the founder returns to the browser and the run is THERE (step history + live progress),
  // no tap needed. Silent on no active run / any probe failure.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    const ac = new AbortController();
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_URL}/api/code-sessions/${sessionId}/runs/active`, { headers, signal: ac.signal });
        if (!res.ok) return;
        const d = (await res.json()) as { activeRun?: { runId?: string } | null };
        const rid = d.activeRun?.runId;
        if (!cancelled && rid && !streamingRef.current) void reattach(rid);
      } catch { /* offline / aborted — nothing to re-attach */ }
    })();
    return () => { cancelled = true; ac.abort(); };
  }, [sessionId, reattach]);

  return { streaming, reattached, steps, narration, plan, report, error, submit, cancel, reset, reattach };
}
