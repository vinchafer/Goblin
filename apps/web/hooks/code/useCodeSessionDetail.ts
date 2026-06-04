import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL, getToken } from './getToken';

export interface SessionFile {
  id: string;
  path: string;
  content: string;
  change_state: 'draft' | 'saved' | 'deployed';
  updated_at: string;
}
export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model_used: string | null;
  state: 'streaming' | 'complete' | 'error';
  created_at: string;
}
export type ChangeState = 'draft' | 'saved' | 'deployed' | 'empty';

/** Loads + mutates one session's thread + files (the work surface). */
export function useCodeSessionDetail(sessionId: string | null) {
  const [files, setFiles] = useState<SessionFile[]>([]);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [deployedAt, setDeployedAt] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const authFetch = useCallback(async (path: string, init?: RequestInit) => {
    const t = await getToken();
    if (!t) throw new Error('no-token');
    return fetch(`${API_URL}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!sessionId) { setFiles([]); setMessages([]); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await authFetch(`/api/code-sessions/${sessionId}`);
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      const f: SessionFile[] = data.files ?? [];
      setFiles(f);
      setMessages(data.messages ?? []);
      setActivePath(prev => (prev && f.some(x => x.path === prev)) ? prev : (f[0]?.path ?? null));
      setDeployUrl(data.deployUrl ?? null);
      setDeployedAt(data.deployedAt ?? null);
      setDirty(false);
    } catch { /* swallow */ } finally { setLoading(false); }
  }, [authFetch, sessionId]);

  useEffect(() => { refresh(); }, [refresh]);

  const activeFile = files.find(f => f.path === activePath) ?? null;

  /** Persist a draft file (PATCH). Used by hand-edit (debounced) + agent results. */
  const persistFile = useCallback(async (path: string, content: string, changeState: 'draft' | 'saved' = 'draft') => {
    if (!sessionId) return;
    try {
      await authFetch(`/api/code-sessions/${sessionId}/files`, {
        method: 'PATCH', body: JSON.stringify({ path, content, changeState }),
      });
    } catch { /* swallow */ }
  }, [authFetch, sessionId]);

  /** Local edit of the active file (keeps it draft, debounced persist). */
  const editActive = useCallback((content: string) => {
    if (!activePath) return;
    setFiles(prev => prev.map(f => f.path === activePath ? { ...f, content, change_state: 'draft' } : f));
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { persistFile(activePath, content, 'draft'); setDirty(false); }, 1200);
  }, [activePath, persistFile]);

  /** Merge agent-produced draft files into local state, then refetch for ids. */
  const applyDraftPaths = useCallback(async () => {
    await refresh();
  }, [refresh]);

  /** Sichern — promote all drafts to saved (writes to project storage). */
  const saveSession = useCallback(async (): Promise<boolean> => {
    if (!sessionId) return false;
    setSaving(true);
    try {
      const res = await authFetch(`/api/code-sessions/${sessionId}/save`, { method: 'POST' });
      if (!res.ok) return false;
      await refresh();
      return true;
    } catch { return false; } finally { setSaving(false); }
  }, [authFetch, sessionId, refresh]);

  /** Veröffentlichen — deploy (SSE). 409 if drafts remain. */
  const deploySession = useCallback(async (
    onProgress?: (msg: string) => void,
  ): Promise<{ url?: string; error?: string; deploymentUrl?: string; aliasUrl?: string }> => {
    if (!sessionId) return { error: 'no-session' };
    const t = await getToken();
    if (!t) return { error: 'no-token' };
    const res = await fetch(`${API_URL}/api/code-sessions/${sessionId}/deploy`, {
      method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    });
    if (res.status === 409) return { error: 'Bitte zuerst alle Entwürfe sichern' };
    if (!res.ok || !res.body) return { error: 'Veröffentlichen fehlgeschlagen' };
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let url: string | undefined;
    let error: string | undefined;
    let deploymentUrl: string | undefined;
    let aliasUrl: string | undefined;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const t2 = line.trim();
        if (!t2.startsWith('data: ')) continue;
        try {
          const d = JSON.parse(t2.slice(6));
          if (d.type === 'progress') onProgress?.(d.message);
          else if (d.type === 'success') { url = d.url; deploymentUrl = d.deploymentUrl; aliasUrl = d.aliasUrl; }
          else if (d.type === 'error') error = d.message;
        } catch { /* skip */ }
      }
    }
    await refresh();
    return { url, error, deploymentUrl, aliasUrl };
  }, [sessionId, refresh]);

  const discardDraft = useCallback(async (path: string) => {
    // No dedicated endpoint; archive by removing from local + leave server (or re-fetch).
    // Simplest correct behaviour: drop the draft file locally; server keeps last saved.
    setFiles(prev => prev.filter(f => !(f.path === path && f.change_state === 'draft')));
    if (activePath === path) setActivePath(null);
  }, [activePath]);

  // Aggregate change-state for the status line.
  const aggregateState: ChangeState =
    files.length === 0 ? 'empty'
    : files.some(f => f.change_state === 'draft') ? 'draft'
    : files.some(f => f.change_state === 'saved') ? 'saved'
    : 'deployed';

  const draftCount = files.filter(f => f.change_state === 'draft').length;

  return {
    files, messages, activePath, setActivePath, activeFile,
    loading, saving, dirty, aggregateState, draftCount,
    deployUrl, deployedAt,
    refresh, editActive, persistFile, applyDraftPaths,
    saveSession, deploySession, discardDraft, setFiles, setMessages,
  };
}
