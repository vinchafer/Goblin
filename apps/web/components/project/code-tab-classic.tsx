"use client";

import { useState } from "react";
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
import { useEditorTheme } from "@/hooks/code/useEditorTheme";
import { Icon } from "@/components/ui/icon";
import { GoblinLogo } from "@/components/brand/GoblinLogo";

const CodeEditor = dynamic(
  () => import("@/components/editor/code-editor").then(m => ({ default: m.CodeEditor })),
  {
    ssr: false,
    loading: () => (
      <div style={{ flex: 1, background: 'var(--ed-canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ed-fg-3)', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
        Editor lädt…
      </div>
    ),
  }
);

interface CodeTabProps {
  projectId: string;
  projectName?: string;
  pendingCode?: { content: string; filename?: string; files?: { path: string; content: string }[] } | null;
}

// Sprint-6 single-buffer Code Tab — preserved as the graceful fallback when the
// Sprint-7 multi-session API is unavailable (endpoint not deployed / table missing).
// Do not regress: light editor + Save↔Deploy Zwischenraum live here untouched.
export function CodeTabClassic({ projectId, projectName = 'project', pendingCode }: CodeTabProps) {
  const tab = useCodeTab(projectId, pendingCode);
  const [editorTheme, , toggleEditorTheme] = useEditorTheme();
  const [deployConfirm, setDeployConfirm] = useState(false);

  return (
    <div className="gb-codetab" data-editor-theme={editorTheme} style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--ed-canvas)' }}>
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
          onApplyContent={tab.handleDiffApplyContent}
          onDiscard={() => tab.setDiffData(null)}
        />
      )}

      {/* Dirty-state file switch dialog */}
      {tab.pendingFileSwitch && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.5)' }} onClick={() => tab.setPendingFileSwitch(null)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--ed-chrome-2)', border: '1px solid var(--ed-rule)', borderRadius: 12, padding: '20px 24px', zIndex: 71, minWidth: 280, boxShadow: '0 16px 40px rgba(15,43,30,0.28)' }}>
            <div style={{ fontSize: 13, color: 'var(--ed-fg-1)', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
              Änderungen an <span style={{ color: 'var(--ed-accent)', fontFamily: 'JetBrains Mono, monospace' }}>{tab.activeFile?.path.split('/').pop()}</span> sichern?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => tab.confirmSwitch(true)} style={{ background: 'var(--ed-primary)', border: 'none', color: 'var(--ed-on-primary)', borderRadius: 8, padding: '7px 14px', fontSize: 'var(--t-caption-fs)', cursor: 'pointer' }}>Sichern</button>
              <button onClick={() => tab.confirmSwitch(false)} style={{ background: 'transparent', border: '1px solid var(--ed-rule)', color: 'var(--ed-fg-2)', borderRadius: 8, padding: '7px 14px', fontSize: 'var(--t-caption-fs)', cursor: 'pointer' }}>Verwerfen</button>
              <button onClick={() => tab.setPendingFileSwitch(null)} style={{ background: 'transparent', border: '1px solid var(--ed-rule)', color: 'var(--ed-fg-3)', borderRadius: 8, padding: '7px 14px', fontSize: 'var(--t-caption-fs)', cursor: 'pointer' }}>Abbrechen</button>
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

      {/* Injection Banner — code arrives as a DRAFT, no adjacent deploy */}
      {pendingCode && (
        <InjectedBanner
          pendingCode={pendingCode}
          undoPayload={tab.undoPayload}
          onApply={tab.handleSendToCodeApply}
          onUndo={tab.handleUndoInjection}
          onDismiss={() => tab.setPendingCodePayload(null)}
        />
      )}

      {/* Deploy confirmation — Veröffentlichen is a deliberate, separate step */}
      {deployConfirm && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--surface-overlay)' }} onClick={() => setDeployConfirm(false)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--ed-chrome-2)', border: '1px solid var(--ed-rule)', borderRadius: 14, padding: '22px 24px', zIndex: 81, minWidth: 320, maxWidth: 380, boxShadow: '0 16px 40px rgba(15,43,30,0.28)' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ed-fg-1)', fontFamily: 'var(--font-sans)', marginBottom: 8 }}>
              Veröffentlichen?
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ed-fg-3)', fontFamily: 'var(--font-sans)', marginBottom: 18 }}>
              Das baut dein Projekt und stellt es unter einer öffentlichen URL bereit. Du kannst vorher in Ruhe sichern und ansehen.
              <span style={{ display: 'block', marginTop: 8, fontStyle: 'italic', color: 'var(--ed-fg-3)' }}>
                Läuft über deinen eigenen Vercel-Account — deine Domain, deine Kosten.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeployConfirm(false)} style={{ background: 'transparent', border: '1px solid var(--ed-rule)', color: 'var(--ed-fg-2)', borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Abbrechen</button>
              <button onClick={() => { setDeployConfirm(false); tab.handleDeploy(); }} style={{ background: 'var(--ed-primary)', border: 'none', color: 'var(--ed-on-primary)', borderRadius: 9, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="play" size={14} /> Veröffentlichen</button>
            </div>
          </div>
        </>
      )}

      {/* No Vercel token — "bring your own Vercel" explainer (10.6-5) */}
      {tab.needsVercel && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--surface-overlay)' }} onClick={tab.dismissNeedsVercel} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--ed-chrome-2)', border: '1px solid var(--ed-rule)', borderRadius: 14, padding: '24px', zIndex: 81, minWidth: 320, maxWidth: 420, boxShadow: '0 16px 40px rgba(15,43,30,0.28)' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ed-fg-1)', fontFamily: 'var(--font-sans)', marginBottom: 10 }}>
              Erstes Mal Live? Du brauchst einen Vercel-Account (gratis).
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ed-fg-3)', fontFamily: 'var(--font-sans)', marginBottom: 14 }}>
              Goblin pusht deinen Code in deinen <b>eigenen</b> Vercel-Account. So gehört
              das Projekt dir, du kontrollierst die Kosten, und du kannst es jederzeit zu
              einem anderen Hoster mitnehmen.
            </div>
            <ol style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--ed-fg-2)', fontFamily: 'var(--font-sans)', margin: '0 0 18px', paddingLeft: 18 }}>
              <li>Bei Vercel registrieren (1 Minute)</li>
              <li>Token erstellen unter vercel.com/account/tokens</li>
              <li>Token in Einstellungen → Konnektoren → Vercel einfügen</li>
            </ol>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button onClick={tab.dismissNeedsVercel} style={{ background: 'transparent', border: '1px solid var(--ed-rule)', color: 'var(--ed-fg-3)', borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Später</button>
              <a href="https://vercel.com/account/tokens" target="_blank" rel="noopener noreferrer" onClick={tab.dismissNeedsVercel} style={{ background: 'transparent', border: '1px solid var(--ed-rule)', color: 'var(--ed-fg-1)', borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Habe schon einen Account → Token</a>
              <a href="https://vercel.com/signup" target="_blank" rel="noopener noreferrer" style={{ background: 'var(--ed-primary)', border: 'none', color: 'var(--ed-on-primary)', borderRadius: 9, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7 }}>Bei Vercel registrieren →</a>
            </div>
          </div>
        </>
      )}

      {/* Action Bar */}
      <CodeActionBar deploying={tab.deploying} onDeploy={() => setDeployConfirm(true)} onPush={tab.openPushModal} editorTheme={editorTheme} onToggleTheme={toggleEditorTheme} />

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
      <div className="gb-mobile-picker" style={{ borderBottom: '1px solid var(--ed-rule)', background: 'var(--ed-chrome)', flexShrink: 0 }}>
        <select
          value={tab.activeFile?.path ?? ''}
          onChange={e => e.target.value && tab.openFile(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', background: 'transparent', color: 'var(--ed-fg-2)', border: 'none', outline: 'none', fontFamily: 'JetBrains Mono, monospace', fontSize: 'var(--t-caption-fs)', cursor: 'pointer', appearance: 'none' } as React.CSSProperties}
        >
          {!tab.activeFile && <option value="">— select a file —</option>}
          {tab.files.map(f => <option key={f} value={f} style={{ background: 'var(--ed-canvas)', color: 'var(--ed-fg-1)' }}>{f}</option>)}
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--ed-canvas)' }}>
          {tab.activeFile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--ed-rule)', background: 'var(--ed-chrome)', flexShrink: 0 }}>
              <span style={{ color: 'var(--ed-fg-1)', fontFamily: 'JetBrains Mono, monospace', fontSize: 'var(--t-caption-fs)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                theme={editorTheme}
                onChange={tab.handleEditorChange}
                onSave={(content) => tab.saveFile(content)}
              />
            ) : (
              <CodeEmptyState hasFiles={tab.files.length > 0} />
            )}
          </div>

          {/* Pending injections panel */}
          {tab.pendingInjections.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(212,169,74,0.25)', flexShrink: 0, background: 'var(--ed-canvas)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'rgba(212,169,74,0.06)' }}>
                <span style={{ fontSize: 'var(--t-caption-fs)', fontWeight: 600, color: 'var(--brand-gold)', fontFamily: 'var(--font-sans)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="ai" size={12} /> {tab.pendingInjections.length} pending injection{tab.pendingInjections.length !== 1 ? 's' : ''}
                </span>
                <button onClick={tab.clearPendingInjections} aria-label="Clear" style={{ background: 'none', border: 'none', color: 'var(--ed-fg-3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Icon name="close" size={14} /></button>
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
        <button onClick={tab.openPushModal} aria-label="Push to GitHub" title="Push to GitHub" style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(30,58,28,0.95)', border: '1px solid rgba(138,170,133,0.3)', color: 'var(--ed-fg-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' } as React.CSSProperties}>
          <Icon name="github" size={18} />
        </button>
        <button onClick={() => setDeployConfirm(true)} disabled={tab.deploying} aria-label="Veröffentlichen" title="Veröffentlichen" style={{ width: 56, height: 56, borderRadius: '50%', background: tab.deploying ? 'rgba(45,74,43,0.6)' : 'var(--brand-green)', border: 'none', color: 'var(--brand-gold)', cursor: tab.deploying ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(45,74,43,0.5)' } as React.CSSProperties}>
          {tab.deploying ? <GoblinLogo state="working" size={22} variant="gold" /> : <Icon name="play" size={20} />}
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
    <div className="gb-injection-card" style={{ borderRadius: 8, border: '1px solid rgba(212,169,74,0.4)', overflow: 'hidden', background: 'var(--ed-canvas)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(212,169,74,0.08)', borderBottom: '1px solid rgba(212,169,74,0.25)' }}>
        <span style={{ color: 'var(--brand-gold)', display: 'inline-flex' }}><Icon name={iconName} size={12} /></span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--brand-gold)', fontFamily: 'JetBrains Mono, monospace' }}>[{typeLabel}]</span>
        {injection.filenameHint && <span style={{ fontSize: 11, color: 'var(--ed-fg-2)', fontFamily: 'JetBrains Mono, monospace', marginLeft: 4 }}>{injection.filenameHint}</span>}
        <span style={{ fontSize: 10, color: 'var(--ed-fg-3)', marginLeft: 'auto', fontFamily: 'var(--font-sans)' }}>{new Date(injection.createdAt).toLocaleTimeString()}</span>
      </div>
      <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', padding: '8px 12px', overflowX: 'auto', fontFamily: 'JetBrains Mono, monospace', color: 'var(--ed-fg-2)', background: 'var(--ed-canvas)', margin: 0 }}>{preview}</pre>
    </div>
  );
}
