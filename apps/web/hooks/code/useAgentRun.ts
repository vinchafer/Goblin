import { useCallback, useRef, useState } from 'react';
import { apiStream } from '@/lib/api';
import { friendlyError } from '@/lib/friendly-error';

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
  state: 'draft-saved' | 'draft-unsaved' | 'failed' | 'stopped';
  files: AgentReportFile[];
  unitsConsumed: number;
  modelText: string;
  followUps: Array<'view-changes' | 'go-live' | 'open'>;
  failureReason?: string;
}

interface SubmitOpts {
  onDone?: (report: AgentReport | null) => void | Promise<void>;
  /** Called when the server declines the agent path (409) — caller falls back to /messages. */
  onNotEligible?: () => void;
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
  const [report, setReport] = useState<AgentReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setSteps([]); setNarration(''); setReport(null); setError(null);
  }, []);

  const submit = useCallback(async (prompt: string, modelId: string | undefined, opts?: SubmitOpts) => {
    if (!sessionId || !prompt.trim()) return;
    setStreaming(true);
    setError(null);
    setSteps([]);
    setNarration('');
    setReport(null);
    abortRef.current = new AbortController();
    let finalReport: AgentReport | null = null;

    try {
      await apiStream(
        `/api/code-sessions/${sessionId}/agent`,
        { prompt, modelId },
        (raw: unknown) => {
          const d = raw as {
            type: string;
            text?: string;
            tool?: string;
            summary?: string;
            ok?: boolean;
            ms?: number;
            report?: AgentReport;
            message?: string;
          };
          if (d.type === 'agent_narration') {
            setNarration(d.text ?? '');
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
      if ((e as Error)?.name !== 'AbortError') {
        setError(friendlyError(e, 'Server nicht erreichbar — nochmal versuchen?'));
      }
      setStreaming(false);
      // A stop mid-run still leaves the partial report the stream already delivered.
      await opts?.onDone?.(finalReport);
    }
  }, [sessionId, reset]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  return { streaming, steps, narration, report, error, submit, cancel, reset };
}
