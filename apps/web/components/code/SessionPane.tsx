"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { undo, redo, undoDepth, redoDepth } from "@codemirror/commands";
import { openSearchPanel } from "@codemirror/search";
import type { EditorView } from "@codemirror/view";
import { Undo2, Redo2, Search } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { GoblinLogo } from "@/components/brand/GoblinLogo";
import { StreamingDiffView } from "./StreamingDiffView";
import { SessionThread } from "./SessionThread";
import { SessionPromptInput } from "./SessionPromptInput";
import { SessionGitPill } from "./SessionGitPill";
import { CodeFileTabs } from "./CodeFileTabs";
import { SessionFileNav } from "./SessionFileNav";
import { createTwoFilesPatch } from "diff";
import { parseCodeBlocks } from "@/lib/parse-code-blocks";
import { DiffModal } from "@/components/project/diff-modal";
import { useCodeSessionDetail } from "@/hooks/code/useCodeSessionDetail";
import { useCodeAgent } from "@/hooks/code/useCodeAgent";
import type { EditorTheme } from "@/hooks/code/useEditorTheme";
import type { CodeSession } from "@/hooks/code/useCodeSessions";
import { layoutPreset, type Intent } from "@/lib/intent";

const CodeEditor = dynamic(
  () => import("@/components/editor/code-editor").then(m => ({ default: m.CodeEditor })),
  { ssr: false, loading: () => <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ed-fg-3)", fontFamily: "JetBrains Mono, monospace", fontSize: 13 }}>Editor lädt…</div> },
);

/** B: one reviewable chat-driven edit of an existing file (base → proposed). */
interface ReviewItem { path: string; base: string; proposed: string; diff: string; }

interface Props {
  session: CodeSession;
  theme: EditorTheme;
  onModelChange: (modelId: string) => void;
  onDraftCountChange: (n: number) => void;
  /** Project intent → first-paint foreground (not a mode). Defaults Max-forward. */
  intent?: Intent;
  /** For the footer git pill (Slice 4). */
  projectId?: string;
}

/** One session = thread (talk) + work surface (the file in play). Desktop split,
 *  mobile single-column. The change-state spine (Entwurf → Gesichert → Veröffentlicht)
 *  lives in the work-surface status line; deploy is gated on Saved. */
