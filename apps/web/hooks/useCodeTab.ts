import { useEffect, useRef, useCallback, useState } from 'react';
import { useApp } from '@/contexts/app-context';
import { createClient } from '@/lib/supabase/client';
import { useBuildStatus } from '@/hooks/useBuildStatus';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

async function getToken(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export interface ActiveFile {
  path: string;
  content: string;
}

export interface DiffData {
  filePath: string;
  currentContent: string;
  proposedContent: string;
  diff: string;
}

export interface UndoPayload {
  filePath: string;
  previousContent: string;
}

export function useCodeTab(projectId: string, pendingCode?: { content: string; filename?: string } | null) {
  const { pendingInjections, addInjection, clearPendingInjections, setPendingCodePayload, setActiveTab } = useApp();
  const { activeBuilds, recentDone, startBuild } = useBuildStatus(projectId);

  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [connectGitHubOpen, setConnectGitHubOpen] = useState(false);
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);
  const [diffData, setDiffData] = useState<DiffData | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployMessage, setDeployMessage] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<ActiveFile | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [fileTreeOpen, setFileTreeOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [undoPayload, setUndoPayload] = useState<UndoPayload | null>(null);
  const [pendingFileSwitch, setPendingFileSwitch] = useState<string | null>(null);
  const [injectedFiles, setInjectedFiles] = useState<Set<string>>(new Set());

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedContentRef = useRef<string>('');

  useEffect(() => {
    getToken().then(t => setToken(t));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === '1') { e.preventDefault(); setActiveTab('chat'); }
      else if (e.key === '2') { e.preventDefault(); setActiveTab('code'); }
      else if (e.key === '3') { e.preventDefault(); setActiveTab('preview'); }
      else if (e.key === 'Escape') {
        if (diffData) setDiffData(null);
        if (pushModalOpen) setPushModalOpen(false);
        if (connectGitHubOpen) setConnectGitHubOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setActiveTab, diffData, pushModalOpen, connectGitHubOpen]);

  const fetchFiles = useCallback(async () => {
    const t = await getToken();
    if (!t) return;
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/files`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      setFiles(data.files || []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [projectId]);

  const pollInjections = useCallback(async () => {
    const t = await getToken();
    if (!t) return;
    try {
      const response = await fetch(`${API_URL}/api/projects/${projectId}/pending-injections`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data.injections?.length > 0) {
        for (const inj of data.injections) {
          if (!seenIds.current.has(inj.id)) {
            seenIds.current.add(inj.id);
            addInjection(inj);
            if (inj.filenameHint) setInjectedFiles(prev => new Set(prev).add(inj.filenameHint));
          }
        }
      }
    } catch { /* silent */ }
  }, [projectId, addInjection]);

  useEffect(() => {
    fetchFiles();
    pollInjections();
    pollRef.current = setInterval(pollInjections, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchFiles, pollInjections]);

  const openFile = useCallback(async (filePath: string) => {
    if (isDirty && activeFile) { setPendingFileSwitch(filePath); return; }
    const t = await getToken();
    if (!t) return;
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/files/${encodeURIComponent(filePath)}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      const content = data.content || '';
      setActiveFile({ path: filePath, content });
      setEditorContent(content);
      savedContentRef.current = content;
      setIsDirty(false);
      setMobileDrawerOpen(false);
    } catch { /* silent */ }
  }, [projectId, isDirty, activeFile]);

  const saveFile = useCallback(async (contentToSave: string, _immediate?: boolean) => {
    if (!activeFile || !token) return;
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/projects/${projectId}/files/${encodeURIComponent(activeFile.path)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: contentToSave }),
      });
      savedContentRef.current = contentToSave;
      setIsDirty(false);
    } catch { /* silent */ } finally { setSaving(false); }
  }, [activeFile, projectId, token]);

  const handleEditorChange = useCallback((newContent: string) => {
    setEditorContent(newContent);
    setIsDirty(newContent !== savedContentRef.current);
  }, []);

  useEffect(() => {
    if (!activeFile || !isDirty) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveFile(editorContent), 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [editorContent, activeFile?.path, isDirty, saveFile]);

  const confirmSwitch = useCallback(async (save: boolean) => {
    if (!pendingFileSwitch) return;
    if (save && activeFile) await saveFile(editorContent, true);
    setIsDirty(false);
    const target = pendingFileSwitch;
    setPendingFileSwitch(null);
    const t = await getToken();
    if (!t) return;
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/files/${encodeURIComponent(target)}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      const content = data.content || '';
      setActiveFile({ path: target, content });
      setEditorContent(content);
      savedContentRef.current = content;
    } catch { /* silent */ }
  }, [pendingFileSwitch, activeFile, editorContent, projectId, saveFile]);

  const applyInjectionDirect = useCallback(async (filePath: string, content: string, t: string) => {
    const currentContent = await (async () => {
      try {
        const res = await fetch(`${API_URL}/api/projects/${projectId}/files/${encodeURIComponent(filePath)}`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        const data = await res.json();
        return data.content ?? '';
      } catch { return ''; }
    })();

    setUndoPayload({ filePath, previousContent: currentContent });
    await fetch(`${API_URL}/api/projects/${projectId}/files/${encodeURIComponent(filePath)}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    setInjectedFiles(prev => new Set(prev).add(filePath));
    fetchFiles();
    await openFile(filePath);
  }, [projectId, fetchFiles, openFile]);

  const handleDeploy = useCallback(async () => {
    if (deploying || !token) return;
    setDeploying(true);
    setDeployMessage('Deploying to Vercel…');
    await startBuild('vercel_deploy', 'Deploying to Vercel…');
    try {
      const res = await fetch(`${API_URL}/api/deploy/vercel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok || !res.body) throw new Error('Deploy failed');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data:')) continue;
          try {
            const event = JSON.parse(line.slice(5));
            if (event.message) setDeployMessage(event.message);
            if (event.type === 'success') { setDeployMessage(`Deployed ✓ ${event.url}`); setTimeout(() => setDeployMessage(null), 6000); }
            if (event.type === 'error') setDeployMessage(`Error: ${event.message}`);
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      setDeployMessage(err instanceof Error ? err.message : 'Deploy failed');
      setTimeout(() => setDeployMessage(null), 6000);
    } finally { setDeploying(false); }
  }, [deploying, projectId, token, startBuild]);

  const openPushModal = useCallback(async () => {
    const t = token ?? await getToken();
    if (!t) return;
    if (githubConnected === null) {
      try {
        const res = await fetch(`${API_URL}/api/github/status`, { headers: { Authorization: `Bearer ${t}` } });
        const data = await res.json();
        setGithubConnected(data.connected);
        data.connected ? setPushModalOpen(true) : setConnectGitHubOpen(true);
      } catch { setConnectGitHubOpen(true); }
    } else {
      githubConnected ? setPushModalOpen(true) : setConnectGitHubOpen(true);
    }
  }, [githubConnected, token]);

  const handleSendToCodeApply = useCallback(async () => {
    if (!pendingCode) return;
    const filename = pendingCode.filename || 'generated.js';
    const t = token ?? await getToken();
    if (!t) return;
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/diff`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: filename, proposedContent: pendingCode.content }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDiffData({ filePath: filename, currentContent: data.currentContent, proposedContent: pendingCode.content, diff: data.diff });
    } catch {
      applyInjectionDirect(filename, pendingCode.content, t);
    }
  }, [pendingCode, projectId, token, applyInjectionDirect]);

  const handleDiffApply = useCallback(async () => {
    if (!diffData) return;
    const t = token ?? await getToken();
    if (!t) return;
    await applyInjectionDirect(diffData.filePath, diffData.proposedContent, t);
    setDiffData(null);
    setPendingCodePayload(null);
  }, [diffData, token, applyInjectionDirect, setPendingCodePayload]);

  const handleUndoInjection = useCallback(async () => {
    if (!undoPayload) return;
    const t = token ?? await getToken();
    if (!t) return;
    await fetch(`${API_URL}/api/projects/${projectId}/files/${encodeURIComponent(undoPayload.filePath)}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: undoPayload.previousContent }),
    });
    await openFile(undoPayload.filePath);
    setInjectedFiles(prev => { const n = new Set(prev); n.delete(undoPayload.filePath); return n; });
    setUndoPayload(null);
  }, [undoPayload, token, projectId, openFile]);

  return {
    // State
    files, activeFile, editorContent, loading, saving, isDirty, token,
    fileTreeOpen, setFileTreeOpen, mobileDrawerOpen, setMobileDrawerOpen,
    undoPayload, injectedFiles, deploying, deployMessage,
    pushModalOpen, setPushModalOpen, connectGitHubOpen, setConnectGitHubOpen,
    diffData, setDiffData, pendingFileSwitch, setPendingFileSwitch,
    pendingInjections, clearPendingInjections,
    activeBuilds, recentDone,
    // Handlers
    openFile, saveFile, handleEditorChange, confirmSwitch,
    handleDeploy, openPushModal, handleSendToCodeApply, handleDiffApply, handleUndoInjection,
    setPendingCodePayload, fetchFiles,
  };
}
