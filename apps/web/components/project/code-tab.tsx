"use client";

import dynamic from "next/dynamic";
import { useApp, type PendingInjection } from "@/contexts/app-context";
import { SaveIndicator } from "@/components/editor/save-indicator";
import { PushToGitHubModal } from "./push-to-github-modal";
import { ConnectGitHubModal } from "./connect-github-modal";
import { DiffModal } from "./diff-modal";
import { BuildStatusBar } from "@/components/build/build-status-bar";
import { InjectedBanner } from "./InjectedBanner";
import { CodeActionBar } from "@/components/code/CodeActionBar";
import { CodeFileTabs } from "@/components/code/CodeFileTabs";
import { CodeFileTreePanel } from "@/components/code/CodeFileTreePanel";
import { CodeMobileFileSheet } from "@/components/code/CodeMobileFileSheet";
import { CodeEmptyState } from "@/components/code/CodeEmptyState";
import { useCodeTab } from "@/hooks/useCodeTab";
import { Icon } from "@/components/ui/icon";
import { GoblinMark } from "@/components/ui/goblin-mark";

const CodeEditor = dynamic(
  () => import("@/components/editor/code-editor").then(m => ({ default: m.CodeEditor })),
  {
    ssr: false,
    loading: () => (
      <div style={{ flex: 1, background: 'var(--surface-ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-on-dark-3)', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
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
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--rule-strong)', border: '1px solid var(--brand-green)', borderRadius: 12, padding: '20px 24px', zIndex: 71, minWidth: 280, boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 13, color: 'var(--ink-on-dark-1)', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
              Save changes to <span style={{ color: 'var(--brand-gold)', fontFamily: 'JetBrains Mono, monospace' }}>{tab.activeFile?.path.split('/').pop()}</span>?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => tab.confirmSwitch(true)} style={{ background: 'var(--brand-green)', border: 'none', color: 'var(--brand-gold)', borderRadius: 7, padding: '7px 14px', fontSize: 'var(--t-caption-fs)', cursor: 'pointer' }}>Save</button>
              <button onClick={() => tab.confirmSwitch(false)} style={{ background: 'transparent', border: '1px solid var(--brand-green)', color: 'var(--ink-on-dark-2)', borderRadius: 7, padding: '7px 14px', fontSize: 'var(--t-caption-fs)', cursor: 'pointer' }}>Discard</button>
              <button onClick={() => tab.setPendingFileSwitch(null)} style={{ background: 'transparent', border: '1px solid var(--brand-green)', color: 'var(--ink-on-dark-3)', borderRadius: 7, padding: '7px 14px', fontSize: 'var(--t-caption-fs)', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* Mobile file tree toggle FAB */}
      <button
        className="gb-mobile-tree-toggle"
        onClick={() => tab.setMobileDrawerOpen(!tab.mobileDrawerOpen)}
        aria-label="Toggle file tree"
        style={{ position: 'fixed', bottom: 80, left: 16, zIndex: 40, width: 44, height: 44, borderRadius: '50%', background: 'var(--brand-green)', border: 'none', color: 'var(--brand-gold)', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}
      ><Icon name="menu" size={18} /></button>

      {/* Mobile file tree drawer */}
      <CodeMobileFileSheet
        open={tab.mobileDrawerOpen}
        projectId={projectId}
        files={tab.files}
        onClose={() => tab.setMobileDrawerOpen(false)}
        onFileClick={tab.openFile}
        onFilesChanged={tab.fetchFiles}
      />

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
      <CodeActionBar deploying={tab.deploying} onDeploy={tab.handleDeploy} onPush={tab.openPushModal} />

      {/* Open-file tabs */}
      <CodeFileTabs
        openFiles={tab.openFiles}
        activePath={tab.activeFile?.path ?? null}
        injectedFiles={tab.injectedFiles}
        isDirty={tab.isDirty}
        onSelect={tab.openFile}
        onClose={tab.closeTab}
      />

      {/* Mobile file picker (fallback for very small screens) */}
      <div className="gb-mobile-picker" style={{ borderBottom: '1px solid var(--rule-strong)', background: 'var(--green-950)', flexShrink: 0 }}>
        <select
          value={tab.activeFile?.path ?? ''}
          onChange={e => e.target.value && tab.openFile(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', background: 'transparent', color: 'var(--ink-on-dark-2)', border: 'none', outline: 'none', fontFamily: 'JetBrains Mono, monospace', fontSize: 'var(--t-caption-fs)', cursor: 'pointer', appearance: 'none' } as React.CSSProperties}
        >
          {!tab.activeFile && <option value="">— select a file —</option>}
          {tab.files.map(f => <option key={f} value={f} style={{ background: 'var(--surface-ink-2)', color: 'var(--ink-on-dark-1)' }}>{f}</option>)}
        </select>
      </div>

      {/* Desktop layout: file tree + editor */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <CodeFileTreePanel
          projectId={projectId}
          files={tab.files}
          loading={tab.loading}
          open={tab.fileTreeOpen}
          onToggle={() => tab.setFileTreeOpen(!tab.fileTreeOpen)}
          onFileClick={tab.openFile}
          onFilesChanged={tab.fetchFiles}
        />

        {/* Editor area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--surface-ink-2)' }}>
          {tab.activeFile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--rule-strong)', background: 'var(--green-950)', flexShrink: 0 }}>
              <span style={{ color: 'var(--ink-on-dark-1)', fontFamily: 'JetBrains Mono, monospace', fontSize: 'var(--t-caption-fs)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tab.activeFile.path}
              </span>
              {tab.isDirty && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-gold)', flexShrink: 0, display: 'inline-block' }} title="Unsaved changes" />}
              {tab.injectedFiles.has(tab.activeFile.path) && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-gold)', flexShrink: 0, display: 'inline-block' }} title="Injected" />}
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
                onSave={(content) => tab.saveFile(content)}
              />
            ) : (
              <CodeEmptyState hasFiles={tab.files.length > 0} />
            )}
          </div>

          {/* Pending injections panel */}
          {tab.pendingInjections.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(212,169,74,0.25)', flexShrink: 0, background: 'var(--surface-ink-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'rgba(212,169,74,0.06)' }}>
                <span style={{ fontSize: 'var(--t-caption-fs)', fontWeight: 600, color: 'var(--brand-gold)', fontFamily: 'var(--font-sans)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="ai" size={12} /> {tab.pendingInjections.length} pending injection{tab.pendingInjections.length !== 1 ? 's' : ''}
                </span>
                <button onClick={tab.clearPendingInjections} aria-label="Clear" style={{ background: 'none', border: 'none', color: 'var(--ink-on-dark-3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Icon name="close" size={14} /></button>
              </div>
              <div style={{ maxHeight: 160, overflowY: 'auto', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tab.pendingInjections.map(injection => <InjectionCard key={injection.id} injection={injection} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile FABs — quick deploy + push (mobile-only equivalent of CodeActionBar) */}
      <div className="gb-mobile-fab" style={{ position: 'fixed', bottom: 80, right: 16, flexDirection: 'column', gap: 8, zIndex: 40 }}>
        <button onClick={tab.openPushModal} aria-label="Push to GitHub" title="Push to GitHub" style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(30,58,28,0.95)', border: '1px solid rgba(138,170,133,0.3)', color: 'var(--ink-on-dark-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' } as React.CSSProperties}>
          <Icon name="github" size={18} />
        </button>
        <button onClick={tab.handleDeploy} disabled={tab.deploying} aria-label="Deploy" title="Deploy" style={{ width: 56, height: 56, borderRadius: '50%', background: tab.deploying ? 'rgba(45,74,43,0.6)' : 'var(--brand-green)', border: 'none', color: 'var(--brand-gold)', cursor: tab.deploying ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(45,74,43,0.5)' } as React.CSSProperties}>
          {tab.deploying ? <GoblinMark size={22} /> : <Icon name="play" size={20} />}
        </button>
      </div>

      {/* Build status bar */}
      {(tab.activeBuilds.length > 0 || tab.recentDone.length > 0) && (
        <div style={{ borderTop: '1px solid var(--div)', flexShrink: 0 }}>
          <BuildStatusBar builds={[...tab.activeBuilds, ...tab.recentDone]} />
        </div>
      )}

      {/* Deploy toast */}
      {tab.deployMessage && (
        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: '#1e3a1c', border: '1px solid rgba(212,169,74,0.35)', borderRadius: 8, padding: '8px 16px', fontSize: 'var(--t-caption-fs)', color: 'var(--brand-gold)', fontFamily: 'var(--font-sans)', zIndex: 50, whiteSpace: 'nowrap', maxWidth: 400, textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
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
  const iconName = injection.payloadType === 'code' ? 'code' as const : injection.payloadType === 'prompt' ? 'ai' as const : 'layout' as const;
  const typeLabel = injection.payloadType === 'code' ? 'CODE' : injection.payloadType === 'prompt' ? 'PROMPT' : 'MIXED';
  const preview = injection.payload.length > 80 ? injection.payload.slice(0, 80) + '…' : injection.payload;
  return (
    <div className="gb-injection-card" style={{ borderRadius: 8, border: '1px solid rgba(212,169,74,0.4)', overflow: 'hidden', background: 'var(--surface-ink-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(212,169,74,0.08)', borderBottom: '1px solid rgba(212,169,74,0.25)' }}>
        <span style={{ color: 'var(--brand-gold)', display: 'inline-flex' }}><Icon name={iconName} size={12} /></span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--brand-gold)', fontFamily: 'JetBrains Mono, monospace' }}>[{typeLabel}]</span>
        {injection.filenameHint && <span style={{ fontSize: 11, color: 'var(--ink-on-dark-2)', fontFamily: 'JetBrains Mono, monospace', marginLeft: 4 }}>{injection.filenameHint}</span>}
        <span style={{ fontSize: 10, color: 'var(--ink-on-dark-3)', marginLeft: 'auto', fontFamily: 'var(--font-sans)' }}>{new Date(injection.createdAt).toLocaleTimeString()}</span>
      </div>
      <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', padding: '8px 12px', overflowX: 'auto', fontFamily: 'JetBrains Mono, monospace', color: 'var(--ink-on-dark-2)', background: 'var(--surface-ink-2)', margin: 0 }}>{preview}</pre>
    </div>
  );
}
