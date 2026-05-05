"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useApp, type PendingInjection } from "@/contexts/app-context";
import { createClient } from "@/lib/supabase/client";
import { FileTree } from "./file-tree";

const CodeEditor = dynamic(
  () => import("@/components/editor/code-editor").then(m => ({ default: m.CodeEditor })),
  { ssr: false, loading: () => <div style={{ flex: 1, background: '#141a12', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a6a4a', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>Loading editor…</div> }
);
import { SaveIndicator } from "@/components/editor/save-indicator";
import { PushToGitHubModal } from "./push-to-github-modal";
import { ConnectGitHubModal } from "./connect-github-modal";
import { DiffModal } from "./diff-modal";
import { useBuildStatus } from "@/hooks/useBuildStatus";
import { BuildStatusBar } from "@/components/build/build-status-bar";

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface CodeTabProps {
  projectId: string;
  projectName?: string;
  pendingCode?: { content: string; filename?: string } | null;
}

interface ActiveFile {
  path: string;
  content: string;
}

interface DiffData {
  filePath: string;
  currentContent: string;
  proposedContent: string;
  diff: string;
}

interface UndoPayload {
  filePath: string;
  previousContent: string;
}

async function getToken(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function CodeTab({ projectId, projectName = 'project', pendingCode }: CodeTabProps) {
  const { pendingInjections, addInjection, clearPendingInjections, setPendingCodePayload, setActiveTab } = useApp();
  const { activeBuilds, recentDone, startBuild } = useBuildStatus(projectId);

  // Modal state
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [connectGitHubOpen, setConnectGitHubOpen] = useState(false);
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);
  const [diffData, setDiffData] = useState<DiffData | null>(null);

  // Deploy state
  const [deploying, setDeploying] = useState(false);
  const [deployMessage, setDeployMessage] = useState<string | null>(null);

  // Editor state
  const [files, setFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<ActiveFile | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [fileTreeOpen, setFileTreeOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // Undo injection
  const [undoPayload, setUndoPayload] = useState<UndoPayload | null>(null);

  // Dirty-state dialog (switch file without saving)
  const [pendingFileSwitch, setPendingFileSwitch] = useState<string | null>(null);

  // Injected files tracking
  const [injectedFiles, setInjectedFiles] = useState<Set<string>>(new Set());

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedContentRef = useRef<string>('');

  // ── Auth token ─────────────────────────────────────────────────────────────
  useEffect(() => {
    getToken().then(t => setToken(t));
  }, []);

  // ── Global keyboard shortcuts ──────────────────────────────────────────────
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

  // ── Deploy ─────────────────────────────────────────────────────────────────
  const handleDeploy = useCallback(async () => {
    if (deploying) return;
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
        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const event = JSON.parse(line.slice(5));
            if (event.message) setDeployMessage(event.message);
            if (event.type === 'success') {
              setDeployMessage(`Deployed ✓ ${event.url}`);
              setTimeout(() => setDeployMessage(null), 6000);
            }
            if (event.type === 'error') setDeployMessage(`Error: ${event.message}`);
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      setDeployMessage(err instanceof Error ? err.message : 'Deploy failed');
      setTimeout(() => setDeployMessage(null), 6000);
    } finally {
      setDeploying(false);
    }
  }, [deploying, projectId, token, startBuild]);

  // ── GitHub push ────────────────────────────────────────────────────────────
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

  // ── Injection polling ──────────────────────────────────────────────────────
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

  // ── File list ──────────────────────────────────────────────────────────────
  const fetchFiles = useCallback(async () => {
    const t = await getToken();
    if (!t) return;
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/files`, { headers: { Authorization: `Bearer ${t}` } });
      const data = await res.json();
      setFiles(data.files || []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => {
    fetchFiles();
    pollInjections();
    pollRef.current = setInterval(pollInjections, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchFiles, pollInjections]);

  // ── File operations ────────────────────────────────────────────────────────
  const openFile = useCallback(async (filePath: string) => {
    if (isDirty && activeFile) {
      setPendingFileSwitch(filePath);
      return;
    }
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

  // Confirm file switch
  const confirmSwitch = useCallback(async (save: boolean) => {
    if (!pendingFileSwitch) return;
    if (save && activeFile) await saveFile(editorContent, true);
    setIsDirty(false);
    const target = pendingFileSwitch;
    setPendingFileSwitch(null);
    // Now open without dirty check
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
  }, [pendingFileSwitch, activeFile, editorContent, projectId]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const saveFile = useCallback(async (contentToSave: string, immediate?: boolean) => {
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

  // Editor change handler
  const handleEditorChange = useCallback((newContent: string) => {
    setEditorContent(newContent);
    setIsDirty(newContent !== savedContentRef.current);
  }, []);

  // Auto-save debounce
  useEffect(() => {
    if (!activeFile || !isDirty) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveFile(editorContent), 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [editorContent, activeFile?.path, isDirty, saveFile]);

  // ── Diff + Apply Send-to-Code ─────────────────────────────────────────────
  const handleSendToCodeApply = useCallback(async () => {
    if (!pendingCode) return;
    const filename = pendingCode.filename || 'generated.js';
    const proposedContent = pendingCode.content;
    const t = token ?? await getToken();
    if (!t) return;

    // Fetch diff from API
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/diff`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: filename, proposedContent }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDiffData({ filePath: filename, currentContent: data.currentContent, proposedContent, diff: data.diff });
    } catch {
      // Fallback: apply directly without diff
      applyInjectionDirect(filename, proposedContent, t);
    }
  }, [pendingCode, projectId, token]);

  const applyInjectionDirect = useCallback(async (filePath: string, content: string, t: string) => {
    // Save previous content for undo
    const currentContent = await getToken().then(async (tk) => {
      if (!tk) return '';
      try {
        const res = await fetch(`${API_URL}/api/projects/${projectId}/files/${encodeURIComponent(filePath)}`, {
          headers: { Authorization: `Bearer ${tk}` },
        });
        const data = await res.json();
        return data.content ?? '';
      } catch { return ''; }
    });

    setUndoPayload({ filePath, previousContent: currentContent });

    // Write new content
    await fetch(`${API_URL}/api/projects/${projectId}/files/${encodeURIComponent(filePath)}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    setInjectedFiles(prev => new Set(prev).add(filePath));
    fetchFiles();
    await openFile(filePath);
  }, [projectId, fetchFiles, openFile]);

  // Apply from diff modal
  const handleDiffApply = useCallback(async () => {
    if (!diffData) return;
    const t = token ?? await getToken();
    if (!t) return;
    await applyInjectionDirect(diffData.filePath, diffData.proposedContent, t);
    setDiffData(null);
    setPendingCodePayload(null);
  }, [diffData, token, applyInjectionDirect, setPendingCodePayload]);

  // Undo injection
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
    setUndoPayload(null);
    setInjectedFiles(prev => { const n = new Set(prev); n.delete(undoPayload.filePath); return n; });
  }, [undoPayload, token, projectId, openFile]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes slideIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        .gb-injection-card { animation: slideIn 0.2s ease-out; }
        .gb-mobile-fab { display: none; }
        .gb-mobile-picker { display: none; }
        .gb-mobile-tree-toggle { display: none; }
        .gb-filetree-panel { display: flex; }
        @media (max-width: 768px) {
          .gb-mobile-fab { display: flex !important; }
          .gb-mobile-picker { display: block !important; }
          .gb-mobile-tree-toggle { display: flex !important; }
          .gb-filetree-panel { display: none !important; }
        }
      `}</style>

      {/* Diff modal */}
      {diffData && (
        <DiffModal
          filePath={diffData.filePath}
          currentContent={diffData.currentContent}
          proposedContent={diffData.proposedContent}
          diff={diffData.diff}
          onApply={handleDiffApply}
          onDiscard={() => { setDiffData(null); }}
        />
      )}

      {/* Dirty-state file switch dialog */}
      {pendingFileSwitch && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.5)' }} onClick={() => setPendingFileSwitch(null)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            background: '#1e2a1c', border: '1px solid #2d4a2b', borderRadius: 12,
            padding: '20px 24px', zIndex: 71, minWidth: 280,
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 13, color: '#c5d0c0', fontFamily: 'DM Sans, sans-serif', marginBottom: 16 }}>
              Save changes to <span style={{ color: 'var(--ochre)', fontFamily: 'JetBrains Mono, monospace' }}>{activeFile?.path.split('/').pop()}</span>?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => confirmSwitch(true)} style={{ background: 'var(--moss)', border: 'none', color: 'var(--ochre)', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Save</button>
              <button onClick={() => confirmSwitch(false)} style={{ background: 'transparent', border: '1px solid #2d4a2b', color: '#8aaa85', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Discard</button>
              <button onClick={() => setPendingFileSwitch(null)} style={{ background: 'transparent', border: '1px solid #2d4a2b', color: '#6b8a6b', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* Mobile file tree toggle */}
      <button
        className="gb-mobile-tree-toggle"
        onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
        aria-label="Toggle file tree"
        style={{
          position: 'fixed', bottom: 80, left: 16, zIndex: 40,
          width: 44, height: 44, borderRadius: '50%',
          background: 'var(--moss)', border: 'none',
          color: 'var(--ochre)', fontSize: 18,
          cursor: 'pointer', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}
      >
        ☰
      </button>

      {/* Mobile file tree drawer */}
      {mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.4)' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: 280,
              background: '#0f1410', overflowY: 'auto',
              boxShadow: '4px 0 20px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#8aaa85', fontFamily: 'DM Sans, sans-serif' }}>Files</span>
                <button onClick={() => setMobileDrawerOpen(false)} style={{ background: 'none', border: 'none', color: '#6b8a6b', cursor: 'pointer', fontSize: 18, padding: '2px 4px', lineHeight: 1 }}>✕</button>
              </div>
              <FileTree projectId={projectId} files={files} onFileClick={openFile} onFilesChanged={fetchFiles} />
            </div>
          </div>
        </div>
      )}

      {/* Injection Banner */}
      {pendingCode && (
        <div style={{
          background: 'rgba(212,169,74,0.12)', borderBottom: '1px solid rgba(212,169,74,0.3)',
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <span style={{ color: 'var(--ochre)', fontSize: 14, flexShrink: 0 }}>✦</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ochre)', fontFamily: 'DM Sans, sans-serif' }}>
              Injected via Send to Code
            </span>
            {pendingCode.filename && (
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--ochre)', fontFamily: 'JetBrains Mono, monospace', background: 'rgba(212,169,74,0.12)', padding: '1px 8px', borderRadius: 4 }}>
                {pendingCode.filename}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={handleDeploy}
              disabled={deploying}
              style={{ background: deploying ? 'rgba(45,74,43,0.5)' : 'var(--moss)', color: 'var(--ochre)', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: deploying ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              {deploying ? '▶ Deploying…' : '▶ Build'}
            </button>
            <button
              onClick={handleSendToCodeApply}
              style={{ background: 'rgba(212,169,74,0.12)', color: 'var(--ochre)', border: '1px solid rgba(212,169,74,0.35)', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
            >
              ⟳ Review & Apply
            </button>
            <button
              onClick={openPushModal}
              style={{ background: 'transparent', color: '#8aaa85', border: '1px solid rgba(138,170,133,0.3)', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
            >
              → Push GitHub
            </button>
            {undoPayload && (
              <button
                onClick={handleUndoInjection}
                title="Undo last injection"
                style={{ background: 'transparent', color: '#6b8a6b', border: '1px solid rgba(107,138,107,0.3)', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
              >
                ↩ Undo
              </button>
            )}
            <button onClick={() => setPendingCodePayload(null)} style={{ background: 'none', border: 'none', color: '#6b8a6b', cursor: 'pointer', fontSize: 16, padding: '4px 6px', lineHeight: 1 }}>×</button>
          </div>
        </div>
      )}

      {/* Mobile file picker */}
      <div className="gb-mobile-picker" style={{ borderBottom: '1px solid #1e2a1c', background: '#0f1410', flexShrink: 0 }}>
        <select
          value={activeFile?.path ?? ''}
          onChange={e => e.target.value && openFile(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', background: 'transparent', color: '#8aaa85', border: 'none', outline: 'none', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' } as React.CSSProperties}
        >
          {!activeFile && <option value="">— select a file —</option>}
          {files.map(f => <option key={f} value={f} style={{ background: '#141a12', color: '#c5d0c0' }}>{f}</option>)}
        </select>
      </div>

      {/* Desktop layout: file tree + editor */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* File tree panel */}
        <div
          className="gb-filetree-panel"
          style={{
            flexDirection: 'column',
            borderRight: '1px solid #1e2a1c',
            background: '#0f1410',
            width: fileTreeOpen ? 256 : 44,
            minWidth: fileTreeOpen ? 256 : 44,
            transition: 'width 0.2s ease, min-width 0.2s ease',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setFileTreeOpen(!fileTreeOpen)}
            style={{
              padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8,
              borderBottom: '1px solid #1e2a1c', flexShrink: 0,
              background: 'none', border: 'none',
              cursor: 'pointer', width: '100%', textAlign: 'left',
            } as React.CSSProperties}
          >
            {fileTreeOpen
              ? <span style={{ fontSize: 12, fontWeight: 600, color: '#8aaa85', fontFamily: 'DM Sans, sans-serif' }}>Files</span>
              : <span style={{ fontSize: 14, color: '#8aaa85' }}>≡</span>
            }
          </button>
          {fileTreeOpen && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ height: 14, borderRadius: 4, background: '#1e2a1c', animation: 'pulse 1.5s ease infinite' }} />
                  ))}
                </div>
              ) : files.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: '#6b8a6b', fontFamily: 'DM Sans, sans-serif', marginBottom: 4 }}>No files yet</p>
                  <p style={{ fontSize: 11, color: '#4a6a4a', fontFamily: 'DM Sans, sans-serif' }}>Start chatting to generate code.</p>
                </div>
              ) : (
                <FileTree projectId={projectId} files={files} onFileClick={openFile} onFilesChanged={fetchFiles} />
              )}
            </div>
          )}
        </div>

        {/* Editor area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#141a12' }}>

          {/* Active file breadcrumb */}
          {activeFile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid #1e2a1c', background: '#0f1410', flexShrink: 0 }}>
              <span style={{ color: '#c5d0c0', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeFile.path}
              </span>
              {isDirty && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ochre)', flexShrink: 0, display: 'inline-block' }} title="Unsaved changes" />
              )}
              {injectedFiles.has(activeFile.path) && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ochre)', flexShrink: 0, display: 'inline-block' }} title="Injected" />
              )}
              <SaveIndicator saving={saving} isDirty={isDirty} />
            </div>
          )}

          {/* Editor or empty state */}
          <div style={{ flex: 1, minHeight: 0 }}>
            {activeFile ? (
              <CodeEditor
                key={activeFile.path}
                content={editorContent}
                filename={activeFile.path}
                onChange={handleEditorChange}
                onSave={(content) => saveFile(content, true)}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: 32 }}>
                <div style={{ fontSize: 32, color: '#4a6a4a', fontFamily: 'JetBrains Mono, monospace', marginBottom: 14, opacity: 0.5 }}>{'</>'}</div>
                <p style={{ fontSize: 13, color: '#8aaa85', fontFamily: 'DM Sans, sans-serif', marginBottom: 6 }}>
                  {files.length > 0 ? 'Select a file to start editing' : 'No files yet — start chatting to generate code.'}
                </p>
                {files.length > 0 && (
                  <p style={{ fontSize: 11, color: '#4a6a4a', fontFamily: 'DM Sans, sans-serif' }}>Right-click the file tree to create a new file</p>
                )}
              </div>
            )}
          </div>

          {/* Pending injections panel */}
          {pendingInjections.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(212,169,74,0.25)', flexShrink: 0, background: '#141a12' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'rgba(212,169,74,0.06)' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ochre)', fontFamily: 'DM Sans, sans-serif' }}>
                  ✦ {pendingInjections.length} pending injection{pendingInjections.length !== 1 ? 's' : ''}
                </span>
                <button onClick={clearPendingInjections} style={{ background: 'none', border: 'none', color: '#6b8a6b', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
              </div>
              <div style={{ maxHeight: 160, overflowY: 'auto', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pendingInjections.map(injection => <InjectionCard key={injection.id} injection={injection} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile FABs */}
      <div
        className="gb-mobile-fab"
        style={{ position: 'fixed', bottom: 80, right: 16, flexDirection: 'column', gap: 8, zIndex: 40 }}
      >
        <button
          onClick={openPushModal}
          title="Push to GitHub"
          style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(30,58,28,0.95)', border: '1px solid rgba(138,170,133,0.3)', color: '#8aaa85', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' } as React.CSSProperties}
        >⬆</button>
        <button
          onClick={handleDeploy}
          disabled={deploying}
          title="Deploy to Vercel"
          style={{ width: 56, height: 56, borderRadius: '50%', background: deploying ? 'rgba(45,74,43,0.6)' : 'var(--moss)', border: 'none', color: 'var(--ochre)', fontSize: 22, cursor: deploying ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(45,74,43,0.5)' } as React.CSSProperties}
        >{deploying ? '…' : '▶'}</button>
      </div>

      {/* Build status bar */}
      {(activeBuilds.length > 0 || recentDone.length > 0) && (
        <div style={{ borderTop: '1px solid var(--div)', flexShrink: 0 }}>
          <BuildStatusBar builds={[...activeBuilds, ...recentDone]} />
        </div>
      )}

      {/* Deploy toast */}
      {deployMessage && (
        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: '#1e3a1c', border: '1px solid rgba(212,169,74,0.35)', borderRadius: 8, padding: '8px 16px', fontSize: 12, color: 'var(--ochre)', fontFamily: 'DM Sans, sans-serif', zIndex: 50, whiteSpace: 'nowrap', maxWidth: 400, textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
          {deployMessage}
        </div>
      )}

      {/* Modals */}
      <ConnectGitHubModal open={connectGitHubOpen} onClose={() => setConnectGitHubOpen(false)} onConnected={() => { setConnectGitHubOpen(false); setGithubConnected(true); setPushModalOpen(true); }} />
      <PushToGitHubModal open={pushModalOpen} onClose={() => setPushModalOpen(false)} projectId={projectId} defaultName={projectName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')} />
    </div>
  );
}

function InjectionCard({ injection }: { injection: PendingInjection }) {
  const typeIcon = injection.payloadType === 'code' ? '</>' : injection.payloadType === 'prompt' ? '✦' : '≡';
  const typeLabel = injection.payloadType === 'code' ? 'CODE' : injection.payloadType === 'prompt' ? 'PROMPT' : 'MIXED';
  const preview = injection.payload.length > 80 ? injection.payload.slice(0, 80) + '…' : injection.payload;
  return (
    <div className="gb-injection-card" style={{ borderRadius: 8, border: '1px solid rgba(212,169,74,0.4)', overflow: 'hidden', background: '#1a2018', animation: 'slideIn 0.2s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(212,169,74,0.08)', borderBottom: '1px solid rgba(212,169,74,0.25)' }}>
        <span style={{ color: 'var(--ochre)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{typeIcon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ochre)', fontFamily: 'JetBrains Mono, monospace' }}>[{typeLabel}]</span>
        {injection.filenameHint && (
          <span style={{ fontSize: 11, color: '#8aaa85', fontFamily: 'JetBrains Mono, monospace', marginLeft: 4 }}>{injection.filenameHint}</span>
        )}
        <span style={{ fontSize: 10, color: '#6b8a6b', marginLeft: 'auto', fontFamily: 'DM Sans, sans-serif' }}>{new Date(injection.createdAt).toLocaleTimeString()}</span>
      </div>
      <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', padding: '8px 12px', overflowX: 'auto', fontFamily: 'JetBrains Mono, monospace', color: '#8aaa85', background: '#1a2018', margin: 0 }}>{preview}</pre>
    </div>
  );
}
