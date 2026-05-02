"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useApp, type PendingInjection } from "@/contexts/app-context";
import { createClient } from "@/lib/supabase/client";
import { Code, FileText, MessageSquare, File as FileIcon, Menu } from "lucide-react";
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
    <div className="h-full flex flex-col" style={{ position: 'relative' }}>
      <style>{`
        @keyframes slideIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        .injection-card { animation: slideIn 0.2s ease-out; }
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
              Save changes to <span style={{ color: '#c9933a', fontFamily: 'JetBrains Mono, monospace' }}>{activeFile?.path.split('/').pop()}</span>?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => confirmSwitch(true)} style={{ background: '#2D4A2B', border: 'none', color: '#D4A94A', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Save</button>
              <button onClick={() => confirmSwitch(false)} style={{ background: 'transparent', border: '1px solid #2d4a2b', color: '#8aaa85', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Discard</button>
              <button onClick={() => setPendingFileSwitch(null)} style={{ background: 'transparent', border: '1px solid #2d4a2b', color: '#6b8a6b', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* Mobile toggle */}
      <button
        className="md:hidden fixed bottom-20 left-4 z-40 p-3 rounded-full shadow-lg"
        style={{ backgroundColor: 'var(--goblin-moss)', color: 'white' }}
        onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
        aria-label="Toggle file tree"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile drawer */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/40" onClick={() => setMobileDrawerOpen(false)}>
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl overflow-y-auto" style={{ background: '#0f1410' }} onClick={e => e.stopPropagation()}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-sm" style={{ color: '#8aaa85' }}>Files</span>
                <button onClick={() => setMobileDrawerOpen(false)} className="p-1 rounded" style={{ color: '#6b8a6b' }}>✕</button>
              </div>
              <FileTree projectId={projectId} files={files} onFileClick={openFile} onFilesChanged={fetchFiles} />
            </div>
          </div>
        </div>
      )}

      {/* Injection Banner */}
      {pendingCode && (
        <div style={{
          background: 'rgba(212,169,74,0.15)', borderBottom: '1px solid rgba(212,169,74,0.35)',
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <span style={{ color: '#D4A94A', fontSize: 16, flexShrink: 0 }}>✦</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#D4A94A', fontFamily: 'DM Sans, sans-serif' }}>
              Injected via Send to Code
            </span>
            {pendingCode.filename && (
              <span style={{ marginLeft: 8, fontSize: 12, color: '#c9933a', fontFamily: 'JetBrains Mono, monospace', background: 'rgba(212,169,74,0.15)', padding: '1px 8px', borderRadius: 4 }}>
                {pendingCode.filename}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={handleDeploy}
              disabled={deploying}
              style={{ background: deploying ? 'rgba(45,74,43,0.5)' : '#2D4A2B', color: '#D4A94A', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: deploying ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              {deploying ? '▶ Deploying…' : '▶ Build'}
            </button>
            <button
              onClick={handleSendToCodeApply}
              style={{ background: 'rgba(212,169,74,0.15)', color: '#D4A94A', border: '1px solid rgba(212,169,74,0.4)', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
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
                style={{ background: 'transparent', color: '#6b8a6b', border: '1px solid rgba(107,138,107,0.3)', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                title="Undo last injection"
              >
                ↩ Undo
              </button>
            )}
            <button onClick={() => setPendingCodePayload(null)} style={{ background: 'none', border: 'none', color: '#6b8a6b', cursor: 'pointer', fontSize: 16, padding: '4px 6px', lineHeight: 1 }}>×</button>
          </div>
        </div>
      )}

      {/* Mobile file picker */}
      <div className="md:hidden shrink-0" style={{ borderBottom: '1px solid #1e2a1c', background: '#0f1410' }}>
        <select
          value={activeFile?.path ?? ''}
          onChange={e => e.target.value && openFile(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', background: 'transparent', color: '#8aaa85', border: 'none', outline: 'none', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}
        >
          {!activeFile && <option value="">— select a file —</option>}
          {files.map(f => <option key={f} value={f} style={{ background: '#141a12', color: '#c5d0c0' }}>{f}</option>)}
        </select>
      </div>

      {/* Desktop layout */}
      <div className="flex-1 flex overflow-hidden" style={{ position: 'relative' }}>
        {/* File Tree */}
        <div className={`hidden md:flex flex-col border-r ${fileTreeOpen ? 'w-64' : 'w-12'} transition-all duration-200`}
          style={{ borderColor: 'var(--goblin-light)', backgroundColor: '#0f1410' }}>
          <button
            onClick={() => setFileTreeOpen(!fileTreeOpen)}
            className="p-3 flex items-center gap-2 border-b shrink-0"
            style={{ borderColor: '#1e2a1c' }}
          >
            <FileIcon className="w-4 h-4" style={{ color: 'var(--goblin-ochre)' }} />
            {fileTreeOpen && <span className="text-sm font-semibold" style={{ color: '#8aaa85' }}>Files</span>}
          </button>
          {fileTreeOpen && (
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-4 rounded animate-pulse" style={{ backgroundColor: '#1e2a1c' }} />)}
                </div>
              ) : files.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-xs" style={{ color: '#6b8a6b' }}>No files yet</p>
                  <p className="text-xs mt-1" style={{ color: '#4a6a4a' }}>Start chatting to generate code.</p>
                </div>
              ) : (
                <FileTree projectId={projectId} files={files} onFileClick={openFile} onFilesChanged={fetchFiles} />
              )}
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: '#141a12' }}>
          {activeFile && (
            <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0" style={{ backgroundColor: '#0f1410', borderColor: '#1e2a1c' }}>
              <FileIcon className="w-3.5 h-3.5" style={{ color: '#8aaa85' }} />
              <span className="text-sm font-medium" style={{ color: '#c5d0c0', fontFamily: 'JetBrains Mono, monospace' }}>
                {activeFile.path}
              </span>
              {isDirty && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D4A94A', flexShrink: 0, display: 'inline-block' }} title="Unsaved changes" />}
              {injectedFiles.has(activeFile.path) && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--goblin-ochre)' }} />}
              <SaveIndicator saving={saving} isDirty={isDirty} />
            </div>
          )}

          <div className="flex-1 min-h-0">
            {activeFile ? (
              <CodeEditor
                key={activeFile.path}
                content={editorContent}
                filename={activeFile.path}
                onChange={handleEditorChange}
                onSave={(content) => saveFile(content, true)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Code className="w-12 h-12 mb-4" style={{ color: '#4a6a4a' }} />
                <p className="text-sm" style={{ color: '#8aaa85' }}>
                  {files.length > 0 ? 'Select a file to start editing' : 'No files yet — start chatting to generate code.'}
                </p>
                <p className="text-xs mt-2" style={{ color: '#4a6a4a' }}>Right-click the file tree to create a new file</p>
              </div>
            )}
          </div>

          {/* Pending injections */}
          {pendingInjections.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(212,169,74,0.3)', flexShrink: 0, background: '#141a12' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'rgba(212,169,74,0.07)' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#D4A94A', fontFamily: 'DM Sans, sans-serif' }}>
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

      {/* Mobile FAB */}
      <div className="md:hidden" style={{ position: 'fixed', bottom: 'calc(56px + 16px)', right: 16, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 40 }}>
        <button onClick={openPushModal} style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(30,58,28,0.95)', border: '1px solid rgba(138,170,133,0.3)', color: '#8aaa85', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties} title="Push to GitHub">⬆</button>
        <button onClick={handleDeploy} disabled={deploying} style={{ width: 56, height: 56, borderRadius: '50%', background: deploying ? 'rgba(45,74,43,0.6)' : '#2D4A2B', border: 'none', color: '#D4A94A', fontSize: 22, cursor: deploying ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(45,74,43,0.5)', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties} title="Deploy to Vercel">{deploying ? '…' : '▶'}</button>
      </div>

      {/* Build status bar */}
      {(activeBuilds.length > 0 || recentDone.length > 0) && (
        <div style={{ borderTop: '1px solid var(--goblin-light)', flexShrink: 0 }}>
          <BuildStatusBar builds={[...activeBuilds, ...recentDone]} />
        </div>
      )}

      {/* Deploy toast */}
      {deployMessage && (
        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: '#1e3a1c', border: '1px solid rgba(212,169,74,0.4)', borderRadius: 8, padding: '8px 16px', fontSize: 12, color: '#c9933a', fontFamily: 'DM Sans, sans-serif', zIndex: 50, whiteSpace: 'nowrap', maxWidth: 400, textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
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
  const typeIcon = injection.payloadType === 'code' ? <Code className="w-3.5 h-3.5" /> : injection.payloadType === 'prompt' ? <MessageSquare className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />;
  const typeLabel = injection.payloadType === 'code' ? 'CODE' : injection.payloadType === 'prompt' ? 'PROMPT' : 'MIXED';
  const preview = injection.payload.length > 80 ? injection.payload.slice(0, 80) + '…' : injection.payload;
  return (
    <div className="injection-card rounded-lg border overflow-hidden" style={{ borderColor: '#D4A94A', backgroundColor: '#1a2018' }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: 'rgba(212,169,74,0.12)', borderBottom: '1px solid rgba(212,169,74,0.3)' }}>
        <span style={{ color: '#D4A94A' }}>{typeIcon}</span>
        <span className="text-xs font-bold tracking-wide" style={{ color: '#D4A94A' }}>[{typeLabel}]</span>
        {injection.filenameHint && <span className="text-xs ml-1" style={{ color: '#8aaa85', fontFamily: 'monospace' }}>{injection.filenameHint}</span>}
        <span className="text-xs ml-auto" style={{ color: '#6b8a6b' }}>{new Date(injection.createdAt).toLocaleTimeString()}</span>
      </div>
      <pre className="text-xs whitespace-pre-wrap px-3 py-2.5 overflow-x-auto" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8aaa85', backgroundColor: '#1a2018' }}>{preview}</pre>
    </div>
  );
}
