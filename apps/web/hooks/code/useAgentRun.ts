import { useCallback, useRef, useState } from 'react';
import { apiStream, API_URL, getAuthHeaders } from '@/lib/api';
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
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setSteps([]); setNarration(''); setPlan(null); setReport(null); setError(null);
  }, []);

  const submit = useCallback(async (prompt: string, modelId: string | undefined, opts?: SubmitOpts) => {
    if (!sessionId || !prompt.trim()) return;
    setStreaming(true);
    setError(null);
    setSteps([]);
    setNarration('');
    setPlan(null);
    setReport(null);
    abortRef.current = new AbortController();
    let finalReport: AgentReport | null = null;
    let runId: string | null = null;

    try {
      await apiStream(
        `/api/code-sessions/${sessionId}/agent`,
        { prompt, modelId, confirmPublish: opts?.confirmPublish === true },
        (raw: unknown) => {
          const d = raw as {
            type: string;
            text?: string;
            tool?: string;
            summary?: string;
            ok?: boolean;
            ms?: number;
            steps?: string[];
            report?: AgentReport;
            run_id?: string | null;
            message?: string;
          };
          if (d.type === 'meta') {
            // A-6: capture the run id so a stop/abort can recover the report via REST.
            runId = d.run_id ?? null;
          } else if (d.type === 'agent_narration') {
            setNarration(d.text ?? '');
          } else if (d.type === 'agent_plan') {
            setPlan(d.steps ?? null);
          } else if (d.type === 'agent_step') {
            setSteps((prev) => [...prev, { tool: d.tool ?? '', summary: d.summary ?? '', ok: d.ok ?? true, ms: d.ms ?? 0 }]);
          } else if (d.type === 'agent_report') {
            finalReport = d.report ?? null;
            setReport(finalReport);
          } else if (d.type === 'done') {
            setStreaming(false);
          } else if (d.type === 'error') {
            setError(friendlyError(d.message, 'Agent-Lauf abgebrochen — nochmal?'));
            setStreaming(false);
          }
        },
        abortRef.current.signal,
      );
      setStreaming(false);
      await opts?.onDone?.(finalReport);
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
      if (!finalReport && runId) {
        const recovered = await fetchRunReport(sessionId, runId);
        if (recovered) { finalReport = recovered; setReport(recovered); }
      }
      await opts?.onDone?.(finalReport);
    }
  }, [sessionId, reset]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  return { streaming, steps, narration, plan, report, error, submit, cancel, reset };
}
