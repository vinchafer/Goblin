import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL, getToken } from './getToken';

export interface CodeSession {
  id: string;
  name: string;
  model_id: string | null;
  state: 'active' | 'archived';
  created_at: string;
  updated_at: string;
  draftCount: number;
}

interface CreateOpts {
  name?: string;
  modelId?: string;
  initialContent?: string;
  initialFilename?: string;
}

/**
 * Multi-session state for the Code Tab.
 *
 * Degrades gracefully: if the `/code-sessions` API is unavailable (endpoint not
 * deployed, table missing, network error), `available` flips to false and the
 * caller falls back to the single-buffer Sprint-6 editor — never a crash, never a
 * regression of the shipped Code Tab.
 */
export function useCodeSessions(projectId: string) {
  const [sessions, setSessions] = useState<CodeSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeSessionId;

  const authFetch = useCallback(async (path: string, init?: RequestInit) => {
    const t = await getToken();
    if (!t) throw new Error('no-token');
    return fetch(`${API_URL}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await authFetch(`/api/code-sessions?projectId=${encodeURIComponent(projectId)}`);
      if (!res.ok) {
        // 404 / 500 / not-deployed → treat as unavailable, fall back.
        if (res.status === 404 || res.status >= 500) setAvailable(false);
        setLoading(false);
        return;
      }
      const data = await res.json();
      const list: CodeSession[] = data.sessions ?? [];
      setSessions(list);
      setAvailable(true);
      // Keep a valid active session selected.
      const first = list[0];
      if (first && !list.some(s => s.id === activeRef.current)) {
        setActiveSessionId(first.id);
      }
      setLoading(false);
    } catch {
      setAvailable(false);
      setLoading(false);
    }
  }, [authFetch, projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const createSession = useCallback(async (opts: CreateOpts = {}): Promise<CodeSession | null> => {
    try {
      const res = await authFetch('/api/code-sessions', {
        method: 'POST',
        body: JSON.stringify({ projectId, ...opts }),
      });
      if (!res.ok) { if (res.status === 404 || res.status >= 500) setAvailable(false); return null; }
      const { session } = await res.json();
      setSessions(prev => [session, ...prev]);
      setActiveSessionId(session.id);
      return session;
    } catch { setAvailable(false); return null; }
  }, [authFetch, projectId]);

  const switchSession = useCallback((id: string) => setActiveSessionId(id), []);

  const deleteSession = useCallback(async (id: string) => {
    // optimistic
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      if (activeRef.current === id) setActiveSessionId(next[0]?.id ?? null);
      return next;
    });
    try { await authFetch(`/api/code-sessions/${id}`, { method: 'DELETE' }); } catch { /* swallow */ }
  }, [authFetch]);

  const renameSession = useCallback(async (id: string, name: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, name } : s));
    try { await authFetch(`/api/code-sessions/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }); } catch { /* swallow */ }
  }, [authFetch]);

  const setSessionModel = useCallback(async (id: string, modelId: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, model_id: modelId } : s));
    try { await authFetch(`/api/code-sessions/${id}`, { method: 'PATCH', body: JSON.stringify({ modelId }) }); } catch { /* swallow */ }
  }, [authFetch]);

  /** Bump a session's draft badge locally (after a stream / send-to-code). */
  const setDraftCount = useCallback((id: string, n: number) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, draftCount: n } : s));
  }, []);

  return {
    sessions, activeSessionId, loading, available,
    setActiveSessionId, refresh,
    createSession, switchSession, deleteSession, renameSession, setSessionModel, setDraftCount,
  };
}
