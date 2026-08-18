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
 * FOUNDER-WALK-7 · U2 (D-A): what the server actually did with a Send-to-Code
 * payload — reported, not inferred.
 *
 * `requested` false means no payload was sent (an ordinary new session).
 * `requested` true + `landed` false is the case that used to be invisible: the
 * session row exists, the tab renders with the right title, and the draft never
 * arrived. The caller owes the user an honest state for exactly that case.
 */
export interface InitialFileOutcome {
  requested: boolean;
  landed: boolean;
  path: string | null;
}

export interface CreateSessionResult extends CodeSession {
  /** Present when the server answered a create that carried an initial payload. */
  initialFile?: InitialFileOutcome;
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
  // Sprint 9 P1: consume a `?session=<id>` deep-link from the dashboard exactly once.
  const deepLinkConsumedRef = useRef(false);
  // FOUNDER-WALK-6 · U5 (F1): the project this hook's state actually describes.
  // `refresh` used to overwrite `sessions` only on a successful response and
  // never cleared it first, so on a project switch (this hook's INSTANCE is
  // reused — no remount — because the page that hosts the Code tab does a soft
  // client navigation after project creation) `sessions`/`loading` kept
  // describing the PREVIOUS project until the new fetch resolved. A picker
  // reading `sessions` in that window offered a session from the wrong
  // project, and injecting into it wrote real files into that session — which
  // is why the assistant then answered as if the old project's code were
  // already present in the new one.
  const projectRef = useRef(projectId);

  const authFetch = useCallback(async (path: string, init?: RequestInit) => {
    const t = await getToken();
    if (!t) throw new Error('no-token');
    return fetch(`${API_URL}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  }, []);

  const refresh = useCallback(async () => {
    // Reset SYNCHRONOUSLY, before the request — not after it resolves — so a
    // caller (the session picker, the auto-create effect, an inject) can never
    // observe the previous project's `sessions`/`activeSessionId` while this
    // project's list is in flight. Only on an ACTUAL project change: `refresh()`
    // is also called after creating/renaming a session for the SAME project,
    // and flashing the list to empty on every one of those would be its own
    // regression.
    if (projectRef.current !== projectId) {
      projectRef.current = projectId;
      setSessions([]);
      setActiveSessionId(null);
      setLoading(true);
      setAvailable(true);
      deepLinkConsumedRef.current = false;
    }
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
      // On first load, honor a ?session=<id> deep-link from the dashboard if it
      // points at a real session; otherwise fall back to the first session.
      const wanted = (!deepLinkConsumedRef.current && typeof window !== 'undefined')
        ? new URLSearchParams(window.location.search).get('session')
        : null;
      deepLinkConsumedRef.current = true;
      if (wanted && list.some(s => s.id === wanted)) {
        setActiveSessionId(wanted);
      } else if (first && !list.some(s => s.id === activeRef.current)) {
        setActiveSessionId(first.id);
      }
      setLoading(false);
    } catch {
      setAvailable(false);
      setLoading(false);
    }
  }, [authFetch, projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const createSession = useCallback(async (opts: CreateOpts = {}): Promise<CreateSessionResult | null> => {
    try {
      const res = await authFetch('/api/code-sessions', {
        method: 'POST',
        body: JSON.stringify({ projectId, ...opts }),
      });
      if (!res.ok) { if (res.status === 404 || res.status >= 500) setAvailable(false); return null; }
      const { session, initialFile } = await res.json() as {
        session: CodeSession; initialFile?: InitialFileOutcome;
      };
      setSessions(prev => [session, ...prev]);
      setActiveSessionId(session.id);
      // U2 (D-A): the outcome rides alongside the session rather than inside it, so
      // the list state stays a plain CodeSession[] and only the caller that asked
      // for an injection has to reason about whether it landed. A server that
      // predates this field leaves `initialFile` undefined — the caller then knows
      // it cannot tell, which is still better than being told a comfortable "1".
      return initialFile ? { ...session, initialFile } : session;
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

  /** Bump a session's draft badge locally (after a stream / send-to-code).
   *  Returns the SAME array reference when the count is unchanged so React bails
   *  out of the state update — otherwise a SessionPane effect that calls this on
   *  every render (its callback identity changes each render) would spin an
   *  infinite re-render loop, pegging the main thread and silently aborting every
   *  in-app navigation out of the Code tab (the K3/K4/K7 "trapped" cluster). */
  const setDraftCount = useCallback((id: string, n: number) => {
    setSessions(prev => {
      const cur = prev.find(s => s.id === id);
      if (!cur || cur.draftCount === n) return prev;
      return prev.map(s => s.id === id ? { ...s, draftCount: n } : s);
    });
  }, []);

  return {
    sessions, activeSessionId, loading, available,
    setActiveSessionId, refresh,
    createSession, switchSession, deleteSession, renameSession, setSessionModel, setDraftCount,
  };
}
