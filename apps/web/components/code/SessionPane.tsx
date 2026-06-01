"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { undo, redo, undoDepth, redoDepth } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import { Undo2, Redo2 } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { GoblinLogo } from "@/components/brand/GoblinLogo";
import { SessionThread } from "./SessionThread";
import { SessionPromptInput } from "./SessionPromptInput";
import { useCodeSessionDetail } from "@/hooks/code/useCodeSessionDetail";
import { useCodeAgent } from "@/hooks/code/useCodeAgent";
import type { EditorTheme } from "@/hooks/code/useEditorTheme";
import type { CodeSession } from "@/hooks/code/useCodeSessions";

const CodeEditor = dynamic(
  () => import("@/components/editor/code-editor").then(m => ({ default: m.CodeEditor })),
  { ssr: false, loading: () => <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ed-fg-3)", fontFamily: "JetBrains Mono, monospace", fontSize: 13 }}>Editor lädt…</div> },
);

interface Props {
  session: CodeSession;
  theme: EditorTheme;
  onModelChange: (modelId: string) => void;
  onDraftCountChange: (n: number) => void;
}

/** One session = thread (talk) + work surface (the file in play). Desktop split,
 *  mobile single-column. The change-state spine (Entwurf → Gesichert → Veröffentlicht)
 *  lives in the work-surface status line; deploy is gated on Saved. */
