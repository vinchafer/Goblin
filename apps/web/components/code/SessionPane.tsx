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
import { CommandBar } from "./CommandBar";
import { StatusStrip } from "./StatusStrip";
import { FileCardList } from "./FileCardList";
import { Reader } from "./Reader";
import { DiffSheet } from "./DiffSheet";
import { VercelConnectSheet } from "./VercelConnectSheet";
import { LineActionSheet } from "./LineActionSheet";
import { EditorSearchOverlay } from "./EditorSearchOverlay";
import { JitCard } from "./JitCard";
import { AchievementUpgradeCard } from "./AchievementUpgradeCard";
import { bumpPublishCount, dismissJit, jitToShow, type JitKind } from "@/lib/jit-cards";
import { apiGet, apiPost } from "@/lib/api";
import { useRouter } from "next/navigation";
import type { CommandAnchor } from "./CommandBar";
import { buildAnchoredMessage } from "@/lib/anchor-message";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { fetchAllTextFilesWithStatus } from "@/lib/project-files";
import { lineDelta } from "@/lib/file-compare";
import { useLang, t } from "@/lib/use-lang";
import { createTwoFilesPatch } from "diff";
import { parseCodeBlocks, linkedLocalAssets } from "@/lib/parse-code-blocks";
import { DiffModal } from "@/components/project/diff-modal";
import { useCodeSessionDetail } from "@/hooks/code/useCodeSessionDetail";
import { useCodeAgent } from "@/hooks/code/useCodeAgent";
import { useAgentRun } from "@/hooks/code/useAgentRun";
import { AgentRunView } from "./AgentRunView";
import { FeedbackModal } from "@/components/feedback/FeedbackModal";
import { SupportChat } from "@/components/support/support-chat";
import { isAgentModel } from "@/lib/agent-eligible";
import type { EditorTheme } from "@/hooks/code/useEditorTheme";
import type { CodeSession } from "@/hooks/code/useCodeSessions";
import { layoutPreset, type Intent } from "@/lib/intent";
import { isPlaceholderTitle, titleFromPrompt } from "@/lib/session-title";

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
  /** A.3 (NAVFIX-3): rename a still-placeholder session from its first prompt. */
  onAutoTitle?: (name: string) => void;
  /** Project intent → first-paint foreground (not a mode). Defaults Max-forward. */
  intent?: Intent;
  /** For the footer git pill (Slice 4). */
  projectId?: string;
}

/** One session = thread (talk) + work surface (the file in play). Desktop split,
 *  mobile single-column. The change-state spine (Entwurf → Gesichert → Veröffentlicht)
 *  lives in the work-surface status line; deploy is gated on Saved. */
