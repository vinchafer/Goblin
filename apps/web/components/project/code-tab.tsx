"use client";

import dynamic from "next/dynamic";
import { useApp, type PendingInjection } from "@/contexts/app-context";
import { FileTree } from "./file-tree";
import { SaveIndicator } from "@/components/editor/save-indicator";
import { PushToGitHubModal } from "./push-to-github-modal";
import { ConnectGitHubModal } from "./connect-github-modal";
import { DiffModal } from "./diff-modal";
import { BuildStatusBar } from "@/components/build/build-status-bar";
import { InjectedBanner } from "./InjectedBanner";
import { ActionBar } from "./ActionBar";
import { useCodeTab } from "@/hooks/useCodeTab";

const CodeEditor = dynamic(
  () => import("@/components/editor/code-editor").then(m => ({ default: m.CodeEditor })),
  {
    ssr: false,
    loading: () => (
      <div style={{ flex: 1, background: '#141a12', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a6a4a', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
        Loading editor…
      </div>
    ),
  }
);

interface CodeTabProps {
  projectId: string;
  projectName?: string;
  pendingCode?: { content: string; filename?: string } | null;
}

export function CodeTab({ projectId, projectName = 'project', pendingCode }: CodeTabProps) {
  const tab = useCodeTab(projectId, pendingCode);

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
      {tab.diffData && (
        <DiffModal
          filePath={tab.diffData.filePath}
          currentContent={tab.diffData.currentContent}
          proposedContent={tab.diffData.proposedContent}
          diff={tab.diffData.diff}
          onApply={tab.handleDiffApply}
          onDiscard={() => tab.setDiffData(null)}
        />
      )}

      {/* Dirty-state file switch dialog */}
      {tab.pendingFileSwitch && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.5)' }} onClick={() => tab.setPendingFileSwitch(null)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#1e2a1c', border: '1px solid #2d4a2b', borderRadius: 12, padding: '20px 24px', zIndex: 71, minWidth: 280, boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 13, color: '#c5d0c0', fontFamily: 'DM Sans, sans-serif', marginBottom: 16 }}>
              Save changes to <span style={{ color: 'var(--ochre)', fontFamily: 'JetBrains Mono, monospace' }}>{tab.activeFile?.path.split('/').pop()}</span>?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => tab.confirmSwitch(true)} style={{ background: 'var(--moss)', border: 'none', color: 'var(--ochre)', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>Save</button>
              <button onClick={() => tab.confirmSwitch(false)} style={{ background: 'transparent', border: '1px solid #2d4a2b', color: '#8aaa85', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>Discard</button>
              <button onClick={() => tab.setPendingFileSwitch(null)} style={{ background: 'transparent', border: '1px solid #2d4a2b', color: '#6b8a6b', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* Mobile file tree toggle FAB */}
      <button
        className="gb-mobile-tree-toggle"
        onClick={() => tab.setMobileDrawerOpen(!tab.mobileDrawerOpen)}
        aria-label="Toggle file tree"
        style={{ position: 'fixed', bottom: 80, left: 16, zIndex: 40, width: 44, height: 44, borderRadius: '50%', background: 'var(--moss)', border: 'none', color: 'var(--ochre)', fontSize: 18, cursor: 'pointer', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}
      >☰</button>

      {/* Mobile file tree drawer */}
      {tab.mobileDrawerOpen && (
        <div onClick={() => tab.setMobileDrawerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.4)' }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 280, background: '#0f1410', overflowY: 'auto', boxShadow: '4px 0 20px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#8aaa85' }}>Files</span>
                <button onClick={() => tab.setMobileDrawerOpen(false)} style={{ background: 'none', border: 'none', color: '#6b8a6b', cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>
              <FileTree projectId={projectId} files={tab.files} onFileClick={tab.openFile} onFilesChanged={tab.fetchFiles} />
            </div>
          </div>
        </div>
      )}

      {/* Injection Banner */}
      {pendingCode && (
        <InjectedBanner
          pendingCode={pendingCode}
          deploying={tab.deploying}
          undoPayload={tab.undoPayload}
          onDeploy={tab.handleDeploy}
          onApply={tab.handleSendToCodeApply}
          onPush={tab.openPushModal}
          onUndo={tab.handleUndoInjection}
          onDismiss={() => tab.setPendingCodePayload(null)}
        />
      )}

      {/* Action Bar */}
      <ActionBar deploying={tab.deploying} onDeploy={tab.handleDeploy} onPush={tab.openPushModal} />

      {/* Mobile file picker */}
      <div className="gb-mobile-picker" style={{ borderBottom: '1px solid #1e2a1c', background: '#0f1410', flexShrink: 0 }}>
        <select
          value={tab.activeFile?.path ?? ''}
          onChange={e => e.target.value && tab.openFile(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', background: 'transparent', color: '#8aaa85', border: 'none', outline: 'none', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, cursor: 'pointer', appearance: 'none' } as React.CSSProperties}
        >
          {!tab.activeFile && <option value="">— select a file —</option>}
          {tab.files.map(f => <option key={f} value={f} style={{ background: '#141a12', color: '#c5d0c0' }}>{f}</option>)}
        </select>
      </div>

      {/* Desktop layout: file tree + editor */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* File tree panel */}
        <div
          className="gb-filetree-panel"
          style={{ flexDirection: 'column', borderRight: '1px solid #1e2a1c', background: '#0f1410', width: tab.fileTreeOpen ? 256 : 44, minWidth: tab.fileTreeOpen ? 256 : 44, transition: 'width 0.2s ease, min-width 0.2s ease', flexShrink: 0 }}
        >
          <button
            onClick={() => tab.setFileTreeOpen(!tab.fileTreeOpen)}
            style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #1e2a1c', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' } as React.CSSProperties}
          >
            {tab.fileTreeOpen
              ? <span style={{ fontSize: 12, fontWeight: 600, color: '#8aaa85', fontFamily: 'DM Sans, sans-serif' }}>Files</span>
              : <span style={{ fontSize: 14, color: '#8aaa85' }}>≡</span>
            }
          </button>
          {tab.fileTreeOpen && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {tab.loading ? (
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1, 2, 3].map(i => <div key={i} style={{ height: 14, borderRadius: 4, background: '#1e2a1c', animation: 'pulse 1.5s ease infinite' }} />)}
                </div>
              ) : tab.files.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: '#6b8a6b', marginBottom: 4 }}>No files yet</p>
                  <p style={{ fontSize: 11, color: '#4a6a4a' }}>Start chatting to generate code.</p>
                </div>
              ) : (
                <FileTree projectId={projectId} files={tab.files} onFileClick={tab.openFile} onFilesChanged={tab.fetchFiles} />
              )}
            </div>
          )}
        </div>

        {/* Editor area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#141a12' }}>
          {tab.activeFile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid #1e2a1c', background: '#0f1410', flexShrink: 0 }}>
              <span style={{ color: '#c5d0c0', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tab.activeFile.path}
              </span>
              {tab.isDirty && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ochre)', flexShrink: 0, display: 'inline-block' }} title="Unsaved changes" />}
              {tab.injectedFiles.has(tab.activeFile.path) && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ochre)', flexShrink: 0, display: 'inline-block' }} title="Injected" />}
              <SaveIndicator saving={tab.saving} isDirty={tab.isDirty} />
            </div>
          )}

          <div style={{ flex: 1, minHeight: 0 }}>
            {tab.activeFile ? (
              <CodeEditor
                key={tab.activeFile.path}
                content={tab.editorContent}
                filename={tab.activeFile.path}
                onChange={tab.handleEditorChange}
                onSave={(content) => tab.saveFile(content, true)}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: 32, background: '#141a12' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 12,
                  background: 'rgba(138,170,133,0.08)',
                  border: '1px solid rgba(138,170,133,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 22, color: '#8aaa85',
                  marginBottom: 18,
                }}>{'</>'}</div>
                {tab.files.length > 0 ? (
                  <>
                    <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 20, color: '#c5d0c0', fontWeight: 700, marginBottom: 6, letterSpacing: '-0.3px' }}>
                      Select a file
                    </h3>
                    <p style={{ fontSize: 13, color: '#7aaa75', fontFamily: 'DM Sans, sans-serif', maxWidth: 320, lineHeight: 1.55 }}>
                      Pick a file from the tree on the left to start editing.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 20, color: '#c5d0c0', fontWeight: 700, marginBottom: 6, letterSpacing: '-0.3px' }}>
                      No code yet
                    </h3>
                    <p style={{ fontSize: 13, color: '#7aaa75', fontFamily: 'DM Sans, sans-serif', maxWidth: 360, lineHeight: 1.6, marginBottom: 20 }}>
                      Open the Chat tab and ask Goblin to build something.<br />
                      Use <span style={{ background: 'rgba(212,169,74,0.12)', color: 'var(--ochre)', padding: '1px 6px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>Send to Code</span> on any generated snippet.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent('goblin:switchTab', { detail: 'chat' }))}
                        style={{
                          background: 'rgba(212,169,74,0.12)', color: 'var(--ochre)',
                          border: '1px solid rgba(212,169,74,0.35)',
                          borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                        }}
                      >
                        Open Chat →
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Pending injections panel */}
          {tab.pendingInjections.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(212,169,74,0.25)', flexShrink: 0, background: '#141a12' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'rgba(212,169,74,0.06)' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ochre)', fontFamily: 'DM Sans, sans-serif' }}>
                  ✦ {tab.pendingInjections.length} pending injection{tab.pendingInjections.length !== 1 ? 's' : ''}
                </span>
                <button onClick={tab.clearPendingInjections} style={{ background: 'none', border: 'none', color: '#6b8a6b', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
              </div>
              <div style={{ maxHeight: 160, overflowY: 'auto', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tab.pendingInjections.map(injection => <InjectionCard key={injection.id} injection={injection} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile FABs */}
      <div className="gb-mobile-fab" style={{ position: 'fixed', bottom: 80, right: 16, flexDirection: 'column', gap: 8, zIndex: 40 }}>
        <button onClick={tab.openPushModal} title="Push to GitHub" style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(30,58,28,0.95)', border: '1px solid rgba(138,170,133,0.3)', color: '#8aaa85', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' } as React.CSSProperties}>⬆</button>
        <button onClick={tab.handleDeploy} disabled={tab.deploying} title="Deploy" style={{ width: 56, height: 56, borderRadius: '50%', background: tab.deploying ? 'rgba(45,74,43,0.6)' : 'var(--moss)', border: 'none', color: 'var(--ochre)', fontSize: 22, cursor: tab.deploying ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(45,74,43,0.5)' } as React.CSSProperties}>{tab.deploying ? '…' : '▶'}</button>
      </div>

      {/* Build status bar */}
      {(tab.activeBuilds.length > 0 || tab.recentDone.length > 0) && (
        <div style={{ borderTop: '1px solid var(--div)', flexShrink: 0 }}>
          <BuildStatusBar builds={[...tab.activeBuilds, ...tab.recentDone]} />
        </div>
      )}

      {/* Deploy toast */}
      {tab.deployMessage && (
        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: '#1e3a1c', border: '1px solid rgba(212,169,74,0.35)', borderRadius: 8, padding: '8px 16px', fontSize: 12, color: 'var(--ochre)', fontFamily: 'DM Sans, sans-serif', zIndex: 50, whiteSpace: 'nowrap', maxWidth: 400, textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
          {tab.deployMessage}
        </div>
      )}

      {/* Modals */}
      <ConnectGitHubModal open={tab.connectGitHubOpen} onClose={() => tab.setConnectGitHubOpen(false)} onConnected={() => { tab.setConnectGitHubOpen(false); tab.setPushModalOpen(true); }} />
      <PushToGitHubModal open={tab.pushModalOpen} onClose={() => tab.setPushModalOpen(false)} projectId={projectId} defaultName={projectName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')} />
    </div>
  );
}

function InjectionCard({ injection }: { injection: PendingInjection }) {
  const typeIcon = injection.payloadType === 'code' ? '</>' : injection.payloadType === 'prompt' ? '✦' : '≡';
  const typeLabel = injection.payloadType === 'code' ? 'CODE' : injection.payloadType === 'prompt' ? 'PROMPT' : 'MIXED';
  const preview = injection.payload.length > 80 ? injection.payload.slice(0, 80) + '…' : injection.payload;
  return (
    <div className="gb-injection-card" style={{ borderRadius: 8, border: '1px solid rgba(212,169,74,0.4)', overflow: 'hidden', background: '#1a2018' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(212,169,74,0.08)', borderBottom: '1px solid rgba(212,169,74,0.25)' }}>
        <span style={{ color: 'var(--ochre)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{typeIcon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ochre)', fontFamily: 'JetBrains Mono, monospace' }}>[{typeLabel}]</span>
        {injection.filenameHint && <span style={{ fontSize: 11, color: '#8aaa85', fontFamily: 'JetBrains Mono, monospace', marginLeft: 4 }}>{injection.filenameHint}</span>}
        <span style={{ fontSize: 10, color: '#6b8a6b', marginLeft: 'auto', fontFamily: 'DM Sans, sans-serif' }}>{new Date(injection.createdAt).toLocaleTimeString()}</span>
      </div>
      <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', padding: '8px 12px', overflowX: 'auto', fontFamily: 'JetBrains Mono, monospace', color: '#8aaa85', background: '#1a2018', margin: 0 }}>{preview}</pre>
    </div>
  );
}
