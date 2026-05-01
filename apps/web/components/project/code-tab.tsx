"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useApp, type PendingInjection } from "@/contexts/app-context";
import { createClient } from "@/lib/supabase/client";
import { Code, FileText, MessageSquare, X, File as FileIcon, Menu, Save } from "lucide-react";
import { FileTree } from "./file-tree";
import { CodeEditor } from "@/components/editor/code-editor";
import { SaveIndicator } from "@/components/editor/save-indicator";
import { PushToGitHubModal } from "./push-to-github-modal";
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

export function CodeTab({ projectId, projectName = 'project', pendingCode }: CodeTabProps) {
  const { pendingInjections, addInjection, clearPendingInjections, setPendingCodePayload } = useApp();
  const { activeBuilds, recentDone, startBuild } = useBuildStatus(projectId);
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployMessage, setDeployMessage] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [files, setFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<ActiveFile | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [fileTreeOpen, setFileTreeOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // Injected files tracking (files sent via Send-to-Code)
  const [injectedFiles, setInjectedFiles] = useState<Set<string>>(new Set());

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
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      setDeployMessage(err instanceof Error ? err.message : 'Deploy failed');
      setTimeout(() => setDeployMessage(null), 6000);
    } finally {
      setDeploying(false);
    }
  }, [deploying, projectId, token, startBuild]);

  // Get auth token on mount
  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      setToken(data.session?.access_token ?? null);
    };
    init();
  }, []);

  const pollInjections = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const t = sessionData.session?.access_token;
      if (!t) return;

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
            if (inj.filenameHint) {
              setInjectedFiles(prev => new Set(prev).add(inj.filenameHint));
            }
          }
        }
      }
    } catch {
      // Silently ignore polling errors
    }
  }, [projectId, addInjection]);

  const fetchFiles = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const t = sessionData.session?.access_token;
      if (!t) return;

      const res = await fetch(
        `${API_URL}/api/projects/${projectId}/files`,
        { headers: { Authorization: `Bearer ${t}` } }
      );
      const data = await res.json();
      setFiles(data.files || []);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchFiles();
    pollInjections();
    pollRef.current = setInterval(pollInjections, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchFiles, pollInjections]);

  const openFile = async (filePath: string) => {
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const t = sessionData.session?.access_token;
      if (!t) return;

      const res = await fetch(
        `${API_URL}/api/projects/${projectId}/files/${encodeURIComponent(filePath)}`,
        { headers: { Authorization: `Bearer ${t}` } }
      );
      const data = await res.json();
      setActiveFile({ path: filePath, content: data.content || "" });
      setEditorContent(data.content || "");
      setMobileDrawerOpen(false);
    } catch {
      // Silently fail
    }
  };

  const handleEditorChange = useCallback((newContent: string) => {
    setEditorContent(newContent);
  }, []);

  const saveFile = useCallback(async (contentToSave: string) => {
    if (!activeFile || !token) return;
    setSaving(true);

    try {
      await fetch(
        `${API_URL}/api/projects/${projectId}/files/${encodeURIComponent(activeFile.path)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: contentToSave }),
        }
      );
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  }, [activeFile, projectId, token]);

  // Auto-save with 1.5s debounce
  useEffect(() => {
    if (!activeFile) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveFile(editorContent);
    }, 1500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [editorContent, activeFile?.path, saveFile]);

  return (
    <div className="h-full flex flex-col">
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .injection-card { animation: slideIn 0.2s ease-out; }
        .slide-in-left {
          animation: slideInLeft 0.25s ease-out;
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Mobile toggle button */}
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
          <div
            className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold" style={{ color: 'var(--goblin-slate)' }}>Files</span>
                <button onClick={() => setMobileDrawerOpen(false)} className="p-1 rounded hover:bg-gray-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <FileTree projectId={projectId} files={files} onFileClick={openFile} />
            </div>
          </div>
        </div>
      )}

      {/* Injection Banner */}
      {pendingCode && (
        <div style={{
          background: 'rgba(212,169,74,0.15)',
          borderBottom: '1px solid rgba(212,169,74,0.35)',
          padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <span style={{ color: '#D4A94A', fontSize: 16, flexShrink: 0 }}>✦</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#D4A94A', fontFamily: 'DM Sans, sans-serif' }}>
              Injected via Send to Code
            </span>
            {pendingCode.filename && (
              <span style={{
                marginLeft: 8, fontSize: 12,
                color: '#c9933a', fontFamily: 'JetBrains Mono, monospace',
                background: 'rgba(212,169,74,0.15)',
                padding: '1px 8px', borderRadius: 4,
              }}>
                {pendingCode.filename}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={handleDeploy}
              disabled={deploying}
              style={{
                background: deploying ? 'rgba(45,74,43,0.5)' : '#2D4A2B', color: '#D4A94A', border: 'none',
                borderRadius: 6, padding: '5px 12px',
                fontSize: 12, fontWeight: 600, cursor: deploying ? 'not-allowed' : 'pointer',
                fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 5,
              }}
              onMouseEnter={e => { if (!deploying) e.currentTarget.style.background = '#3A5A37'; }}
              onMouseLeave={e => { if (!deploying) e.currentTarget.style.background = '#2D4A2B'; }}
            >
              {deploying ? '▶ Deploying…' : '▶ Build'}
            </button>
            <button
              onClick={() => setPushModalOpen(true)}
              style={{
                background: 'transparent', color: '#8aaa85',
                border: '1px solid rgba(138,170,133,0.3)',
                borderRadius: 6, padding: '5px 12px',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 5,
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(138,170,133,0.7)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(138,170,133,0.3)')}
            >
              → Push GitHub
            </button>
            <button
              onClick={() => setPendingCodePayload(null)}
              style={{
                background: 'none', border: 'none', color: '#6b8a6b',
                cursor: 'pointer', fontSize: 16, padding: '4px 6px', lineHeight: 1,
              }}
              title="Clear"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Mobile file picker (visible only on mobile) */}
      <div className="md:hidden shrink-0" style={{ borderBottom: '1px solid #1e2a1c', background: '#0f1410' }}>
        <select
          value={activeFile?.path ?? ''}
          onChange={e => e.target.value && openFile(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px', background: 'transparent',
            color: '#8aaa85', border: 'none', outline: 'none',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
            cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
          }}
        >
          {!activeFile && <option value="">— select a file —</option>}
          {files.map(f => (
            <option key={f} value={f} style={{ background: '#141a12', color: '#c5d0c0' }}>
              {f}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop layout: file tree left, content right */}
      <div className="flex-1 flex overflow-hidden" style={{ position: 'relative' }}>
        {/* Desktop File Tree sidebar */}
        <div className={`hidden md:flex flex-col border-r ${fileTreeOpen ? 'w-64' : 'w-12'} transition-all duration-200`} 
          style={{ borderColor: 'var(--goblin-light)', backgroundColor: '#0f1410' }}>
          <button
            onClick={() => setFileTreeOpen(!fileTreeOpen)}
            className="p-3 flex items-center gap-2 border-b"
            style={{ borderColor: 'var(--goblin-light)' }}
          >
            <FileIcon className="w-4 h-4" style={{ color: 'var(--goblin-ochre)' }} />
            {fileTreeOpen && <span className="text-sm font-semibold" style={{ color: '#8aaa85' }}>Files</span>}
          </button>
          {fileTreeOpen && (
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-4 rounded animate-pulse" style={{ backgroundColor: '#1e2a1c' }} />
                  ))}
                </div>
              ) : files.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-xs" style={{ color: '#6b8a6b' }}>No files yet</p>
                  <p className="text-xs mt-1" style={{ color: '#4a6a4a' }}>Start chatting to generate code.</p>
                </div>
              ) : (
                <FileTree projectId={projectId} files={files} onFileClick={openFile} />
              )}
            </div>
          )}
        </div>

        {/* Main content area — CodeMirror Editor */}
        <div className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: '#141a12' }}>
          {/* Active file tab header */}
          {activeFile && (
            <div
              className="flex items-center gap-2 px-3 py-2 border-b shrink-0"
              style={{ backgroundColor: '#0f1410', borderColor: '#1e2a1c' }}
            >
              <FileIcon className="w-3.5 h-3.5" style={{ color: '#8aaa85' }} />
              <span className="text-sm font-medium" style={{ color: '#c5d0c0', fontFamily: 'JetBrains Mono, monospace' }}>
                {activeFile.path}
              </span>
              {injectedFiles.has(activeFile.path) && (
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--goblin-ochre)' }} />
              )}
              <SaveIndicator saving={saving} />
            </div>
          )}

          {/* Editor area or empty state */}
          <div className="flex-1 min-h-0">
            {activeFile ? (
              <CodeEditor
                key={activeFile.path}
                content={editorContent}
                filename={activeFile.path}
                onChange={handleEditorChange}
                onSave={saveFile}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Code className="w-12 h-12 mb-4" style={{ color: '#4a6a4a' }} />
                <p className="text-sm" style={{ color: '#8aaa85' }}>
                  {files.length > 0
                    ? "Select a file from the tree to start editing"
                    : "No files yet — start chatting to generate code."}
                </p>
              </div>
            )}
          </div>

          {/* Pending injections badge area */}
          {pendingInjections.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(212,169,74,0.3)', flexShrink: 0, background: '#141a12' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 14px',
                background: 'rgba(212,169,74,0.07)',
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#D4A94A', fontFamily: 'DM Sans, sans-serif' }}>
                  ✦ {pendingInjections.length} pending injection{pendingInjections.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={clearPendingInjections}
                  style={{ background: 'none', border: 'none', color: '#6b8a6b', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
              <div style={{ maxHeight: 160, overflowY: 'auto', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pendingInjections.map(injection => (
                  <InjectionCard key={injection.id} injection={injection} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile FAB — Build + Push (only on mobile) */}
      <div className="md:hidden" style={{
        position: 'absolute', bottom: 16, right: 16,
        display: 'flex', flexDirection: 'column', gap: 8, zIndex: 30,
      }}>
        <button
          onClick={() => setPushModalOpen(true)}
          style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(30,58,28,0.95)', border: '1px solid rgba(138,170,133,0.3)',
            color: '#8aaa85', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            WebkitTapHighlightColor: 'transparent',
          } as React.CSSProperties}
          title="Push to GitHub"
        >⬆</button>
        <button
          onClick={handleDeploy}
          disabled={deploying}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: deploying ? 'rgba(45,74,43,0.6)' : '#2D4A2B',
            border: 'none', color: '#D4A94A',
            fontSize: 22, cursor: deploying ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(45,74,43,0.5)',
            WebkitTapHighlightColor: 'transparent',
          } as React.CSSProperties}
          title="Deploy to Vercel"
        >{deploying ? '…' : '▶'}</button>
      </div>

      {/* Build status bar */}
      {(activeBuilds.length > 0 || recentDone.length > 0) && (
        <div style={{ borderTop: '1px solid var(--goblin-light)', flexShrink: 0 }}>
          <BuildStatusBar builds={[...activeBuilds, ...recentDone]} />
        </div>
      )}

      {/* Deploy message toast */}
      {deployMessage && (
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          background: '#1e3a1c', border: '1px solid rgba(212,169,74,0.4)',
          borderRadius: 8, padding: '8px 16px',
          fontSize: 12, color: '#c9933a', fontFamily: 'DM Sans, sans-serif',
          zIndex: 50, whiteSpace: 'nowrap', maxWidth: 400, textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          {deployMessage}
        </div>
      )}

      {/* Push to GitHub modal */}
      <PushToGitHubModal
        open={pushModalOpen}
        onClose={() => setPushModalOpen(false)}
        projectId={projectId}
        defaultName={projectName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}
      />
    </div>
  );
}

function InjectionCard({ injection }: { injection: PendingInjection }) {
  const typeIcon =
    injection.payloadType === "code" ? (
      <Code className="w-3.5 h-3.5" />
    ) : injection.payloadType === "prompt" ? (
      <MessageSquare className="w-3.5 h-3.5" />
    ) : (
      <FileText className="w-3.5 h-3.5" />
    );

  const typeLabel = injection.payloadType === "code" ? "CODE"
    : injection.payloadType === "prompt" ? "PROMPT"
    : "MIXED";

  const preview = injection.payload.length > 80
    ? injection.payload.slice(0, 80) + '…'
    : injection.payload;

  return (
    <div
      className="injection-card rounded-lg border overflow-hidden"
      style={{ borderColor: '#D4A94A', backgroundColor: '#1a2018' }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ backgroundColor: 'rgba(212,169,74,0.12)', borderBottom: '1px solid rgba(212,169,74,0.3)' }}
      >
        <span style={{ color: '#D4A94A' }}>{typeIcon}</span>
        <span className="text-xs font-bold tracking-wide" style={{ color: '#D4A94A' }}>
          [{typeLabel}]
        </span>
        {injection.filenameHint && (
          <span className="text-xs ml-1" style={{ color: '#8aaa85', fontFamily: 'monospace' }}>
            {injection.filenameHint}
          </span>
        )}
        <span className="text-xs ml-auto" style={{ color: '#6b8a6b' }}>
          {new Date(injection.createdAt).toLocaleTimeString()}
        </span>
      </div>

      <pre
        className="text-xs whitespace-pre-wrap px-3 py-2.5 overflow-x-auto"
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          color: '#8aaa85',
          backgroundColor: '#1a2018',
        }}
      >
        {preview}
      </pre>
    </div>
  );
}