export function SessionPane({ session, theme, onModelChange, onDraftCountChange }: Props) {
  const detail = useCodeSessionDetail(session.id);
  const agent = useCodeAgent(session.id);
  const [mobileView, setMobileView] = useState<"thread" | "editor">("thread");
  const [deployConfirm, setDeployConfirm] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [liveDismissed, setLiveDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  // Seed the persistent live-URL card from the session's last deploy, so it
  // survives a browser close + reopen (not just the deploy moment).
  useEffect(() => { if (detail.deployUrl) setLiveUrl(detail.deployUrl); }, [detail.deployUrl]);

  // Keep parent's tab badge in sync with the real draft count.
  useEffect(() => { onDraftCountChange(detail.draftCount); }, [detail.draftCount, onDraftCountChange]);

  // While streaming, surface the block currently being written (overlay only).
  const liveBlock = useMemo(() => {
    if (!agent.streaming) return null;
    return agent.blocks[agent.blocks.length - 1] ?? null;
  }, [agent.streaming, agent.blocks]);

  // ── Undo / Redo (CodeMirror history) ──
  // The editor stays mounted across the AI boundary (the live stream is a separate
  // overlay), so an AI generation lands as ONE undoable transaction via the
  // external-content update. Manual edits use CodeMirror's per-keystroke history.
  const editorViewRef = useRef<EditorView | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const refreshHistory = useCallback(() => {
    const v = editorViewRef.current;
    if (!v) { setCanUndo(false); setCanRedo(false); return; }
    setCanUndo(undoDepth(v.state) > 0);
    setCanRedo(redoDepth(v.state) > 0);
  }, []);
  const doUndo = useCallback(() => { const v = editorViewRef.current; if (v) { undo(v); v.focus(); refreshHistory(); } }, [refreshHistory]);
  const doRedo = useCallback(() => { const v = editorViewRef.current; if (v) { redo(v); v.focus(); refreshHistory(); } }, [refreshHistory]);

  const handleSubmit = (prompt: string) => {
    agent.submit(prompt, session.model_id ?? undefined, async () => {
      await detail.refresh();          // pull the persisted draft files
      agent.reset();
      setMobileView("editor");
    });
    setMobileView("editor");
  };

  const handleViewFile = (path: string) => { detail.setActivePath(path); setMobileView("editor"); };

  const runDeploy = async () => {
    setDeployConfirm(false);
    setDeploying(true);
    setToast("Veröffentliche …");
    const { url, error } = await detail.deploySession((msg) => setToast(msg));
    setDeploying(false);
    if (url) {
      // Persistent live-URL card (no auto-dismiss) instead of a fleeting toast.
      setLiveUrl(url);
      setLiveDismissed(false);
      setToast(null);
    } else {
      setToast(error ?? "Veröffentlichen fehlgeschlagen");
      setTimeout(() => setToast(null), 6000);
    }
  };

  const copyLiveUrl = () => {
    if (!liveUrl) return;
    navigator.clipboard?.writeText(liveUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const doSave = async () => {
    const ok = await detail.saveSession();
    setToast(ok ? "Gesichert" : "Konnte nicht sichern — erneut?");
    setTimeout(() => setToast(null), 3000);
  };

  // ── Status line state ──
  const state = detail.aggregateState;
  const canSave = detail.draftCount > 0;
  const canDeploy = detail.files.length > 0 && detail.draftCount === 0;

  const editorFilename = liveBlock ? liveBlock.path : (detail.activeFile?.path ?? "index.html");

  return (
    <div className="gb-session-pane" style={{ flex: 1, display: "flex", minHeight: 0, position: "relative" }}>
      <style>{`
        .gb-session-pane { flex-direction: row; }
        .gb-thread-col { width: 42%; max-width: 520px; min-width: 320px; border-right: 1px solid var(--ed-rule); }
        .gb-surface-col { flex: 1; min-width: 0; }
        .gb-mobile-back { display: none; }
        @media (max-width: 860px) {
          .gb-session-pane { flex-direction: column; }
          .gb-thread-col { width: 100%; max-width: none; min-width: 0; border-right: none; display: ${mobileView === "thread" ? "flex" : "none"}; }
          .gb-surface-col { display: ${mobileView === "editor" ? "flex" : "none"}; }
          .gb-mobile-back { display: inline-flex !important; }
        }
      `}</style>

      {/* THREAD column */}
      <div className="gb-thread-col" style={{ display: "flex", flexDirection: "column", minHeight: 0, background: "var(--ed-canvas)" }}>
        <SessionThread
          messages={detail.messages}
          streaming={agent.streaming}
          streamingText={agent.text}
          streamingModel={agent.model}
          onViewFile={handleViewFile}
        />
        {agent.error && (
          <div style={{ margin: "0 16px 8px", padding: "8px 12px", borderRadius: 8, background: "rgba(176,67,42,0.08)", border: "1px solid rgba(176,67,42,0.3)", color: "#B0432A", fontSize: 12.5, fontFamily: "var(--font-sans)" }}>
            {agent.error}
          </div>
        )}
        <SessionPromptInput
          modelId={session.model_id}
          onModelChange={onModelChange}
          onSubmit={handleSubmit}
          streaming={agent.streaming}
          onCancel={agent.cancel}
          autoFocus
        />
      </div>

      {/* WORK SURFACE column */}
      <div className="gb-surface-col" style={{ display: "flex", flexDirection: "column", minHeight: 0, background: "var(--ed-canvas)" }}>
        {/* File bar + status */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--ed-rule)", background: "var(--ed-chrome)", flexShrink: 0 }}>
          <button className="gb-mobile-back" onClick={() => setMobileView("thread")} aria-label="Zurück zum Thread" style={{ background: "transparent", border: "none", color: "var(--ed-fg-2)", cursor: "pointer", alignItems: "center" }}>
            <Icon name="back" size={16} />
          </button>
          <span style={{ color: "var(--ed-fg-1)", fontFamily: "JetBrains Mono, monospace", fontSize: 12.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {editorFilename}
          </span>
          {/* Undo / Redo — work for manual edits AND AI generations (one event). */}
          {detail.activeFile && !liveBlock && (
            <>
              <button onClick={doUndo} disabled={!canUndo} title="Rückgängig (Strg+Z)" aria-label="Rückgängig"
                style={{ display: "inline-flex", alignItems: "center", background: "transparent", border: "1px solid var(--ed-rule)", color: canUndo ? "var(--ed-fg-2)" : "var(--ed-fg-3)", borderRadius: 8, padding: "5px 8px", cursor: canUndo ? "pointer" : "not-allowed", opacity: canUndo ? 1 : 0.5 }}>
                <Undo2 size={14} />
              </button>
              <button onClick={doRedo} disabled={!canRedo} title="Wiederherstellen (Strg+Y)" aria-label="Wiederherstellen"
                style={{ display: "inline-flex", alignItems: "center", background: "transparent", border: "1px solid var(--ed-rule)", color: canRedo ? "var(--ed-fg-2)" : "var(--ed-fg-3)", borderRadius: 8, padding: "5px 8px", cursor: canRedo ? "pointer" : "not-allowed", opacity: canRedo ? 1 : 0.5 }}>
                <Redo2 size={14} />
              </button>
            </>
          )}
          {/* Review actions for a draft file (the editor is the review surface). */}
          {!liveBlock && detail.activeFile?.change_state === "draft" && (
            <>
              <button
                onClick={() => { navigator.clipboard?.writeText(detail.activeFile?.content ?? ""); setToast("Kopiert"); setTimeout(() => setToast(null), 1800); }}
                title="Kopieren"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-2)", borderRadius: 8, padding: "5px 9px", fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)" }}
              ><Icon name="copy" size={12} /> Kopieren</button>
              <button
                onClick={() => detail.activeFile && detail.discardDraft(detail.activeFile.path)}
                title="Entwurf verwerfen"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-3)", borderRadius: 8, padding: "5px 9px", fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)" }}
              ><Icon name="close" size={12} /> Verwerfen</button>
            </>
          )}
          <StateBadge state={liveBlock ? "draft" : state} />
        </div>

        {/* Editor / empty. The real editor stays mounted (key = file path only) so
            its undo history survives an AI generation; the live stream renders as an
            overlay on top. */}
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          {detail.activeFile ? (
            <CodeEditor
              key={detail.activeFile.path}
              content={detail.activeFile.content}
              filename={detail.activeFile.path}
              theme={theme}
              onChange={(c) => { detail.editActive(c); refreshHistory(); }}
              onSave={(c) => detail.editActive(c)}
              onEditorReady={(v) => { editorViewRef.current = v; refreshHistory(); }}
            />
          ) : !liveBlock ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
              <div style={{ textAlign: "center", maxWidth: 280, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.6 }}>
                Noch nichts zu zeigen. Stell links eine Aufgabe — der Code erscheint hier als Entwurf.
              </div>
            </div>
          ) : null}

          {liveBlock && (
            <div style={{ position: "absolute", inset: 0, background: "var(--ed-canvas)", display: "flex", flexDirection: "column" }}>
              <CodeEditor
                key={liveBlock.path + ":live"}
                content={liveBlock.content}
                filename={liveBlock.path}
                theme={theme}
                readOnly
              />
            </div>
          )}
        </div>

        {/* Persistent live URL — stays put after deploy (replaces the old toast
            that vanished after a few seconds). Survives reopen via detail.deployUrl. */}
        {liveUrl && !liveDismissed && (
          <div style={{ flexShrink: 0, borderTop: "1px solid var(--ed-rule)", background: "var(--ed-canvas)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6db97b", flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>Live</span>
            <a href={liveUrl} target="_blank" rel="noopener noreferrer" title={liveUrl} style={{ flex: 1, minWidth: 0, color: "var(--ed-accent)", fontFamily: "JetBrains Mono, monospace", fontSize: 12, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {liveUrl.replace(/^https?:\/\//, "")}
            </a>
            <button onClick={copyLiveUrl} title="URL kopieren" style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-2)", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)", flexShrink: 0 }}>
              <Icon name={copied ? "check" : "copy"} size={12} /> {copied ? "Kopiert" : "Kopieren"}
            </button>
            <a href={liveUrl} target="_blank" rel="noopener noreferrer" title="Im neuen Tab öffnen" style={{ display: "inline-flex", alignItems: "center", background: "var(--ed-primary)", color: "var(--ed-on-primary)", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, textDecoration: "none", flexShrink: 0, gap: 5 }}>
              <Icon name="play" size={12} /> Öffnen
            </a>
            <button onClick={() => setLiveDismissed(true)} aria-label="Ausblenden" title="Ausblenden" style={{ background: "transparent", border: "none", color: "var(--ed-fg-3)", cursor: "pointer", flexShrink: 0, display: "inline-flex", alignItems: "center" }}>
              <Icon name="close" size={14} />
            </button>
          </div>
        )}

        {/* Status line + the two-step Sichern → Veröffentlichen */}
        <div style={{ flexShrink: 0, borderTop: "1px solid var(--ed-rule)", background: "var(--ed-chrome)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)", flex: 1 }}>
            {state === "draft" && "Entwurf · nichts wird veröffentlicht, bis du sicherst"}
            {state === "saved" && "Gesichert · bereit zum Veröffentlichen"}
            {state === "deployed" && "Veröffentlicht"}
            {state === "empty" && "Noch keine Dateien"}
          </span>
          <button
            onClick={doSave}
            disabled={!canSave || detail.saving}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: canSave ? "var(--ed-primary)" : "transparent",
              color: canSave ? "var(--ed-on-primary)" : "var(--ed-fg-3)",
              border: canSave ? "none" : "1px solid var(--ed-rule)",
              borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 600,
              cursor: canSave && !detail.saving ? "pointer" : "not-allowed", fontFamily: "var(--font-sans)",
            }}
          >
            {detail.saving ? <GoblinLogo state="working" size={14} variant="gold" /> : <Icon name="save" size={14} />} Sichern
          </button>
          <span style={{ width: 1, height: 22, background: "var(--ed-rule)" }} />
          <button
            onClick={() => setDeployConfirm(true)}
            disabled={!canDeploy || deploying}
            title={canDeploy ? "Veröffentlichen" : "Erst alle Entwürfe sichern"}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "transparent", color: canDeploy ? "var(--ed-accent)" : "var(--ed-fg-3)",
              border: `1px solid ${canDeploy ? "var(--ed-accent)" : "var(--ed-rule)"}`,
              borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 600,
              cursor: canDeploy && !deploying ? "pointer" : "not-allowed", fontFamily: "var(--font-sans)",
            }}
          >
            {deploying ? <GoblinLogo state="working" size={14} variant="gold" /> : <Icon name="play" size={14} />} Veröffentlichen
          </button>
        </div>
      </div>

      {/* Deploy confirm */}
      {deployConfirm && (
        <>
          <div style={{ position: "absolute", inset: 0, zIndex: 80, background: "var(--surface-overlay, rgba(0,0,0,0.4))" }} onClick={() => setDeployConfirm(false)} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "var(--ed-chrome-2)", border: "1px solid var(--ed-rule)", borderRadius: 14, padding: "22px 24px", zIndex: 81, minWidth: 320, maxWidth: 380, boxShadow: "0 16px 40px rgba(15,43,30,0.28)" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ed-fg-1)", fontFamily: "var(--font-sans)", marginBottom: 8 }}>Veröffentlichen?</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)", marginBottom: 18 }}>
              Das baut dein Projekt und stellt es unter einer öffentlichen URL bereit. Du kannst vorher in Ruhe sichern und ansehen.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDeployConfirm(false)} style={{ background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-2)", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-sans)" }}>Abbrechen</button>
              <button onClick={runDeploy} style={{ background: "var(--ed-primary)", border: "none", color: "var(--ed-on-primary)", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)", display: "inline-flex", alignItems: "center", gap: 7 }}><Icon name="play" size={14} /> Veröffentlichen</button>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "var(--ed-primary)", color: "var(--ed-on-primary)", borderRadius: 9, padding: "9px 16px", fontSize: 12.5, fontFamily: "var(--font-sans)", zIndex: 90, maxWidth: 460, textAlign: "center", boxShadow: "0 6px 24px rgba(15,43,30,0.3)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function StateBadge({ state }: { state: "draft" | "saved" | "deployed" | "empty" }) {
  if (state === "empty") return null;
  const cfg = {
    draft: { color: "var(--ed-draft)", label: "Entwurf", hollow: true },
    saved: { color: "var(--ed-saved)", label: "Gesichert", hollow: false },
    deployed: { color: "var(--ed-deployed)", label: "Veröffentlicht", hollow: false },
  }[state];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: cfg.color, fontFamily: "var(--font-sans)", fontWeight: 600 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.hollow ? "transparent" : cfg.color, border: `1.5px solid ${cfg.color}` }} />
      {cfg.label}
    </span>
  );
}