export function SessionPane({ session, theme, onModelChange, onDraftCountChange, intent, projectId }: Props) {
  const detail = useCodeSessionDetail(session.id);
  const agent = useCodeAgent(session.id);
  const preset = layoutPreset(intent);
  const [mobileView, setMobileView] = useState<"thread" | "editor">(preset.mobileDefault);
  const [deployConfirm, setDeployConfirm] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [liveDismissed, setLiveDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  // Row 1b: hunk-review card on the LIVE surface. We snapshot the edited file's
  // pre-edit content at submit time (the only place the base exists — the agent
  // overwrites it with a draft), then show the Row-1 multi-hunk card base→draft.
  const reviewBaseRef = useRef<{ path: string; content: string } | null>(null);
  // B: snapshot ALL files pre-edit so a chat-driven edit to ANY existing file
  // (even with no file open → reviewBaseRef null) surfaces as a review card,
  // not just an "im Editor ansehen" chip. Map<path, pre-edit content>.
  const baseFilesRef = useRef<Map<string, string>>(new Map());
  // B: review queue — multi-file chat edits surface as sequential review cards
  // (reuse DiffModal). reviewCard = head of the queue.
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>([]);
  const reviewCard = reviewQueue[0] ?? null;
  // B: last computed review per path → the thread "Anwenden" can re-open it.
  const reviewsByPathRef = useRef<Map<string, ReviewItem>>(new Map());
  const [reviewablePaths, setReviewablePaths] = useState<Set<string>>(new Set());
  // WALK3-A: discarding a draft is irreversible (drafts live only client-side).
  // Never destroy on a single tap — confirm first, then a brief Undo restores it.
  const [discardConfirm, setDiscardConfirm] = useState<string | null>(null);
  const discardedRef = useRef<(typeof detail.files)[number] | null>(null);
  const [undoDiscard, setUndoDiscard] = useState<{ path: string } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); }, []);
  // 10.8-7: file navigation panel (browse/open all session files, add new).
  const [fileNavOpen, setFileNavOpen] = useState(false);
  // 10.8-9: deploy URL diagnostics, surfaced only with ?debug=1.
  const [deployDebug, setDeployDebug] = useState<{ deploymentUrl?: string; aliasUrl?: string } | null>(null);
  const debugMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";

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
    // Row 1b: snapshot the edited file's pre-edit content BEFORE the agent
    // overwrites it — the base for the hunk-review card (transient, client-only).
    reviewBaseRef.current = detail.activePath
      ? { path: detail.activePath, content: detail.activeFile?.content ?? "" }
      : null;
    // B: snapshot ALL files too — a chat-driven edit may touch a file that isn't
    // the open one (founder: "mach die Überschrift größer" with no file open).
    baseFilesRef.current = new Map(detail.files.map(f => [f.path, f.content]));
    // 10.8-8: pass the open file so the agent edits it in place (→ live diff)
    // rather than dumping a new file.
    agent.submit(prompt, session.model_id ?? undefined, async ({ text }) => {
      await detail.refresh();          // pull the persisted draft files
      agent.reset();
      setMobileView("editor");
      maybeOpenReviewCard(text);
    }, detail.activePath);
    setMobileView("editor");
  };

  // B: a chat turn → reviewable edits. Every produced block whose path matches an
  // EXISTING, non-empty file that actually changed becomes a review item. Covers
  // the open file AND files edited from the chat with nothing open; multi-file →
  // a queue of cards. New files (no pre-edit base) keep streaming as today.
  const buildReviews = (text: string): ReviewItem[] => {
    const snap = baseFilesRef.current;
    const items: ReviewItem[] = [];
    for (const b of parseCodeBlocks(text)) {
      if (!b.complete || !b.path) continue;
      const base = snap.get(b.path);
      if (base == null || !base.trim() || base === b.content) continue;
      const diff = createTwoFilesPatch(b.path, b.path, base, b.content, "Gesichert", "Entwurf");
      items.push({ path: b.path, base, proposed: b.content, diff });
    }
    return items;
  };

  const maybeOpenReviewCard = (text: string) => {
    reviewBaseRef.current = null;
    const items = buildReviews(text);
    if (items.length === 0) return;
    // Remember per path so the thread can re-open "Anwenden" for any of them.
    const map = reviewsByPathRef.current;
    for (const it of items) map.set(it.path, it);
    setReviewablePaths(new Set(map.keys()));
    const first = items[0]!;
    detail.setActivePath(first.path);
    setReviewQueue(items);
  };

  // B: a path is "settled" once applied or discarded — drop it from the thread's
  // Anwenden affordance and advance the queue (head is current card).
  const settleReviewable = (path: string) => {
    reviewsByPathRef.current.delete(path);
    setReviewablePaths(new Set(reviewsByPathRef.current.keys()));
  };
  const advanceQueue = () => {
    setReviewQueue(q => {
      const rest = q.slice(1);
      if (rest[0]) detail.setActivePath(rest[0].path);
      return rest;
    });
  };

  // B.2: re-open the review card for a path from the chat thread ("Anwenden").
  // Graceful: if the pre-edit base is no longer known, just open the file.
  const handleApplyFromChat = (path: string) => {
    const it = reviewsByPathRef.current.get(path);
    if (it) { detail.setActivePath(it.path); setReviewQueue([it]); }
    else handleViewFile(path);
    setMobileView("editor");
  };

  const handleViewFile = (path: string) => { detail.setActivePath(path); setMobileView("editor"); };

  // 10.8-7: open a file from the nav panel.
  const handleNavSelect = (path: string) => {
    detail.setActivePath(path);
    setMobileView("editor");
    setFileNavOpen(false);
  };

  // 10.8-7: create a new empty draft file, then focus it.
  const handleNewFile = async (name: string) => {
    if (detail.files.some(f => f.path === name)) { detail.setActivePath(name); setFileNavOpen(false); return; }
    await detail.persistFile(name, "", "draft");
    await detail.refresh();
    detail.setActivePath(name);
    setMobileView("editor");
    setFileNavOpen(false);
  };

  // WALK3-A: every draft discard goes through confirm + undo (no silent data loss).
  const requestDiscard = (path: string) => {
    const f = detail.files.find(x => x.path === path);
    // Only a draft is destructive (saved files persist on the server). Saved → plain close.
    if (f?.change_state === "draft") { setDiscardConfirm(path); return; }
    detail.discardDraft(path);
  };
  const confirmDiscard = () => {
    const path = discardConfirm;
    setDiscardConfirm(null);
    if (!path) return;
    discardedRef.current = detail.files.find(x => x.path === path) ?? null;
    detail.discardDraft(path);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoDiscard({ path });
    undoTimerRef.current = setTimeout(() => { setUndoDiscard(null); discardedRef.current = null; }, 7000);
  };
  const undoLastDiscard = () => {
    const snap = discardedRef.current;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoDiscard(null);
    if (!snap) return;
    detail.setFiles(prev => prev.some(x => x.path === snap.path) ? prev : [...prev, snap]);
    detail.setActivePath(snap.path);
    discardedRef.current = null;
  };

  const runDeploy = async () => {
    setDeployConfirm(false);
    setDeploying(true);
    setToast("Veröffentliche …");
    const { url, error, deploymentUrl, aliasUrl } = await detail.deploySession((msg) => setToast(msg));
    setDeploying(false);
    setDeployDebug({ deploymentUrl, aliasUrl });
    if (url) {
      // Persistent live-URL card (no auto-dismiss) instead of a fleeting toast.
      setLiveUrl(url);
      setLiveDismissed(false);
      setToast(null);
    } else {
      // 10.6-5: strip the NO_VERCEL_TOKEN marker so the user sees the plain
      // "bring your own Vercel" guidance, not the internal prefix.
      const msg = (error ?? "Veröffentlichen fehlgeschlagen").replace(/^NO_VERCEL_TOKEN —\s*/, "");
      setToast(msg);
      setTimeout(() => setToast(null), 8000);
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
    if (ok) {
      // Saved drafts → the pending chat reviews are now stale; clear them.
      reviewsByPathRef.current.clear();
      setReviewablePaths(new Set());
    }
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
        /* Base display lives in the stylesheet (NOT inline) so the @media toggle
           below can actually flip thread↔surface on mobile. Inline display:flex
           was overriding it → both columns stacked, the review squeezed to ~117px
           and Sichern/Veröffentlichen pushed off-screen (founder's Sofia bug). */
        .gb-thread-col { display: flex; width: ${preset.threadPct}%; max-width: 560px; min-width: 300px; border-right: 1px solid var(--ed-rule); }
        .gb-surface-col { display: flex; flex: 1; min-width: 0; }
        .gb-mobile-back { display: none; }
        @media (max-width: 860px) {
          .gb-session-pane { flex-direction: column; }
          .gb-thread-col { width: 100%; max-width: none; min-width: 0; border-right: none; display: ${mobileView === "thread" ? "flex" : "none"}; }
          .gb-surface-col { display: ${mobileView === "editor" ? "flex" : "none"}; }
          .gb-mobile-back { display: inline-flex !important; }
        }
        /* 10.8-6: mobile bottom-row is icon-only with 44px tap targets — no more
           overflow from "Kopieren Verwerfen Entwurf | Sichern | Veröffentlichen". */
        @media (max-width: 640px) {
          .gb-actbar { gap: 8px !important; justify-content: flex-end !important; }
          .gb-btn-lbl { display: none !important; }
          .gb-icon-btn { padding: 0 !important; width: 44px !important; height: 44px !important; justify-content: center !important; gap: 0 !important; }
          .gb-statusline { display: none !important; }
        }
      `}</style>

      {/* THREAD column */}
      <div className="gb-thread-col" style={{ flexDirection: "column", minHeight: 0, background: "var(--ed-canvas)" }}>
        <SessionThread
          messages={detail.messages}
          streaming={agent.streaming}
          streamingText={agent.text}
          streamingModel={agent.model}
          theme={theme}
          onViewFile={handleViewFile}
          onApplyFromChat={handleApplyFromChat}
          applicablePaths={reviewablePaths}
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
      <div className="gb-surface-col" style={{ flexDirection: "column", minHeight: 0, background: "var(--ed-canvas)", position: "relative" }}>
        {/* 10.8-7: file navigation panel (overlays the surface column). */}
        <SessionFileNav
          open={fileNavOpen}
          files={detail.files}
          activePath={detail.activePath}
          onClose={() => setFileNavOpen(false)}
          onSelect={handleNavSelect}
          onNewFile={handleNewFile}
        />
        {/* Multi-file tabs (Slice 3). The session already holds many files; tabs let
            Sofia switch between them. Hidden for a single file so Max's landing-page
            flow stays clean. Closing only discards drafts (saved files are a no-op). */}
        {!liveBlock && detail.files.length >= 2 && (
          <CodeFileTabs
            openFiles={detail.files.map(f => f.path)}
            activePath={detail.activePath}
            injectedFiles={new Set(detail.files.filter(f => f.change_state === "draft").map(f => f.path))}
            isDirty={detail.dirty}
            onSelect={(p) => detail.setActivePath(p)}
            onClose={(p) => requestDiscard(p)}
          />
        )}
        {/* File bar + status */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--ed-rule)", background: "var(--ed-chrome)", flexShrink: 0 }}>
          <button className="gb-mobile-back" onClick={() => setMobileView("thread")} aria-label="Zurück zum Thread" style={{ background: "transparent", border: "none", color: "var(--ed-fg-2)", cursor: "pointer", alignItems: "center" }}>
            <Icon name="back" size={16} />
          </button>
          {/* 10.8-7: open the file navigation panel (browse all session files). */}
          <button
            onClick={() => setFileNavOpen(true)}
            title="Dateien" aria-label="Dateien öffnen"
            style={{ display: "inline-flex", alignItems: "center", background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-2)", borderRadius: 8, padding: "5px 8px", cursor: "pointer", flexShrink: 0 }}
          >
            <Icon name="menu" size={14} />
          </button>
          <span style={{ color: "var(--ed-fg-1)", fontFamily: "JetBrains Mono, monospace", fontSize: 12.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {editorFilename}
          </span>
          {/* Find/Replace — keyboard does Ctrl+F/Ctrl+H; this button gives mobile +
              discoverability. Title surfaces the multi-cursor hint (Alt+Klick / Ctrl+D). */}
          {detail.activeFile && !liveBlock && (
            <button
              onClick={() => { const v = editorViewRef.current; if (v) { openSearchPanel(v); v.focus(); } }}
              title="Suchen / Ersetzen (Strg+F · Strg+H) — Alt+Klick oder Strg+D für Mehrfach-Cursor"
              aria-label="Suchen und Ersetzen"
              style={{ display: "inline-flex", alignItems: "center", background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-2)", borderRadius: 8, padding: "5px 8px", cursor: "pointer" }}
            >
              <Search size={14} />
            </button>
          )}
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
                className="gb-icon-btn"
                onClick={() => { navigator.clipboard?.writeText(detail.activeFile?.content ?? ""); setToast("Kopiert"); setTimeout(() => setToast(null), 1800); }}
                title="Kopieren"
                aria-label="Kopieren"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-2)", borderRadius: 8, padding: "5px 9px", fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)" }}
              ><Icon name="copy" size={12} /> <span className="gb-btn-lbl">Kopieren</span></button>
              <button
                className="gb-icon-btn"
                onClick={() => detail.activeFile && requestDiscard(detail.activeFile.path)}
                title="Entwurf verwerfen"
                aria-label="Entwurf verwerfen"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-3)", borderRadius: 8, padding: "5px 9px", fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)" }}
              ><Icon name="close" size={12} /> <span className="gb-btn-lbl">Verwerfen</span></button>
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

          {liveBlock && (() => {
            // If the streamed file already exists in this session, show a live
            // diff (added/removed lines). New files stream as plain content.
            const existing = detail.files.find((f) => f.path === liveBlock.path);
            return (
              <div style={{ position: "absolute", inset: 0, background: "var(--ed-canvas)", display: "flex", flexDirection: "column" }}>
                {existing ? (
                  <StreamingDiffView original={existing.content} modified={liveBlock.content} filename={liveBlock.path} />
                ) : (
                  <CodeEditor key={liveBlock.path + ":live"} content={liveBlock.content} filename={liveBlock.path} theme={theme} readOnly />
                )}
              </div>
            );
          })()}
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

        {/* 10.8-9: ?debug=1 surfaces every URL Vercel returned, so a future 404
            can be diagnosed by copying each candidate (production alias vs the
            protection-gated deployment hash url). */}
        {debugMode && deployDebug && (
          <div style={{ flexShrink: 0, borderTop: "1px dashed var(--ed-rule)", background: "var(--ed-chrome)", padding: "8px 14px", fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--ed-fg-3)" }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>DEBUG · Vercel URLs</div>
            <div>alias (öffentlich): {deployDebug.aliasUrl ?? "—"}</div>
            <div>deployment (geschützt): {deployDebug.deploymentUrl ?? "—"}</div>
          </div>
        )}

        {/* Status line + the two-step Sichern → Veröffentlichen */}
        <div className="gb-actbar" style={{ flexShrink: 0, borderTop: "1px solid var(--ed-rule)", background: "var(--ed-chrome)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
          {projectId && <SessionGitPill projectId={projectId} />}
          <span className="gb-statusline" style={{ fontSize: 12, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)", flex: 1 }}>
            {state === "draft" && "Entwurf · nichts wird veröffentlicht, bis du sicherst"}
            {state === "saved" && "Gesichert · bereit zum Veröffentlichen"}
            {state === "deployed" && "Veröffentlicht"}
            {state === "empty" && "Noch keine Dateien"}
          </span>
          <button
            className="gb-icon-btn"
            onClick={doSave}
            disabled={!canSave || detail.saving}
            title="Sichern"
            aria-label="Sichern"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: canSave ? "var(--ed-primary)" : "transparent",
              color: canSave ? "var(--ed-on-primary)" : "var(--ed-fg-3)",
              border: canSave ? "none" : "1px solid var(--ed-rule)",
              borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 600,
              cursor: canSave && !detail.saving ? "pointer" : "not-allowed", fontFamily: "var(--font-sans)",
            }}
          >
            {detail.saving ? <GoblinLogo state="working" size={14} variant="gold" /> : <Icon name="save" size={14} />} <span className="gb-btn-lbl">Sichern</span>
          </button>
          <span style={{ width: 1, height: 22, background: "var(--ed-rule)" }} />
          <button
            className="gb-icon-btn"
            onClick={() => setDeployConfirm(true)}
            disabled={!canDeploy || deploying}
            title={canDeploy ? "Veröffentlichen" : "Erst alle Entwürfe sichern"}
            aria-label="Veröffentlichen"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "transparent", color: canDeploy ? "var(--ed-accent)" : "var(--ed-fg-3)",
              border: `1px solid ${canDeploy ? "var(--ed-accent)" : "var(--ed-rule)"}`,
              borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 600,
              cursor: canDeploy && !deploying ? "pointer" : "not-allowed", fontFamily: "var(--font-sans)",
            }}
          >
            {deploying ? <GoblinLogo state="working" size={14} variant="gold" /> : <Icon name="play" size={14} />} <span className="gb-btn-lbl">Veröffentlichen</span>
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

      {/* WALK3-A: discard confirm — no draft is destroyed on a single unconfirmed tap. */}
      {discardConfirm && (
        <>
          <div style={{ position: "absolute", inset: 0, zIndex: 80, background: "var(--surface-overlay, rgba(0,0,0,0.4))" }} onClick={() => setDiscardConfirm(null)} />
          <div role="dialog" aria-label="Datei verwerfen" data-testid="discard-confirm" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "var(--ed-chrome-2)", border: "1px solid var(--ed-rule)", borderRadius: 14, padding: "22px 24px", zIndex: 81, minWidth: 320, maxWidth: 380, boxShadow: "0 16px 40px rgba(15,43,30,0.28)" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ed-fg-1)", fontFamily: "var(--font-sans)", marginBottom: 8 }}>Datei verwerfen?</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)", marginBottom: 18 }}>
              Nicht gespeicherte Änderungen an <span style={{ fontFamily: "JetBrains Mono, monospace", color: "var(--ed-fg-2)", wordBreak: "break-all" }}>{discardConfirm}</span> gehen verloren. Das kann nicht rückgängig gemacht werden.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDiscardConfirm(null)} style={{ background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-2)", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-sans)" }}>Abbrechen</button>
              <button data-testid="discard-confirm-yes" onClick={confirmDiscard} style={{ background: "var(--danger, #B0432A)", border: "none", color: "#fff", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)", display: "inline-flex", alignItems: "center", gap: 7 }}><Icon name="close" size={14} /> Verwerfen</button>
            </div>
          </div>
        </>
      )}

      {/* Row 1b: hunk-review card for a fresh agent edit of an existing file.
          Reuses the Row-1 DiffModal + lib/diff-hunks; applies a subset via the
          SAME draft write path (editActive). Save/publish wiring untouched. */}
      {reviewCard && (
        <DiffModal
          filePath={reviewCard.path}
          currentContent={reviewCard.base}
          proposedContent={reviewCard.proposed}
          diff={reviewCard.diff}
          onApply={() => { settleReviewable(reviewCard.path); advanceQueue(); }}                 /* whole file: draft already == proposed */
          onApplyContent={(content) => { detail.editActive(content); settleReviewable(reviewCard.path); advanceQueue(); }} /* subset → draft */
          onDiscard={() => { detail.discardDraft(reviewCard.path); settleReviewable(reviewCard.path); advanceQueue(); }}   /* existing discard */
        />
      )}

      {/* WALK3-A: Undo toast — restores the just-discarded draft for a few seconds. */}
      {undoDiscard && (
        <div data-testid="discard-undo" style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "var(--ed-chrome-2)", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-1)", borderRadius: 10, padding: "8px 10px 8px 14px", fontSize: 12.5, fontFamily: "var(--font-sans)", zIndex: 91, maxWidth: 460, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 6px 24px rgba(15,43,30,0.3)" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>Verworfen · {undoDiscard.path}</span>
          <button onClick={undoLastDiscard} style={{ background: "var(--ed-primary)", border: "none", color: "var(--ed-on-primary)", borderRadius: 7, padding: "6px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-sans)", display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}><Icon name="back" size={13} /> Rückgängig</button>
        </div>
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