export function SessionPane({ session, theme, onModelChange, onDraftCountChange, onAutoTitle, intent, projectId }: Props) {
  const lang = useLang();
  const detail = useCodeSessionDetail(session.id);
  const agent = useCodeAgent(session.id);
  const agentRun = useAgentRun(session.id);
  const preset = layoutPreset(intent);
  const [mobileView, setMobileView] = useState<"thread" | "editor">(preset.mobileDefault);
  // A.2 (NAVFIX-2): on mobile the editor view hides the thread (display:none), so
  // you couldn't ask Goblin for a change without leaving the editor. A persistent
  // docked bar here routes through the SAME chat→edit path (handleSubmit) — the
  // change surfaces as the hunk-review card, the review is never hidden.
  const [askText, setAskText] = useState("");
  // M2 (MOBILE-1): the mobile Code surface is a file-card list (Tier 1) by
  // default, not the editor. Tapping a card opens the Reader (unchanged) or the
  // Diff sheet (changed). The editor (Tier 3) is reached via "Bearbeiten".
  const mobile = useIsMobile();
  const [mobileMain, setMobileMain] = useState<"cards" | "reader" | "editor">("cards");
  const [readerPath, setReaderPath] = useState<string | null>(null);
  const [diffPath, setDiffPath] = useState<string | null>(null);
  // M3 (Tier 2): a long-press → this pending selection → the action sheet; choosing
  // "ändern lassen" pre-anchors the command bar with `commandAnchor`.
  const [lineAction, setLineAction] = useState<{ file: string; from: number; to: number } | null>(null);
  const [commandAnchor, setCommandAnchor] = useState<CommandAnchor | null>(null);
  // Saved base map (project storage) — a reloaded draft row no longer carries
  // its pre-edit base, so GEÄNDERT/NEU + line deltas are computed against this.
  const [baseFiles, setBaseFiles] = useState<Record<string, string>>({});
  // P1.7: paths whose saved base could not be fetched (429 past retry budget) —
  // these must NOT render a confident NEU badge (base unknown, not absent).
  const [unknownBase, setUnknownBase] = useState<ReadonlySet<string>>(new Set());
  const [deployConfirm, setDeployConfirm] = useState(false);
  const [deploying, setDeploying] = useState(false);
  // P1.11: the publish-moment JIT for a missing Vercel connection. Opened when a
  // token-less "Live stellen" is detected (pre-check, or a NO_VERCEL_TOKEN deploy
  // error) so the user connects inline instead of hitting a dead end.
  const [vercelJit, setVercelJit] = useState(false);
  // M4: the inline truth-gated publish stream. `message` mirrors the server's
  // progress (incl. "wird geprüft, n/6"); phase never becomes "live" until the
  // server's success event — no completion claim before the checks pass.
  const [publishStream, setPublishStream] = useState<{ phase: "publishing" | "live" | "error"; message: string; url?: string } | null>(null);
  const [moreMenu, setMoreMenu] = useState(false);
  // M5: compact find/replace overlay for the Tier-3 editor (mobile) — replaces the
  // permanent desktop CodeMirror panel.
  const [searchOverlay, setSearchOverlay] = useState(false);
  // M6: JIT integration card. `jitTick` forces a recompute after a publish/dismiss
  // (localStorage isn't reactive). `jitKind` = the earned card, if any.
  const [jitTick, setJitTick] = useState(0);
  const [jitKind, setJitKind] = useState<JitKind | null>(null);
  // TRIAL-7 T2: the once-per-user achievement upgrade card. Shown after the FIRST
  // truth-gated successful publish (trial users only); "once" is enforced
  // server-side (achievement_upgrade_card_seen_at). Local flag drives this render.
  const router = useRouter();
  const [showUpgradeCard, setShowUpgradeCard] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  // P1.2(b): "Goblin arbeitet… <n>s" while a command runs, and the change pop-up
  // header once the result lands. workingSeconds ticks while agent.streaming;
  // changeSummary is the number of files the turn touched (null = no banner).
  const [workingSeconds, setWorkingSeconds] = useState<number | null>(null);
  const [changeSummary, setChangeSummary] = useState<number | null>(null);
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

  // K1 (Walk-4): "Code öffnen" must show the CODE. On mobile the default view is
  // the (often empty) thread, so opening a session that already has files landed
  // the founder on an empty task-chat — "the editor doesn't show". Once loaded,
  // foreground the editor for ANY session that has files (draft OR saved/hydrated),
  // not just a fresh Send-to-Code draft (the old C.3/NAVFIX-6 condition). A session
  // with no files yet (pure chat task) keeps the thread so its "give me a task"
  // empty state and conversation stay visible. Runs once; a later manual toggle wins.
  const autoViewedRef = useRef(false);
  useEffect(() => {
    if (autoViewedRef.current || detail.loading) return;
    // CLEANUP-3: only consume the one-shot once files actually exist. A fresh
    // Send-to-Code into a new session could resolve `loading=false` for a beat
    // with `files=0` (fetch vs. write race); consuming the flag there stranded
    // the user on the empty thread until a reload. Now we wait until files appear
    // (deps include files.length, so this re-runs) before foregrounding + locking.
    if (detail.files.length > 0) {
      autoViewedRef.current = true;
      setMobileView("editor");
    }
  }, [detail.loading, detail.files.length]);

  // Seed the persistent live-URL card from the session's last deploy, so it
  // survives a browser close + reopen (not just the deploy moment).
  useEffect(() => { if (detail.deployUrl) setLiveUrl(detail.deployUrl); }, [detail.deployUrl]);

  // M2: pull the saved project files as the diff/badge base. Best-effort; on a
  // failure the map stays empty (drafts then read as NEU, never a crash). Refreshes
  // when the draft set changes so a newly-saved base is reflected.
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    fetchAllTextFilesWithStatus(projectId).then(r => { if (!cancelled) { setBaseFiles(r.files); setUnknownBase(r.unknownPaths); } }).catch(() => {});
    return () => { cancelled = true; };
  }, [projectId]);

  // M6: recompute which JIT card is earned (post-publish / post-dismiss).
  useEffect(() => {
    if (!projectId) { setJitKind(null); return; }
    setJitKind(jitToShow(projectId));
  }, [projectId, jitTick]);

  const jitSetup = () => {
    if (!projectId || !jitKind) return;
    dismissJit(projectId, jitKind);       // acted → don't nag again for 30 days
    setJitTick(v => v + 1);
    if (jitKind === "github") setMoreMenu(true);  // surface the GitHub push affordance
  };
  const jitLater = () => {
    if (!projectId || !jitKind) return;
    dismissJit(projectId, jitKind);
    setJitTick(v => v + 1);
  };

  // TRIAL-7 T2: the card already stamped itself seen on show; these just close it.
  // "Pläne ansehen" → the real plan page; "Später" → dismiss (final, never re-shown).
  const upgradeCardOpen = () => { setShowUpgradeCard(false); router.push("/dashboard/upgrade"); };
  const upgradeCardLater = () => { setShowUpgradeCard(false); };

  // M2 (spec §8): the mobile back button closes an open sheet/reader before
  // leaving the tab. Push a history entry when one opens; pop closes the top.
  useEffect(() => {
    if (!diffPath && !(mobile && mobileMain === "reader")) return;
    window.history.pushState({ gbSheet: true }, "");
    const onPop = () => {
      if (diffPath) setDiffPath(null);
      else { setReaderPath(null); setMobileMain("cards"); }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [diffPath, mobile, mobileMain]);

  // Keep parent's tab badge in sync with the real draft count.
  useEffect(() => { onDraftCountChange(detail.draftCount); }, [detail.draftCount, onDraftCountChange]);

  // While streaming, surface the block currently being written (overlay only).
  const liveBlock = useMemo(() => {
    if (!agent.streaming) return null;
    return agent.blocks[agent.blocks.length - 1] ?? null;
  }, [agent.streaming, agent.blocks]);

  // P1.2(b): tick the "Goblin arbeitet… <n>s" counter for as long as the command
  // is streaming. Resets to null the moment streaming ends (the change pop-up
  // takes over). Visible within one frame of submit, so the Code surface never
  // sits silent after a send.
  useEffect(() => {
    // Ticks for BOTH the classic stream and a FEEL-3a agent run.
    if (!agent.streaming && !agentRun.streaming) { setWorkingSeconds(null); return; }
    setWorkingSeconds(0);
    const startedAt = Date.now();
    const iv = setInterval(() => setWorkingSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000))), 1000);
    return () => clearInterval(iv);
  }, [agent.streaming, agentRun.streaming]);

  // Any streaming work in flight (classic or agent) — drives the composer's
  // busy/cancel affordances so Stopp ends whichever path is running.
  const busy = agent.streaming || agentRun.streaming;
  const cancelAll = useCallback(() => { agent.cancel(); agentRun.cancel(); }, [agent, agentRun]);

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
    // A.3: the first prompt names a still-placeholder session like the task,
    // so the tabs/picker read meaningfully (no more duplicate "Session 2").
    if (detail.messages.length === 0 && isPlaceholderTitle(session.name)) {
      const title = titleFromPrompt(prompt);
      if (title) onAutoTitle?.(title);
    }
    // Row 1b: snapshot the edited file's pre-edit content BEFORE the agent
    // overwrites it — the base for the hunk-review card (transient, client-only).
    reviewBaseRef.current = detail.activePath
      ? { path: detail.activePath, content: detail.activeFile?.content ?? "" }
      : null;
    // B: snapshot ALL files too — a chat-driven edit may touch a file that isn't
    // the open one (founder: "mach die Überschrift größer" with no file open).
    baseFilesRef.current = new Map(detail.files.map(f => [f.path, f.content]));
    // FEEL-3a: on a Swift/Forge session, drive the server-side agent loop (step
    // stream + attested report). If the server declines (flag off / not eligible →
    // 409), fall back to the classic single-turn path so behavior never breaks.
    if (isAgentModel(session.model_id)) {
      agentRun.submit(prompt, session.model_id ?? undefined, {
        onDone: async () => { await detail.refresh(); },
        onNotEligible: () => runClassic(prompt),
      });
      setMobileView("editor");
      return;
    }
    runClassic(prompt);
    setMobileView("editor");
  };

  // The classic single-turn code agent (pre-FEEL-3a behavior), also the fallback
  // when an agent run is declined server-side.
  const runClassic = (prompt: string) => {
    // 10.8-8: pass the open file so the agent edits it in place (→ live diff)
    // rather than dumping a new file.
    agent.submit(prompt, session.model_id ?? undefined, async ({ text }) => {
      await detail.refresh();          // pull the persisted draft files
      agent.reset();
      setMobileView("editor");
      maybeOpenReviewCard(text);
      // P1.2(b): announce the result on the Code surface — the change pop-up
      // header. Count the distinct files this turn produced (new + edited).
      const changed = new Set(
        parseCodeBlocks(text).filter(b => b.complete && b.path).map(b => b.path),
      ).size;
      if (changed > 0) setChangeSummary(changed);
    }, detail.activePath);
  };

  // B: a chat turn → reviewable edits. Every produced block whose path matches an
  // EXISTING, non-empty file that actually changed becomes a review item. Covers
  // the open file AND files edited from the chat with nothing open; multi-file →
  // a queue of cards. New files (no pre-edit base) keep streaming as today.
  const buildReviews = (text: string, activePath: string | null): ReviewItem[] => {
    const snap = baseFilesRef.current;
    const items: ReviewItem[] = [];
    // WALKFIX-1 mirror: same edit-in-place retarget as the server — an unnamed block
    // (inferred language-default name) edited against an open file is retargeted to
    // that file, so the review card + foreground match the persisted draft instead
    // of a phantom sibling. Only the first matching unnamed block.
    const aDot = activePath ? activePath.lastIndexOf(".") : -1;
    const activeExt = activePath && aDot >= 0 ? activePath.slice(aDot).toLowerCase() : "";
    // WALK2-1 mirror: the assets the page's HTML actually links. A css/js edit must
    // land there, not on an unlinked sibling (deploy-stale root cause — see
    // DEPLOY_TRACE_2). Mirrors the server reconciliation so the review card targets
    // the file the live page loads (e.g. style.css), not the orphan (styles.css).
    const linkedCss = new Set<string>();
    const linkedJs = new Set<string>();
    for (const [p, c] of snap) {
      if (!/\.html?$/i.test(p)) continue;
      const a = linkedLocalAssets(c);
      a.css.forEach((x) => linkedCss.add(x));
      a.js.forEach((x) => linkedJs.add(x));
    }
    const reconcile = (path: string): string => {
      if (/\.s?css$/i.test(path) && linkedCss.size === 1 && !linkedCss.has(path)) return [...linkedCss][0]!;
      if (/\.m?js$/i.test(path) && linkedJs.size === 1 && !linkedJs.has(path)) return [...linkedJs][0]!;
      return path;
    };
    let retargeted = false;
    for (const b of parseCodeBlocks(text)) {
      if (!b.complete || !b.path) continue;
      let path = b.path;
      if (!retargeted && b.inferred && activePath && path !== activePath) {
        const bDot = path.lastIndexOf(".");
        const bExt = bDot >= 0 ? path.slice(bDot).toLowerCase() : "";
        if (bExt === activeExt) { path = activePath; retargeted = true; }
      }
      const reconciled = reconcile(path);
      if (reconciled !== path) {
        // Edit reconciled to the linked asset. Base = the linked file's current
        // content if it exists, else the orphan we'd have written (so the diff is
        // meaningful), else empty (a genuine create of the linked file).
        const base = snap.get(reconciled) ?? snap.get(path) ?? "";
        if (base === b.content) continue;
        const diff = createTwoFilesPatch(reconciled, reconciled, base, b.content, "Gesichert", "Entwurf");
        items.push({ path: reconciled, base, proposed: b.content, diff });
        continue;
      }
      const base = snap.get(path);
      if (base == null || !base.trim() || base === b.content) continue;
      const diff = createTwoFilesPatch(path, path, base, b.content, "Gesichert", "Entwurf");
      items.push({ path, base, proposed: b.content, diff });
    }
    return items;
  };

  const maybeOpenReviewCard = (text: string) => {
    const submitPath = reviewBaseRef.current?.path ?? null;
    reviewBaseRef.current = null;
    const items = buildReviews(text, submitPath ?? detail.activePath);
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

  // ── M2 mobile card→reader→diff navigation ──
  const openReader = (path: string) => { detail.setActivePath(path); setReaderPath(path); setMobileMain("reader"); };
  const openDiff = (path: string) => { detail.setActivePath(path); setDiffPath(path); };
  const backToCards = () => { setReaderPath(null); setMobileMain("cards"); };
  const editFromReader = () => { setMobileMain("editor"); };

  // ── M3 Tier-2 point & instruct ──
  // Confirm "Diese Stelle ändern lassen": pre-anchor the command bar and return to
  // the cards so the incoming GEÄNDERT card surfaces after the send.
  const confirmAnchor = () => {
    if (!lineAction) return;
    setCommandAnchor({ file: lineAction.file, from: lineAction.from, to: lineAction.to });
    setLineAction(null);
    setReaderPath(null);
    setMobileMain("cards");
    setDiffPath(null);
  };
  const copyAnchoredLines = () => {
    if (!lineAction) return;
    const f = detail.files.find(x => x.path === lineAction.file);
    if (f) {
      const lines = f.content.split("\n").slice(lineAction.from - 1, lineAction.to).join("\n");
      navigator.clipboard?.writeText(lines);
      setToast("Kopiert"); setTimeout(() => setToast(null), 1600);
    }
    setLineAction(null);
  };
  // Submit from the command bar. With an anchor, wrap the instruction in the
  // structured anchor payload (M3) so the model targets the pointed-at region; the
  // result still lands as a reviewed GEÄNDERT draft (no auto-apply).
  const submitCommand = (text: string) => {
    setAskText("");
    if (commandAnchor) {
      const f = detail.files.find(x => x.path === commandAnchor.file);
      const message = buildAnchoredMessage(text, commandAnchor, f?.content ?? "");
      setCommandAnchor(null);
      handleSubmit(message);
    } else {
      handleSubmit(text);
    }
  };

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

  // WALK2-2 (Phase 2): ONE deliberate action to go live — see `liveStellen` below.
  // M4 — "Live stellen": Sichern + Veröffentlichen in one flow with the truth-gated
  // status stream rendered INLINE (not a toast). The stream mirrors the server's
  // progress ("wird geprüft, n/6"); it only flips to "Live" on the success event —
  // the deploy is truth-gated server-side (verifyDeployment), so we never claim a
  // published state before the checks pass.
  const liveStellen = async () => {
    setDeployConfirm(false);
    // P1.11: detect a missing Vercel connection BEFORE attempting the deploy — a
    // token-less publish must never dead-end. Open the connect JIT instead; it
    // resumes this same flow (onConnected → liveStellen) after connecting.
    try {
      const v = await apiGet<{ connected: boolean }>("/api/integrations/vercel");
      if (!v?.connected) { setVercelJit(true); return; }
    } catch { /* status unreachable — fall through; the deploy path still guards NO_VERCEL_TOKEN */ }
    setDeploying(true);
    setPublishStream({ phase: "publishing", message: "Sichere Änderungen …" });
    if (detail.draftCount > 0) {
      const ok = await detail.saveSession();
      if (!ok) {
        setDeploying(false);
        setPublishStream({ phase: "error", message: "Konnte nicht sichern — erneut?" });
        return;
      }
      reviewsByPathRef.current.clear();
      setReviewablePaths(new Set());
    }
    setPublishStream({ phase: "publishing", message: "Veröffentliche …" });
    const { url, error, deploymentUrl, aliasUrl } = await detail.deploySession((msg) =>
      setPublishStream({ phase: "publishing", message: msg }),
    );
    setDeploying(false);
    setDeployDebug({ deploymentUrl, aliasUrl });
    if (url) {
      setLiveUrl(url);
      setLiveDismissed(false);
      setPublishStream({ phase: "live", message: "Live", url });
      // M6: record the truth-gated successful publish → may earn a JIT card.
      if (projectId) { bumpPublishCount(projectId); setJitTick(v => v + 1); }
      // TRIAL-7 T2: the truth-gated Live is the achievement moment. Ask the server
      // whether the once-per-user upgrade card is owed (active trial + never shown).
      // Stamp it seen immediately so it can never re-appear (even without a dismiss).
      apiGet<{ show: boolean }>("/api/users/me/achievement-card")
        .then((r) => {
          if (r.show) {
            setShowUpgradeCard(true);
            apiPost("/api/users/me/achievement-card/seen").catch(() => {});
          }
        })
        .catch(() => {});
    } else {
      // P1.11: if the deploy failed purely for a missing token, don't show a raw
      // error — open the connect JIT (belt-and-suspenders behind the pre-check).
      if (/NO_VERCEL_TOKEN/.test(error ?? "")) { setPublishStream(null); setVercelJit(true); return; }
      const msg = (error ?? "Veröffentlichen fehlgeschlagen").replace(/^NO_VERCEL_TOKEN —\s*/, "");
      setPublishStream({ phase: "error", message: msg });
    }
  };

  // ── Status line state ──
  const state = detail.aggregateState;
  const canSave = detail.draftCount > 0;
  // Phase 2: publish is the single primary action — reachable whenever there are
  // files (it saves pending drafts first), not gated behind a separate save step.
  const canPublish = detail.files.length > 0;
  const hasUnpublished = detail.draftCount > 0;
  const lastDeployedRel = relTimeShort(detail.deployedAt);

  const editorFilename = liveBlock ? liveBlock.path : (detail.activeFile?.path ?? "index.html");

  // M2: on mobile the editor chrome (tabs + file bar + editor) only renders when
  // the user has explicitly opened Tier 3 ("Bearbeiten"); otherwise the cards /
  // reader own the surface. Desktop always shows the editor (front door).
  const showEditorChrome = !mobile || mobileMain === "editor";
  // Diff sheet inputs — saved base vs the current draft content.
  const diffFile = diffPath ? detail.files.find(f => f.path === diffPath) ?? null : null;
  const diffBase = diffPath ? (baseFiles[diffPath] ?? "") : "";
  const diffDelta = diffFile ? lineDelta(diffBase, diffFile.content) : { added: 0, removed: 0 };

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
        /* MOBILE-1 · M1: the promoted command bar + status strip live at the TOP
           of the mobile Code surface. Desktop keeps the thread composer as the
           front door (HARD RULE 3), so this region is mobile-only. */
        .gb-mobile-surface-top { display: none; }
        @media (max-width: 860px) {
          .gb-session-pane { flex-direction: column; }
          .gb-thread-col { width: 100%; max-width: none; min-width: 0; border-right: none; display: ${mobileView === "thread" ? "flex" : "none"}; }
          .gb-surface-col { display: ${mobileView === "editor" ? "flex" : "none"}; }
          .gb-mobile-back { display: inline-flex !important; }
          .gb-mobile-surface-top { display: block; }
          /* The status strip now carries state at the top; drop the duplicate
             status line from the bottom action bar across the whole mobile band. */
          .gb-statusline { display: none !important; }
        }
        /* 10.8-6: mobile bottom-row is icon-only with 44px tap targets — no more
           overflow from "Kopieren Verwerfen Entwurf | Sichern | Veröffentlichen". */
        @media (max-width: 640px) {
          .gb-actbar { gap: 8px !important; justify-content: flex-end !important; }
          .gb-btn-lbl { display: none !important; }
          .gb-icon-btn { padding: 0 !important; width: 44px !important; height: 44px !important; justify-content: center !important; gap: 0 !important; }
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
        {/* FEEL-3a: the agent run's live step stream + attested report card. */}
        <AgentRunView
          streaming={agentRun.streaming}
          steps={agentRun.steps}
          narration={agentRun.narration}
          plan={agentRun.plan}
          report={agentRun.report}
          elapsedSeconds={agentRun.streaming ? (workingSeconds ?? 0) : null}
          onViewChanges={(p) => handleViewFile(p)}
          onGoLive={() => setDeployConfirm(true)}
          onConfirmPublish={() => agentRun.submit("Jetzt veröffentlichen.", session.model_id ?? undefined, { confirmPublish: true, onDone: async () => { await detail.refresh(); } })}
          onOpen={() => { const u = agentRun.report?.publishedUrl ?? liveUrl ?? detail.deployUrl; if (u) window.open(u, "_blank", "noopener"); }}
          onFeedback={() => setFeedbackOpen(true)}
        />
        {(agent.error || agentRun.error) && (() => {
          const err = agent.error || agentRun.error || "";
          // WAVE-J J4: the trial/limit wall today is this inline error. On a
          // limit/allowance error, add one quiet, honest help offer — no popup.
          const isLimit = /limit|kontingent|allowance|aufgebraucht|reached|erreicht/i.test(err);
          return (
            <div style={{ margin: "0 16px 8px", padding: "8px 12px", borderRadius: 8, background: "rgba(176,67,42,0.08)", border: "1px solid rgba(176,67,42,0.3)", color: "#B0432A", fontSize: 12.5, fontFamily: "var(--font-sans)" }}>
              <span>{err}</span>
              {isLimit && (
                <>
                  {" "}
                  <button data-testid="jit-support-limit" onClick={() => setSupportOpen(true)} style={{ background: "transparent", border: "none", color: "var(--brand-green, #1A3A2A)", textDecoration: "underline", fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                    {t(lang, "Brauchst du Hilfe dabei? → Goblin Hilfe", "Need help with this? → Goblin Hilfe")}
                  </button>
                </>
              )}
            </div>
          );
        })()}
        <FeedbackModal
          open={feedbackOpen}
          onClose={() => setFeedbackOpen(false)}
          surface="report_card"
          context={{ project_id: projectId, last_error: (agent.error || agentRun.error || publishStream?.message) ?? undefined }}
        />
        {supportOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setSupportOpen(false)}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, height: "90dvh", background: "var(--panel)", borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <SupportChat onClose={() => setSupportOpen(false)} />
            </div>
          </div>
        )}
        <SessionPromptInput
          modelId={session.model_id}
          onModelChange={onModelChange}
          onSubmit={handleSubmit}
          streaming={busy}
          onCancel={cancelAll}
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
        {/* MOBILE-1 · M1: promoted command bar + status strip at the TOP of the
            mobile Code surface (spec §2.1–2.2). Mobile-only; desktop keeps the
            thread composer as the front door. Routes through the same
            handleSubmit → reviewed GEÄNDERT draft path (no auto-apply). */}
        <div className="gb-mobile-surface-top">
          <CommandBar
            value={askText}
            onChange={setAskText}
            onSubmit={submitCommand}
            streaming={busy}
            onCancel={cancelAll}
            modelId={session.model_id}
            onModelChange={onModelChange}
            anchor={commandAnchor}
            onClearAnchor={() => setCommandAnchor(null)}
          />
          <StatusStrip
            state={liveBlock ? "draft" : state}
            draftCount={detail.draftCount}
            workingSeconds={busy ? (workingSeconds ?? 0) : null}
            liveUrl={detail.deployedAt ? (liveUrl ?? detail.deployUrl ?? null) : null}
            lastDeployedRel={lastDeployedRel}
            jit={(agentRun.streaming || agentRun.report)
              ? <AgentRunView
                  streaming={agentRun.streaming}
                  steps={agentRun.steps}
                  narration={agentRun.narration}
                  plan={agentRun.plan}
                  report={agentRun.report}
                  elapsedSeconds={agentRun.streaming ? (workingSeconds ?? 0) : null}
                  onViewChanges={(p) => handleViewFile(p)}
                  onGoLive={() => setDeployConfirm(true)}
                  onConfirmPublish={() => agentRun.submit("Jetzt veröffentlichen.", session.model_id ?? undefined, { confirmPublish: true, onDone: async () => { await detail.refresh(); } })}
                  onOpen={() => { const u = agentRun.report?.publishedUrl ?? liveUrl ?? detail.deployUrl; if (u) window.open(u, "_blank", "noopener"); }}
                  onFeedback={() => setFeedbackOpen(true)}
                />
              : showUpgradeCard
                ? <AchievementUpgradeCard variant="slot" onUpgrade={upgradeCardOpen} onLater={upgradeCardLater} />
                : jitKind ? <JitCard kind={jitKind} onSetup={jitSetup} onLater={jitLater} /> : null}
          />
        </div>
        {/* MOBILE-1 · M2: the mobile Code surface = file cards (Tier 1) by default.
            Tapping a changed card → Diff sheet first; unchanged/new → Reader. The
            editor (Tier 3) is behind "Bearbeiten". Desktop keeps the editor chrome. */}
        {mobile && mobileMain !== "editor" && (
          <div style={{ flex: 1, minHeight: 0, position: "relative", display: "flex", flexDirection: "column" }}>
            {readerPath && detail.files.some(f => f.path === readerPath) ? (
              <Reader
                path={readerPath}
                content={detail.files.find(f => f.path === readerPath)?.content ?? ""}
                theme={theme}
                onClose={backToCards}
                onEdit={editFromReader}
                onLineAction={(from, to) => setLineAction({ file: readerPath, from, to })}
              />
            ) : (
              <FileCardList
                files={detail.files}
                baseFiles={baseFiles}
                unknownBase={unknownBase}
                onOpenReader={openReader}
                onOpenDiff={openDiff}
              />
            )}
          </div>
        )}
        {showEditorChrome && (<>
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
        {/* File bar + status. FIX3-6: overflowX so the row can never clip a control
            at 390 — if the actions don't fit they scroll instead of being cut off. */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--ed-rule)", background: "var(--ed-chrome)", flexShrink: 0, overflowX: "auto" }}>
          <button
            className="gb-mobile-back"
            onClick={() => { if (mobile && mobileMain === "editor") setMobileMain(readerPath ? "reader" : "cards"); else setMobileView("thread"); }}
            aria-label={mobile && mobileMain === "editor" ? "Zurück zur Übersicht" : "Zurück zum Thread"}
            style={{ background: "transparent", border: "none", color: "var(--ed-fg-2)", cursor: "pointer", alignItems: "center" }}
          >
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
          <span style={{ color: "var(--ed-fg-1)", fontFamily: "JetBrains Mono, monospace", fontSize: 12.5, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {editorFilename}
          </span>
          {/* Find/Replace — keyboard does Ctrl+F/Ctrl+H; this button gives mobile +
              discoverability. Title surfaces the multi-cursor hint (Alt+Klick / Ctrl+D). */}
          {detail.activeFile && !liveBlock && (
            <button
              onClick={() => { const v = editorViewRef.current; if (!v) return; if (mobile) { setSearchOverlay(true); } else { openSearchPanel(v); v.focus(); } }}
              title="Suchen / Ersetzen (Strg+F · Strg+H) — Alt+Klick oder Strg+D für Mehrfach-Cursor"
              aria-label="Suchen und Ersetzen"
              data-testid="editor-search-button"
              style={{ display: "inline-flex", alignItems: "center", background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-2)", borderRadius: 8, padding: "5px 8px", cursor: "pointer", flexShrink: 0 }}
            >
              <Search size={14} />
            </button>
          )}
          {/* Undo / Redo — work for manual edits AND AI generations (one event). */}
          {detail.activeFile && !liveBlock && (
            <>
              <button onClick={doUndo} disabled={!canUndo} title="Rückgängig (Strg+Z)" aria-label="Rückgängig"
                style={{ display: "inline-flex", alignItems: "center", background: "transparent", border: "1px solid var(--ed-rule)", color: canUndo ? "var(--ed-fg-2)" : "var(--ed-fg-3)", borderRadius: 8, padding: "5px 8px", cursor: canUndo ? "pointer" : "not-allowed", opacity: canUndo ? 1 : 0.5, flexShrink: 0 }}>
                <Undo2 size={14} />
              </button>
              <button onClick={doRedo} disabled={!canRedo} title="Wiederherstellen (Strg+Y)" aria-label="Wiederherstellen"
                style={{ display: "inline-flex", alignItems: "center", background: "transparent", border: "1px solid var(--ed-rule)", color: canRedo ? "var(--ed-fg-2)" : "var(--ed-fg-3)", borderRadius: 8, padding: "5px 8px", cursor: canRedo ? "pointer" : "not-allowed", opacity: canRedo ? 1 : 0.5, flexShrink: 0 }}>
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
          <span style={{ flexShrink: 0, display: "inline-flex" }}><StateBadge state={liveBlock ? "draft" : state} /></span>
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

          {/* M5: compact find/replace overlay (mobile Tier-3 editor). */}
          {searchOverlay && editorViewRef.current && (
            <EditorSearchOverlay view={editorViewRef.current} onClose={() => setSearchOverlay(false)} />
          )}
        </div>
        </>)}

        {/* MOBILE-1 · M2: the Diff sheet — a GEÄNDERT card opens this first
            (review-before-anything), base (saved) → draft. */}
        {diffPath && diffFile && (
          <DiffSheet
            path={diffPath}
            base={diffBase}
            proposed={diffFile.content}
            added={diffDelta.added}
            removed={diffDelta.removed}
            onClose={() => setDiffPath(null)}
            onWholeFile={() => { setDiffPath(null); openReader(diffPath); }}
            onReanchor={(range) => { setLineAction({ file: diffPath, from: range.from, to: range.to }); }}
            onDismiss={() => setDiffPath(null)}
          />
        )}

        {/* M3 Tier-2 action sheet — from a Reader long-press or the Diff sheet. */}
        {lineAction && (
          <LineActionSheet
            file={lineAction.file}
            from={lineAction.from}
            to={lineAction.to}
            onChange={confirmAnchor}
            onCopy={copyAnchoredLines}
            onClose={() => setLineAction(null)}
          />
        )}

        {/* Persistent live URL — stays put after deploy (replaces the old toast
            that vanished after a few seconds). Survives reopen via detail.deployUrl. */}
        {liveUrl && !liveDismissed && (
          <div data-testid="live-url-card" data-stale={hasUnpublished ? "1" : "0"} style={{ flexShrink: 0, borderTop: "1px solid var(--ed-rule)", background: "var(--ed-canvas)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* P1.3: when unpublished drafts exist the live URL points at an OLDER
                deploy. Say so plainly (amber, not a reassuring green), demote
                "Öffnen" to a neutral secondary, and let "Live stellen" (the action
                bar below) be the sole primary. After a verified publish drafts are
                gone → "Live · aktuell" and Öffnen is prominent again. */}
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: hasUnpublished ? "var(--ed-draft)" : "#6db97b", flexShrink: 0 }} />
            {hasUnpublished ? (
              <span data-testid="live-state-label" style={{ flex: 1, minWidth: 140, fontSize: 12, fontWeight: 600, color: "var(--ed-draft)", fontFamily: "var(--font-sans)", lineHeight: 1.35 }}>
                {t(lang, "Live · älterer Stand — Änderungen noch nicht veröffentlicht", "Live · older version — changes not published yet")}
              </span>
            ) : (
              <span data-testid="live-state-label" style={{ fontSize: 11, fontWeight: 600, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
                {t(lang, "Live · aktuell", "Live · current")}{lastDeployedRel ? ` · ${t(lang, "aktualisiert", "updated")} ${lastDeployedRel}` : ""}
              </span>
            )}
            <a href={liveUrl} target="_blank" rel="noopener noreferrer" title={liveUrl} style={{ flex: 1, minWidth: 0, color: "var(--ed-accent)", fontFamily: "JetBrains Mono, monospace", fontSize: 12, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {liveUrl.replace(/^https?:\/\//, "")}
            </a>
            <button onClick={copyLiveUrl} title="URL kopieren" style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-2)", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)", flexShrink: 0 }}>
              <Icon name={copied ? "check" : "copy"} size={12} /> {copied ? "Kopiert" : "Kopieren"}
            </button>
            <a
              href={liveUrl} target="_blank" rel="noopener noreferrer"
              title={hasUnpublished ? t(lang, "Älteren, veröffentlichten Stand öffnen", "Open the older, published version") : "Im neuen Tab öffnen"}
              data-testid="live-oeffnen"
              style={{
                display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
                borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, textDecoration: "none",
                background: hasUnpublished ? "transparent" : "var(--ed-primary)",
                color: hasUnpublished ? "var(--ed-fg-2)" : "var(--ed-on-primary)",
                border: hasUnpublished ? "1px solid var(--ed-rule)" : "none",
              }}
            >
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

        {/* MOBILE-1 · M1: the docked bottom "ask" bar was promoted to the top of
            the surface (see .gb-mobile-surface-top above). The command input now
            lives there with the mic; nothing here. */}

        {/* MOBILE-1 · M4: one "Live stellen" primary (Sichern + Veröffentlichen in
            one flow) with the truth-gated status stream rendered INLINE. "Nur
            sichern" + GitHub push live in the ⋯ menu. */}
        <div className="gb-actbar" style={{ flexShrink: 0, borderTop: "1px solid var(--ed-rule)", background: "var(--ed-chrome)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
          {publishStream ? (
            <div data-testid="publish-stream" style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              {publishStream.phase === "publishing" ? (
                <GoblinLogo state="working" size={16} variant="gold" />
              ) : (
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: publishStream.phase === "live" ? "#6db97b" : "var(--danger, #B0432A)", flexShrink: 0 }} />
              )}
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontFamily: "var(--font-sans)", color: publishStream.phase === "error" ? "var(--danger, #B0432A)" : "var(--ed-fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {publishStream.phase === "live" ? (t(lang, "Live gestellt", "Published")) : publishStream.message}
              </span>
              {/* WAVE-J J4: one quiet, honest help offer at the failed-publish moment. */}
              {publishStream.phase === "error" && (
                <button data-testid="jit-support-publish" onClick={() => setSupportOpen(true)} style={{ background: "transparent", border: "none", color: "var(--brand-green, #1A3A2A)", textDecoration: "underline", fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)", flexShrink: 0 }}>
                  {t(lang, "Hilfe dabei?", "Need help?")}
                </button>
              )}
              {publishStream.phase !== "publishing" && (
                <button onClick={() => setPublishStream(null)} aria-label="Schließen" style={{ background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-2)", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)", flexShrink: 0 }}>
                  {publishStream.phase === "error" ? t(lang, "Erneut", "Retry") : "OK"}
                </button>
              )}
            </div>
          ) : (
            <>
              <span className="gb-statusline" style={{ fontSize: 12, fontFamily: "var(--font-sans)", flex: 1, display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                {state === "empty" ? (
                  <span style={{ color: "var(--ed-fg-3)" }}>Noch keine Dateien</span>
                ) : hasUnpublished ? (
                  <>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", border: "1.5px solid var(--ed-draft)", flexShrink: 0 }} />
                    <span style={{ color: "var(--ed-fg-2)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Nicht veröffentlichte Änderungen</span>
                  </>
                ) : detail.deployedAt ? (
                  <>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6db97b", flexShrink: 0 }} />
                    <span style={{ color: "var(--ed-fg-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Live{lastDeployedRel ? ` · zuletzt aktualisiert ${lastDeployedRel}` : ""}</span>
                  </>
                ) : (
                  <span style={{ color: "var(--ed-fg-3)" }}>Gesichert · bereit zum Veröffentlichen</span>
                )}
              </span>
              {/* ⋯ menu — Nur sichern + GitHub push (demoted per spec §2.4). */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <button
                  onClick={() => setMoreMenu(v => !v)}
                  aria-label="Weitere Aktionen" title="Mehr" data-testid="more-menu-button"
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-2)", borderRadius: 9, cursor: "pointer" }}
                >
                  <Icon name="more" size={16} />
                </button>
                {moreMenu && (
                  <>
                    <div onClick={() => setMoreMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                    <div data-testid="more-menu" style={{ position: "absolute", bottom: "calc(100% + 6px)", right: 0, zIndex: 41, minWidth: 220, background: "var(--ed-chrome-2, var(--ed-canvas))", border: "1px solid var(--ed-rule)", borderRadius: 12, padding: 8, boxShadow: "0 12px 32px rgba(15,43,30,0.24)", display: "flex", flexDirection: "column", gap: 6 }}>
                      <button
                        onClick={() => { setMoreMenu(false); doSave(); }}
                        disabled={!canSave || detail.saving}
                        data-testid="menu-save"
                        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: "transparent", border: "none", color: canSave ? "var(--ed-fg-1)" : "var(--ed-fg-3)", borderRadius: 8, padding: "10px 10px", fontSize: 14, cursor: canSave ? "pointer" : "not-allowed", fontFamily: "var(--font-sans)" }}
                      >
                        <Icon name="save" size={15} /> {t(lang, "Nur sichern", "Save only")}
                      </button>
                      {projectId && (
                        <div style={{ borderTop: "1px solid var(--ed-rule)", paddingTop: 6 }}>
                          <SessionGitPill projectId={projectId} />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => setDeployConfirm(true)}
                disabled={!canPublish || deploying}
                title="Live stellen" aria-label="Live stellen" data-testid="live-stellen"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
                  background: canPublish ? "var(--ed-primary)" : "transparent",
                  color: canPublish ? "var(--ed-on-primary)" : "var(--ed-fg-3)",
                  border: canPublish ? "none" : "1px solid var(--ed-rule)",
                  borderRadius: 9, padding: "10px 18px", fontSize: 14, fontWeight: 600,
                  cursor: canPublish && !deploying ? "pointer" : "not-allowed", fontFamily: "var(--font-sans)",
                }}
              >
                <Icon name="play" size={15} /> Live stellen
              </button>
            </>
          )}
        </div>
      </div>

      {/* P1.11: publish-moment JIT — connect Vercel inline, then resume the publish. */}
      {vercelJit && (
        <VercelConnectSheet
          onClose={() => setVercelJit(false)}
          onConnected={() => { setVercelJit(false); void liveStellen(); }}
        />
      )}

      {/* Deploy confirm */}
      {deployConfirm && (
        <>
          <div style={{ position: "absolute", inset: 0, zIndex: 80, background: "var(--surface-overlay, rgba(0,0,0,0.4))" }} onClick={() => setDeployConfirm(false)} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "var(--ed-chrome-2)", border: "1px solid var(--ed-rule)", borderRadius: 14, padding: "22px 24px", zIndex: 81, minWidth: 320, maxWidth: 380, boxShadow: "0 16px 40px rgba(15,43,30,0.28)" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ed-fg-1)", fontFamily: "var(--font-sans)", marginBottom: 8 }}>Live stellen?</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)", marginBottom: 18 }}>
              {hasUnpublished
                ? "Goblin sichert deine Änderungen und stellt sie live — unter derselben Adresse wie bisher. Erst wenn alle Prüfungen bestanden sind, gilt es als live. Nichts geht automatisch online; du entscheidest."
                : "Goblin baut dein Projekt und stellt es unter derselben öffentlichen Adresse bereit. Erst nach bestandener Prüfung gilt es als live."}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDeployConfirm(false)} style={{ background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-2)", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-sans)" }}>Abbrechen</button>
              <button onClick={liveStellen} data-testid="live-stellen-confirm" style={{ background: "var(--ed-primary)", border: "none", color: "var(--ed-on-primary)", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)", display: "inline-flex", alignItems: "center", gap: 7 }}><Icon name="play" size={14} /> Live stellen</button>
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

      {/* TRIAL-7 T2: achievement upgrade card — toast variant. The slot variant
          lives in the mobile status strip; this floating card covers desktop (where
          the status strip is hidden) so the earned moment surfaces on every surface.
          Rendered only when the mobile strip isn't showing it, so never doubled. */}
      {showUpgradeCard && !mobile && (
        <AchievementUpgradeCard variant="toast" onUpgrade={upgradeCardOpen} onLater={upgradeCardLater} />
      )}

      {/* P1.2(b): the change pop-up header — announced on the Code surface the
          moment a command result lands, so the edit is never silent. Tapping
          "Änderungen prüfen" foregrounds the review (the GEÄNDERT card / file
          list); the DiffModal review queue opens beneath for edited files. */}
      {changeSummary != null && (
        <div
          data-testid="change-summary"
          role="status"
          style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 92, maxWidth: "calc(100% - 24px)", background: "var(--ed-chrome-2, var(--ed-canvas))", border: "1px solid var(--ed-rule)", borderRadius: 12, padding: "10px 12px 10px 14px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 12px 32px rgba(15,43,30,0.28)" }}
        >
          <GoblinLogo state="breath" size={18} variant="gold" />
          <span style={{ fontSize: 13, fontFamily: "var(--font-sans)", color: "var(--ed-fg-1)", fontWeight: 600 }}>
            {t(lang, `Goblin hat ${changeSummary} ${changeSummary === 1 ? "Datei" : "Dateien"} geändert`, `Goblin changed ${changeSummary} ${changeSummary === 1 ? "file" : "files"}`)} — {t(lang, "prüfe die Änderungen", "review the changes")}
          </span>
          <button
            data-testid="change-summary-review"
            onClick={() => { setChangeSummary(null); setMobileView("editor"); if (mobile) setMobileMain("cards"); }}
            style={{ flexShrink: 0, background: "var(--ed-primary)", border: "none", color: "var(--ed-on-primary)", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-sans)" }}
          >
            {t(lang, "Änderungen prüfen", "Review changes")}
          </button>
          <button onClick={() => setChangeSummary(null)} aria-label={t(lang, "Schließen", "Close")} style={{ flexShrink: 0, background: "transparent", border: "none", color: "var(--ed-fg-3)", cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
            <Icon name="close" size={14} />
          </button>
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

// WALK2-2: compact relative time for "Live · zuletzt aktualisiert vor Xs".
function relTimeShort(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `vor ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `vor ${m}min`;
  const h = Math.round(m / 60);
  if (h < 24) return `vor ${h}h`;
  return `vor ${Math.round(h / 24)}d`;
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
