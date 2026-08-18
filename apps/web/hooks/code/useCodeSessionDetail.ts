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

/**
 * FOUNDER-WALK-7 · U4 (D-D) — why the session could not be shown.
 *
 * The founder: "dann nochmals raus, zuerst in anderes projekt dann in wieder ins
 * richtige projekt und dann auf editor, erst dann kam der erarbeitete code."
 * First entry showed "Noch keine Dateien"; a round trip through another project
 * healed it. The server hydrates BEFORE serving, so the second request is not doing
 * anything the first could not — the difference was that the first one FAILED, and
 * a failed load left `files` at `[]` and said nothing:
 *
 *     if (!res.ok) { setLoading(false); return; }     // ← the whole defect
 *
 * The Code tab fires a burst on entry (availability probe, session list, project,
 * session detail, project files, hosted eligibility) against an API with a 60/min
 * general rate limit — a burst the repo already hardened OTHER calls against with
 * `fetchWithRetryOn429` (lib/api.ts, comment P1.10). This hook was not among them.
 *
 * `unreachable` = the request never resolved. `http` = it resolved with a status.
 * `incomplete` = it succeeded but the server could not finish mirroring the
 * project's files, so what is on screen is real but possibly not all of it.
 */
export type DetailLoadError =
  | { kind: 'unreachable' }
  | { kind: 'http'; status: number }
  | { kind: 'incomplete' };

/** Bounded retry for the transient 429 the entry burst produces (P1.10 philosophy). */
const RETRIES = 3;
const BASE_DELAY_MS = 400;

/** Loads + mutates one session's thread + files (the work surface). */
export function useCodeSessionDetail(sessionId: string | null) {
  const [files, setFiles] = useState<SessionFile[]>([]);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<DetailLoadError | null>(null);
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
    if (!sessionId) { setFiles([]); setMessages([]); setLoading(false); setLoadError(null); return; }
    setLoading(true);
    try {
      // U4 (D-D): retry the transient 429 the Code-tab entry burst produces, honoring
      // Retry-After, before concluding anything. Most first-entry failures were this.
      let res = await authFetch(`/api/code-sessions/${sessionId}`);
      for (let attempt = 0; res.status === 429 && attempt < RETRIES; attempt++) {
        const retryAfter = Number(res.headers.get('Retry-After'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : BASE_DELAY_MS * 2 ** attempt + Math.random() * 200;
        await new Promise((r) => setTimeout(r, wait));
        res = await authFetch(`/api/code-sessions/${sessionId}`);
      }
      if (!res.ok) {
        // U4 (D-D): the load did not happen. Leave whatever is already on screen
        // alone (stale-but-real beats blank) and SAY so — the one thing that must
        // never happen again is this rendering as "Noch keine Dateien".
        setLoadError({ kind: 'http', status: res.status });
        setLoading(false);
        return;
      }
      const data = await res.json();
      const f: SessionFile[] = data.files ?? [];
      // `filesComplete` is absent on a server that predates U4 — absent means "no
      // reason to doubt", which is the honest reading of no information here: the
      // old server had no partial-hydrate state to report.
      setLoadError(data.filesComplete === false ? { kind: 'incomplete' } : null);
      setFiles(f);
      setMessages(data.messages ?? []);
      // C.3 (NAVFIX-6): foreground the work in play. Hydration mirrors the whole
      // project's saved files into every session, so a fresh Send-to-Code task (a
      // single draft) used to "sink" behind an arbitrary saved file (f[0]). Prefer
      // a draft as the active file so the incoming task surfaces visibly; keep a
      // still-valid previous selection, else fall back to the first file.
      setActivePath(prev => {
        if (prev && f.some(x => x.path === prev)) return prev;
        const draft = f.find(x => x.change_state === 'draft');
        return draft?.path ?? f[0]?.path ?? null;
      });
      setDeployUrl(data.deployUrl ?? null);
      setDeployedAt(data.deployedAt ?? null);
      setDirty(false);
    } catch {
      // U4 (D-D): a network failure / missing token is likewise not an empty project.
      setLoadError({ kind: 'unreachable' });
    } finally { setLoading(false); }
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
    // MOBILE-1: surface the real HTTP status instead of collapsing every non-OK
    // response to a generic string — otherwise a transient 429 (rate limit) or a
    // 5xx is indistinguishable in the UI (W10 root-cause finding). 429 gets a
    // calm, actionable message; anything else names its status for diagnosis.
    if (res.status === 429) return { error: 'Zu viele Anfragen gerade — bitte kurz warten und erneut auf „Live stellen" tippen.' };
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => '');
      return { error: `Veröffentlichen fehlgeschlagen (HTTP ${res.status})${detail ? ` — ${detail.slice(0, 140)}` : ''}` };
    }
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
    loading, loadError, saving, dirty, aggregateState, draftCount,
    deployUrl, deployedAt,
    refresh, editActive, persistFile, applyDraftPaths,
    saveSession, deploySession, discardDraft, setFiles, setMessages,
  };
}
