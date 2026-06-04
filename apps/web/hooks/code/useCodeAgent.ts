import { useCallback, useRef, useState } from 'react';
import { apiStream } from '@/lib/api';
import { parseCodeBlocks, type ParsedBlock } from '@/lib/parse-code-blocks';
import { friendlyError } from '@/lib/friendly-error';

interface AgentDone {
  files: string[];
  text: string;
}

/**
 * The streaming code agent for one session. POSTs a prompt to
 * /api/code-sessions/:id/messages and consumes the SSE stream, re-parsing the
 * accumulating text on every delta so the editor can show code appearing live
 * (the Claude-Code-terminal feel). The backend persists the final draft files.
 */
export function useCodeAgent(sessionId: string | null) {
  const [streaming, setStreaming] = useState(false);
  const [text, setText] = useState('');
  const [blocks, setBlocks] = useState<ParsedBlock[]>([]);
  const [model, setModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textRef = useRef('');

  const submit = useCallback(async (
    prompt: string,
    modelId: string | undefined,
    onDone?: (d: AgentDone) => void,
    activePath?: string | null,
  ) => {
    if (!sessionId || !prompt.trim()) return;
    setStreaming(true);
    setError(null);
    setText('');
    setBlocks([]);
    textRef.current = '';
    abortRef.current = new AbortController();

    try {
      await apiStream(
        `/api/code-sessions/${sessionId}/messages`,
        { prompt, modelId, activePath: activePath ?? undefined },
        (raw: unknown) => {
          const d = raw as { type: string; content?: string; model?: string; files?: string[]; message?: string };
          if (d.type === 'meta') {
            setModel(d.model ?? null);
          } else if (d.type === 'delta') {
            textRef.current += d.content ?? '';
            setText(textRef.current);
            setBlocks(parseCodeBlocks(textRef.current));
          } else if (d.type === 'done') {
            setBlocks(parseCodeBlocks(textRef.current));
            setStreaming(false);
            onDone?.({ files: d.files ?? [], text: textRef.current });
          } else if (d.type === 'error') {
            setError(friendlyError(d.message, 'Modell hat nicht geantwortet — nochmal?'));
            setStreaming(false);
          }
        },
        abortRef.current.signal,
      );
    } catch (e) {
      // Aborted intentionally is not an error to surface.
      if ((e as Error)?.name !== 'AbortError') {
        setError(friendlyError(e, 'Server nicht erreichbar — nochmal versuchen?'));
      }
      setStreaming(false);
    }
  }, [sessionId]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  const reset = useCallback(() => {
    setText(''); setBlocks([]); setError(null); textRef.current = '';
  }, []);

  return { streaming, text, blocks, model, error, submit, cancel, reset };
}
