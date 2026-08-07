"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Copy, Download, Code2 } from "lucide-react";
import { apiStream } from "@/lib/api";
import { ChatInput, useChatModel } from "@/components/chat/ChatInput";
import type { SelectedModel } from "@/components/chat/ChatInput";
import type { ChatAttachment } from "@/lib/chat-attachments";
import { EmptyChat } from "@/components/chat/EmptyChat";
import Message from "./Message";
import { useUser } from "@/lib/hooks/useUser";
import { friendlyError, isConnectionError, connectionErrorMessage } from "@/lib/friendly-error";
import { parseCodeBlocks } from "@/lib/parse-code-blocks";
import { StcPreviewSheet, type StcFile } from "@/components/code/StcPreviewSheet";
import { useApp } from "@/contexts/app-context";
import { useDemoMode } from "@/lib/demo/demo-mode-context";
import { useLang, readLang } from "@/lib/use-lang";
import { useStickToBottom } from "@/hooks/useStickToBottom";
import { ScrollToEndChip } from "@/components/chat/ScrollToEndChip";
import { ExistingFilesContext } from "@/contexts/existing-files-context";
import { SendToCodeContext, type CardStcFile } from "@/contexts/send-to-code-context";
import { isAgentModel } from "@/lib/agent-eligible";
import { shouldRouteToAgent, AGENT_HANDOFF_NARRATION } from "@/lib/run-intent";
import { bindResumeOnReturn } from "@/lib/resume-on-return";
import {
  createTurnGuard, recoverTurn, recoveryMessage, checkingMessage, offersResend,
  resendHint, resendActionLabel,
  shouldAskServerOnReturn, type TranscriptMessage, type TurnStatus,
} from "@/lib/chat-recovery";
import { noticeToneStyle, noticeToneFromText, recoveryTone, type NoticeTone } from "@/lib/notice-tone";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StandaloneMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  has_code: boolean;
  created_at: string;
  model_used?: string;
  source_tier?: string;
  // P0.5 — connection-resilient sends: the idempotency key travels with the
  // message so a retry can never double-submit; `sendFailed` renders the
  // "wartet auf Verbindung — erneut senden" state.
  clientMessageId?: string;
  sendFailed?: boolean;
  // FOUNDER-WALK-5 · U1 — WHY this message is retryable, so the affordance stops claiming
  // "wartet auf Verbindung" over a turn the server already discarded. Absent → the
  // connection-failure default.
  retryHint?: string;
  retryAction?: string;
}

interface StreamChunk {
  type: "meta" | "delta" | "done" | "error" | "fallback_notice";
  content?: string;
  model?: string;
  model_used?: string;
  source_tier?: string;
  messageId?: string;
  message?: string;
  input_tokens?: number;
  output_tokens?: number;
  token_display?: string;
}

interface StandaloneChatProps {
  sessionId: string;
  initialMessages?: StandaloneMessage[];
  /** When this chat belongs to a project, these wire the header + Send-to-Code. */
  projectId?: string | null;
  projectName?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasCodeBlock(text: string) {
  return text.includes("```");
}

// F3: module-level guard so a given session's dashboard seed is auto-submitted
// exactly once for the life of the page — even if StandaloneChat happens to mount
// twice during the navigation settle. The old mount-effect + setTimeout(0) could
// consume the seed on a doomed first mount and lose the submit, leaving an empty
// chat. This survives that race.
const consumedSeeds = new Set<string>();

// ─── Code Action Dropdown ─────────────────────────────────────────────────────

// FIX3-2: a sensible project name from the user's prompt so "Neues Projekt" needs
// no form. Strips markdown, takes the first few words, caps length.
function deriveProjectName(prompt?: string | null): string {
  const base = (prompt ?? "").replace(/[`*#>_~]/g, " ").replace(/\s+/g, " ").trim();
  if (!base) return "Neues Projekt";
  const words = base.split(" ").slice(0, 5).join(" ").trim();
  return (words.length > 40 ? words.slice(0, 40).trim() : words) || "Neues Projekt";
}

// Shared Send-to-Code confirm: stash the selected files and deep-link into the
// target's Code tab (draft landing + P0.3/U2 unpack there). Used by the
// message-level "Alle übernehmen" and the per-card "Ins Projekt übernehmen" (C3).
async function stashAndRouteToCode(
  files: StcFile[],
  chosenProjectId: string | null,
  ctx: { projectId?: string | null; sessionId: string; lastUserPrompt?: string | null },
  push: (url: string) => void,
): Promise<void> {
  try {
    sessionStorage.setItem("goblin:stc-pending", JSON.stringify({
      files, content: files[0]?.content, filename: files[0]?.path,
      prompt: ctx.lastUserPrompt ?? undefined,
    }));
  } catch { /* ignore */ }

  const target = chosenProjectId ?? ctx.projectId ?? null;
  if (target) {
    try { sessionStorage.setItem(`goblin:lastChat:${target}`, ctx.sessionId); } catch { /* ignore */ }
    push(`/dashboard/project/${target}/work?tab=code`);
    return;
  }

  // "Neues Projekt": create one in a single step (auto-named) and land in Code.
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const { data: { session } } = await createClient().auth.getSession();
    const token = session?.access_token;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
    if (token) {
      const res = await fetch(`${apiBase}/api/projects`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: deriveProjectName(ctx.lastUserPrompt) }),
      });
      if (res.ok) {
        const proj = (await res.json()) as { id?: string };
        if (proj?.id) {
          try { sessionStorage.setItem(`goblin:lastChat:${proj.id}`, ctx.sessionId); } catch { /* ignore */ }
          push(`/dashboard/project/${proj.id}/work?tab=code`);
          return;
        }
      }
    }
  } catch { /* fall through to the form as a safety net */ }
  push("/dashboard?start=1");
}

function CodeActionButton({ lastMessage, lastUserPrompt, hasProject, projectId, projectName, sessionId }: {
  lastMessage: StandaloneMessage | null;
  lastUserPrompt?: string | null;
  hasProject: boolean;
  projectId?: string | null;
  projectName?: string | null;
  sessionId: string;
}) {
  const router = useRouter();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  // 10.8-5: preview the files before they land (no more black box).
  const [preview, setPreview] = useState<StcFile[] | null>(null);
  // U2: current contents of the target project's matching files — drives the
  // GEÄNDERT/NEU/IDENTISCH badges + diff preview in the sheet.
  const [existingFiles, setExistingFiles] = useState<Record<string, string> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!lastMessage?.has_code) return null;

  const lastCodeBlock = (() => {
    const m = lastMessage.content.match(/```(?:\w+)?(?:\s.+)?\n([\s\S]*?)```/);
    return m?.[1] ?? "";
  })();

  // 10.8-5: all code blocks of the message → real files (path resolved).
  const previewFiles: StcFile[] = parseCodeBlocks(lastMessage.content)
    .filter((b) => b.complete && b.content.trim().length > 0)
    .map((b) => ({ path: b.path, content: b.content }));

  const handleCopy = async () => {
    await navigator.clipboard.writeText(lastCodeBlock).catch(() => {});
    setOpen(false);
  };

  const handleDownload = () => {
    const blob = new Blob([lastCodeBlock], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "code.txt";
    a.click();
    setOpen(false);
  };

  // 10.8-5: open the preview sheet. For a project-less chat we also fetch the
  // user's projects so the sheet can offer a target dropdown.
  const handleSendToCode = async () => {
    setOpen(false);
    // U2: for a project-bound chat, load the target's current file contents
    // BEFORE the sheet opens so badges/diffs are correct from the first paint.
    if (hasProject && projectId) {
      try {
        // B3: load ALL text files (capped), not just the outgoing paths — the
        // integrity auto-rename can point a file at a target path that isn't
        // in the outgoing set, and reclassification needs its content.
        const { fetchAllTextFiles } = await import("@/lib/project-files");
        setExistingFiles(await fetchAllTextFiles(projectId));
      } catch { setExistingFiles(null); }
    } else {
      setExistingFiles(null);
    }
    if (!hasProject) {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const { data: { session } } = await createClient().auth.getSession();
        const token = session?.access_token;
        if (token) {
          const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
          const res = await fetch(`${apiBase}/api/projects`, { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const list = await res.json();
            if (Array.isArray(list)) setProjects(list.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
          }
        }
      } catch { /* ignore — sheet still works with "Neues Projekt" only */ }
    }
    setPreview(previewFiles.length > 0 ? previewFiles : [{ path: "generated-code.js", content: lastCodeBlock }]);
  };

  // Confirm: stash the selected files and deep-link into the target's Code tab.
  const confirmSend = async (files: StcFile[], chosenProjectId: string | null) => {
    setPreview(null);
    await stashAndRouteToCode(files, chosenProjectId, { projectId, sessionId, lastUserPrompt }, router.push);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Code-Aktionen"
        aria-label="Code-Aktionen"
        style={{
          // Founder walk: just the code glyph — clean, centered, single line.
          // Square 32px target, Lucide </> mark, no label.
          width: 32, height: 32, padding: 0, borderRadius: 8,
          background: "var(--panel)", border: "1px solid var(--div)",
          color: "var(--ink-2, var(--text-2))", lineHeight: 0,
          cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
          boxShadow: "var(--shadow-sm)", transition: "border-color 0.12s, color 0.12s",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--brand-green)"; e.currentTarget.style.color = "var(--brand-green)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--div)"; e.currentTarget.style.color = "var(--ink-2, var(--text-2))"; }}
      >
        <Code2 size={16} strokeWidth={2} aria-hidden style={{ display: "block" }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", right: 0,
          background: "var(--panel)", border: "1px solid var(--div)",
          borderRadius: 10, padding: 4, minWidth: 190, zIndex: 50,
          boxShadow: "var(--shadow-md)",
        }}>
          <DropItem
            onClick={handleSendToCode}
            icon={<ArrowUpRight size={14} />}
            label={lang === 'en' ? 'Send to Code' : 'An Code senden'}
            sub={!hasProject ? (lang === 'en' ? 'Choose a project…' : 'Projekt wählen…') : undefined}
          />
          <DropItem onClick={handleCopy} icon={<Copy size={14} />} label={lang === 'en' ? 'Copy code' : 'Code kopieren'} />
          <DropItem onClick={handleDownload} icon={<Download size={14} />} label={lang === 'en' ? 'Download as file' : 'Als Datei speichern'} />
        </div>
      )}

      {preview && (
        <StcPreviewSheet
          files={preview}
          projects={hasProject ? undefined : projects}
          targetName={hasProject ? (projectName ?? undefined) : undefined}
          existingFiles={existingFiles}
          onConfirm={confirmSend}
          onCancel={() => setPreview(null)}
        />
      )}
    </div>
  );
}

function DropItem({ onClick, disabled, icon, label, sub }: {
  onClick: () => void; disabled?: boolean; icon?: ReactNode; label: string; sub?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "block", width: "100%", textAlign: "left",
        padding: "8px 12px", fontSize: 13, borderRadius: 7,
        color: disabled ? "var(--meta)" : "var(--text)",
        background: "none", border: "none",
        cursor: disabled ? "default" : "pointer",
        fontFamily: "var(--font-sans)",
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = "var(--subtle)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon}
        <span>{label}</span>
      </span>
      {sub && <span style={{ fontSize: 10, color: "var(--meta)", display: "block", marginTop: 1 }}>{sub}</span>}
    </button>
  );
}

// ─── StandaloneChat ───────────────────────────────────────────────────────────

export function StandaloneChat({ sessionId, initialMessages = [], projectId = null, projectName = null }: StandaloneChatProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<(StandaloneMessage & { id: string })[]>(
    initialMessages.map(m => ({ ...m, model_used: undefined, source_tier: undefined }))
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // U1 (visual): the notice's tone travels WITH it. `null` means "not stated" and falls back
  // to the text classifier at render — the only place prose is still read for colour.
  const [errorTone, setErrorTone] = useState<NoticeTone | null>(null);
  /** Raise a notice and say what kind it is. The one way this component writes the banner. */
  const showNotice = useCallback((text: string | null, tone?: NoticeTone) => {
    setError(text);
    setErrorTone(text === null ? null : tone ?? null);
  }, []);
  const { selectedModel, setSelectedModel } = useChatModel();
  const { setChatProjectId } = useApp();
  const demoMode = useDemoMode();

  // A.1 (NAVFIX-1): tell the shell which project this chat belongs to (or none),
  // so the header Code tab stays live from a project chat and project-less chats
  // keep it disabled. Clear on unmount so a later standalone chat isn't stuck
  // pointing at a stale project.
  useEffect(() => {
    setChatProjectId(projectId ?? null);
    return () => setChatProjectId(null);
  }, [projectId, setChatProjectId]);

  // CW-2 (Speed & Haptik F-41): the back button ("← {projectName}") is the
  // worst-felt offender — its router.push into a force-dynamic project route
  // stalls on a cold RSC fetch, so the tap reads as dead. Warm that route on
  // mount so the navigation resolves instantly (paints the project route's
  // loading skeleton immediately, then hydrates). Keeps the guaranteed
  // destination — no router.back() back-stack ambiguity. With CW-1 the tap now
  // both presses and moves at once.
  useEffect(() => {
    if (projectId) router.prefetch(`/dashboard/project/${projectId}`);
  }, [projectId, router]);

  // C-4: a file sent from the Explorer ("Im Chat anhängen" / "Goblin dazu fragen")
  // is stashed in sessionStorage and picked up here, then seeded into the composer
  // as a ready attachment (same budget + honest-error path as a picked file).
  const [seededAttachments, setSeededAttachments] = useState<ChatAttachment[]>([]);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("goblin:attach-file");
      if (!raw) return;
      const data = JSON.parse(raw) as { projectId?: string | null; name?: string; content?: string };
      if (data && data.name && typeof data.content === "string" && (!data.projectId || data.projectId === projectId)) {
        sessionStorage.removeItem("goblin:attach-file");
        setSeededAttachments([{ id: `seed-${data.name}`, name: data.name, kind: "text", state: "ready", content: data.content }]);
      }
    } catch { /* ignore */ }
  }, [projectId]);

  // U0: auto-follow only while the user is at the bottom; scroll-up releases
  // the pin so reading during generation works (founder-reported iPhone bug).
  const { containerRef: scrollRef, atBottom, handleScroll, onContentChange, scrollToBottom } =
    useStickToBottom<HTMLDivElement>();
  const streamingContentRef = useRef("");
  const baseMessagesRef = useRef<typeof messages>([]);
  const streamingMsgRef = useRef<(typeof messages)[0] | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

  useEffect(() => {
    onContentChange();
  }, [messages, onContentChange]);

  // U2: current contents of the bound project's text files, for the file-card
  // change summaries. Refreshed on mount and after each finished stream.
  const [projectFilesMap, setProjectFilesMap] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    if (!projectId || isStreaming) return;
    let live = true;
    (async () => {
      try {
        const { fetchAllTextFiles } = await import("@/lib/project-files");
        const map = await fetchAllTextFiles(projectId);
        if (live) setProjectFilesMap(map);
      } catch { /* cards simply render without a change line */ }
    })();
    return () => { live = false; };
  }, [projectId, isStreaming]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // ─── FOUNDER-WALK-4 · U1 — coming back after the phone locked ───────────────
  //
  // The founder's walk: send a message on the iPhone, switch to the PC, the phone
  // auto-locks. iOS suspends the PWA and the SSE socket dies. The server finishes the turn
  // and persists the answer regardless (chat-sessions.ts) — but FINAL-POLISH · U1's client
  // half still lost, and the founder's re-test still showed "die Verbindung hat kurz
  // gehakt". Two reasons, both structural, both now owned by lib/chat-recovery.ts:
  //
  //   1. TWO WRITERS, NO ORDER. The dead stream's rejection and the return handler both
  //      wake at thaw and both write `error`/`sendFailed`. The rejection's tail is a
  //      3s-timeout health ping; the recovery's is an import + a session read + a fetch.
  //      The recovery could succeed and be overwritten milliseconds later. `turnGuard` now
  //      retires a turn the moment a recovery takes it over, so its late writes are refused.
  //   2. THE TRIGGER NEEDED AN EVENT THAT MAY NOT SURVIVE A FREEZE. The old rule fired only
  //      when it had MEASURED a long hide. A `visibilitychange` delivered to an already-
  //      suspended page runs at thaw with `visibilityState === 'visible'` and no measurement
  //      at all → `force: false` → no recovery, ever. We now decide on our own stream's
  //      SILENCE, which a freeze cannot hide.
  //
  // What we do NOT claim to fix: an in-flight fetch does not survive iOS suspension. The
  // request dies. Everything here is about the recovery being honest afterwards — it asks
  // the server and reports only what it saw, including telling the founder when their
  // message never left the phone at all.
  const turnGuard = useRef(createTurnGuard());
  /** Wall clock of the last stream frame; null once no stream is running. */
  const lastStreamActivityRef = useRef<number | null>(null);
  const interruptedRef = useRef(false);
  useEffect(() => {
    interruptedRef.current = isStreaming || error !== null || messages.some((m) => m.sendFailed);
  }, [isStreaming, error, messages]);
  /** The prompt of the turn in flight — how the recovery tells "arrived" from "never arrived". */
  const pendingPromptRef = useRef<string | null>(null);
  /** The local id of that turn's user bubble, so a resend affordance lands on the right one. */
  const pendingIdRef = useRef<string | null>(null);

  const recoverAfterDisconnect = useCallback(async () => {
    if (!sessionId) return;
    const lang = readLang() === "en" ? "en" : "de";
    const prompt = pendingPromptRef.current ?? "";
    const activityAtStart = lastStreamActivityRef.current;

    turnGuard.current.beginRecovery();
    // A progress report about work that is fine — never the error treatment.
    showNotice(checkingMessage(lang), recoveryTone('checking'));

    const outcome = await recoverTurn({
      prompt,
      // The session is re-read on every look, not once up front: a token read that fails on
      // the first attempt (the app has only just thawed) must not condemn the whole recovery
      // to `unreachable`. A failure here returns null, which is exactly "could not ask" —
      // never a silent no-op that leaves the founder staring at a spinner.
      fetchTranscript: async () => {
        try {
          const { data: { session } } = await (await import("@/lib/supabase/client")).createClient().auth.getSession();
          const token = session?.access_token;
          if (!token) return null;
          const res = await fetch(`${apiBase}/api/chat-sessions/${sessionId}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          if (!res.ok) return null;
          const d = (await res.json()) as { messages?: TranscriptMessage[] };
          return d.messages ?? [];
        } catch { return null; }
      },
      // FOUNDER-WALK-5 · U1 — the verified fate of the turn, which the transcript cannot
      // express: "no answer yet" and "the answer was discarded by the 120s runtime guard"
      // are the same absence. A failed read returns null, which recoverTurn treats as
      // "could not ask" — never as "nothing is running".
      fetchTurnStatus: async () => {
        try {
          const { data: { session } } = await (await import("@/lib/supabase/client")).createClient().auth.getSession();
          const token = session?.access_token;
          if (!token) return null;
          const res = await fetch(`${apiBase}/api/chat-sessions/${sessionId}/turn-status`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          if (!res.ok) return null;
          return (await res.json()) as TurnStatus;
        } catch { return null; }
      },
      // A frame that arrived since we started looking means the stream was never dead.
      streamAlive: () =>
        lastStreamActivityRef.current !== null && lastStreamActivityRef.current !== activityAtStart,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    });

    turnGuard.current.endRecovery(outcome.kind !== "stream-alive");

    if (outcome.kind === "stream-alive") {
      // Back off completely: the turn is still live and still owns the screen.
      showNotice(null);
      return;
    }

    abortRef.current?.abort();
    streamingMsgRef.current = null;
    streamingContentRef.current = "";
    lastStreamActivityRef.current = null;
    setIsStreaming(false);

    if (outcome.kind === "answered") {
      // The server's transcript is the truth. Adopt it whole — the answer simply appears.
      const adopted = outcome.messages.map((m) => ({
        ...m, has_code: m.has_code ?? m.content.includes("```"),
      })) as typeof messages;
      setMessages(adopted);
      baseMessagesRef.current = adopted;
      showNotice(null);
      return;
    }

    // Only a message that provably never reached the server keeps a resend affordance —
    // offering "erneut senden" over a turn the server is still finishing would duplicate
    // work the founder has already paid for.
    const resend = offersResend(outcome.kind);
    setMessages(baseMessagesRef.current.map((m) =>
      m.id === pendingIdRef.current
        ? {
            ...m,
            sendFailed: resend,
            retryHint: resend ? resendHint(outcome.kind, lang) : undefined,
            retryAction: resend ? resendActionLabel(outcome.kind, lang) : undefined,
          }
        : m,
    ));
    showNotice(recoveryMessage(outcome.kind, lang), recoveryTone(outcome.kind));
  }, [sessionId, apiBase, showNotice]);

  // The trigger the mount-only paths could never provide: iOS freezes the tab rather
  // than unmounting it, so only a visibility/bfcache/online event tells us we are back.
  // The DECISION is `shouldAskServerOnReturn`, not the detector's `force` — see above.
  useEffect(() => {
    return bindResumeOnReturn(({ force, hiddenForMs }) => {
      if (turnGuard.current.recovering()) return; // one look at a time
      const quietForMs = lastStreamActivityRef.current === null
        ? null
        : Date.now() - lastStreamActivityRef.current;
      const ask = force
        ? interruptedRef.current
        : shouldAskServerOnReturn({ unresolved: interruptedRef.current, hiddenForMs, quietForMs });
      if (!ask) return;
      void recoverAfterDisconnect();
    });
  }, [recoverAfterDisconnect]);

  // Seed-on-mount: the dashboard home composer (and "Neues Projekt") stash the
  // prompt — and now the picked model (F2) — in sessionStorage before navigating
  // here. Pop them once and auto-submit so the user lands inside a streaming reply
  // running THE MODEL THEY PICKED.
  useEffect(() => {
    if (initialMessages.length > 0 || consumedSeeds.has(sessionId)) return;
    try {
      const seed = sessionStorage.getItem(`goblin:seed:${sessionId}`);
      if (!seed) return;
      consumedSeeds.add(sessionId);
      sessionStorage.removeItem(`goblin:seed:${sessionId}`);
      // F2: prefer the model carried with the seed (the dashboard pick); fall back
      // to the composer's current model. setSelectedModel keeps the composer pill
      // in sync with what's actually running.
      let model = selectedModel;
      try {
        const rawModel = sessionStorage.getItem(`goblin:seedModel:${sessionId}`);
        if (rawModel) {
          sessionStorage.removeItem(`goblin:seedModel:${sessionId}`);
          const parsed = JSON.parse(rawModel) as SelectedModel;
          if (parsed?.slug) { model = parsed; setSelectedModel(parsed); }
        }
      } catch { /* keep the fallback model */ }
      // F3: submit synchronously (no setTimeout). The old macrotask deferral left a
      // window where a remount could drop the auto-submit → empty chat. The model is
      // explicit now, so there's no need to wait for useChatModel to hydrate.
      handleSubmit(seed, model);
    } catch { /* sessionStorage unavailable — ignore */ }
    // intentionally only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant") ?? null;
  // BUG-6: the user prompt names the task — carried into Send-to-Code so the new
  // code session reads like the task ("build a newsletter page") instead of a
  // filename ("index.html").
  const lastUserPrompt = [...messages].reverse().find(m => m.role === "user")?.content ?? null;
  // Project-bound chat (10.7-14): same component, project context via props.
  const hasProject = !!projectId;

  // C3: per-card "Ins Projekt übernehmen" — a single file-card requests STC.
  // Opens the same StcPreviewSheet (P0.3 integrity + U2 classification) the
  // multi-file flow uses; project-bound → target known, standalone → picker.
  const [cardPreview, setCardPreview] = useState<StcFile[] | null>(null);
  const [cardExistingFiles, setCardExistingFiles] = useState<Record<string, string> | null>(null);
  const [cardProjects, setCardProjects] = useState<{ id: string; name: string }[]>([]);
  const requestCardStc = useCallback(async (file: CardStcFile) => {
    if (projectId) {
      try {
        const { fetchAllTextFiles } = await import("@/lib/project-files");
        setCardExistingFiles(await fetchAllTextFiles(projectId));
      } catch { setCardExistingFiles(null); }
    } else {
      setCardExistingFiles(null);
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const { data: { session } } = await createClient().auth.getSession();
        const token = session?.access_token;
        if (token) {
          const res = await fetch(`${apiBase}/api/projects`, { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const list = await res.json();
            if (Array.isArray(list)) setCardProjects(list.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
          }
        }
      } catch { /* sheet still works with "Neues Projekt" only */ }
    }
    setCardPreview([{ path: file.path, content: file.content }]);
  }, [projectId, apiBase]);

  // P0.5 — `retry` re-sends an existing failed message: same clientMessageId
  // (server dedupes → no double-submit), no new user bubble.
  const handleSubmit = async (
    text: string,
    model: SelectedModel,
    opts?: { websearch?: boolean; retry?: { id: string; clientMessageId: string } },
  ) => {
    const retry = opts?.retry;
    const wantsWebSearch = opts?.websearch === true;
    if (retry && isStreaming) return; // one in-flight send at a time

    // FW4 U1 (F-11) — publish/build-intent routing (the W10 fix). Founder decision
    // D1: "explicit intent executes directly." A project-bound chat on an
    // agent-eligible model (Swift/Forge) whose message clearly asks to build or
    // publish must engage the server-driven AGENT (tools → files → save → publish),
    // not a tool-less chat completion that can only hand back manual instructions.
    // Ambiguous messages (and a bare "live" mention) fall through to normal chat, so
    // the FW1-U4 honest mode-decline still governs the conversational path.
    // Not for a retry (that re-sends an existing tool-less message) or a web search.
    if (!retry && !wantsWebSearch && hasProject && projectId && isAgentModel(model.slug) && shouldRouteToAgent(text)) {
      // Honest hand-off, no silent mode switch: show the user their message + the
      // "Ich starte dafür einen Agent-Lauf …" first step, stash the prompt as an
      // agent seed, and route into the Code work surface where the agent run (its
      // live step stream + attested report card) actually renders and publishes.
      const nowIso = new Date().toISOString();
      const userMsg: typeof messages[0] = {
        id: `temp-${Date.now()}`, role: "user", content: text,
        has_code: false, created_at: nowIso,
      };
      const handoffMsg: typeof messages[0] = {
        id: `handoff-${Date.now()}`, role: "assistant", content: AGENT_HANDOFF_NARRATION,
        has_code: false, created_at: nowIso,
      };
      setMessages([...messages, userMsg, handoffMsg]);
      try {
        sessionStorage.setItem("goblin:agent-pending", JSON.stringify({ projectId, prompt: text, modelSlug: model.slug }));
        sessionStorage.setItem(`goblin:lastChat:${projectId}`, sessionId);
      } catch { /* sessionStorage unavailable — navigation below still carries intent */ }
      router.push(`/dashboard/project/${projectId}/work?tab=code`);
      return;
    }

    const clientMessageId = retry?.clientMessageId ?? crypto.randomUUID();
    const tempId = retry?.id ?? `temp-${Date.now()}`;

    let withUser: typeof messages;
    if (retry) {
      withUser = messages.map(m => m.id === retry.id ? { ...m, sendFailed: false } : m);
    } else {
      const userMsg: typeof messages[0] = {
        id: tempId, role: "user", content: text,
        has_code: false, created_at: new Date().toISOString(),
        clientMessageId,
      };
      withUser = [...messages, userMsg];
    }
    setMessages(withUser);
    baseMessagesRef.current = withUser;
    setIsStreaming(true);
    showNotice(null);
    streamingContentRef.current = "";

    // U1: this turn's identity. Every write below carries `epoch`, and the guard refuses it
    // once a recovery has taken the turn over — which is what stops a rejection that thawed
    // out of a suspended socket from stamping "try again" over an answer already on screen.
    const epoch = turnGuard.current.begin();
    pendingPromptRef.current = text;
    pendingIdRef.current = tempId;
    lastStreamActivityRef.current = Date.now();

    const streamMsg: typeof messages[0] = {
      id: "streaming", role: "assistant", content: "",
      has_code: false, created_at: new Date().toISOString(),
      model_used: model.slug,
    };
    streamingMsgRef.current = streamMsg;
    setMessages([...withUser, streamMsg]);

    try {
      const { data: { session } } = await (await import("@/lib/supabase/client")).createClient().auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      abortRef.current = new AbortController();
      await apiStream(
        `/api/chat-sessions/${sessionId}/stream`,
        { message: text, modelSlug: model.slug, clientMessageId, websearch: wantsWebSearch },
        (raw: unknown) => {
          const d = raw as StreamChunk;
          // U1: frames that ARRIVED are trustworthy — they came over a socket that is
          // demonstrably alive — so they are gated on the epoch alone, not on `mayFinish`.
          // A recovery running right now will see this timestamp move and back off.
          // (The one writer that must yield to a recovery is the local connection-failure
          // verdict in the catch below, which is a guess about a socket, not a message
          // from the server.)
          if (!turnGuard.current.mayStream(epoch)) return; // superseded — this turn is over
          lastStreamActivityRef.current = Date.now();

          if (d.type === "meta") {
            if (streamingMsgRef.current) {
              streamingMsgRef.current = { ...streamingMsgRef.current, model_used: d.model, source_tier: d.source_tier };
              setMessages([...baseMessagesRef.current, streamingMsgRef.current]);
            }
          } else if (d.type === "delta") {
            streamingContentRef.current += d.content ?? "";
            if (streamingMsgRef.current) {
              streamingMsgRef.current = { ...streamingMsgRef.current, content: streamingContentRef.current };
              setMessages([...baseMessagesRef.current, streamingMsgRef.current]);
            }
          } else if (d.type === "done") {
            if (streamingMsgRef.current) {
              const final: typeof messages[0] = {
                ...streamingMsgRef.current,
                id: d.messageId || streamingMsgRef.current.id,
                content: streamingContentRef.current,
                has_code: hasCodeBlock(streamingContentRef.current),
                model_used: d.model_used || streamingMsgRef.current.model_used,
              };
              setMessages([...baseMessagesRef.current, final]);
              streamingMsgRef.current = null;
            }
            lastStreamActivityRef.current = null; // no stream is running any more
            setIsStreaming(false);
          } else if (d.type === "error") {
            showNotice(friendlyError(d.message));
            setMessages(baseMessagesRef.current);
            streamingMsgRef.current = null;
            lastStreamActivityRef.current = null;
            setIsStreaming(false);
          }
        },
        abortRef.current.signal
      );
    } catch (err) {
      // Stop button → AbortError. Not an error: keep the partial message in
      // place (founder decision: abrupt abort, partial stays), no banner.
      if (err instanceof Error && err.name === "AbortError") {
        streamingMsgRef.current = null;
        lastStreamActivityRef.current = null;
        setIsStreaming(false);
        return;
      }
      // U1 — THE FOUNDER'S SYMPTOM WAS WRITTEN HERE.
      //
      // On a locked iPhone this branch runs at THAW: the frozen socket's rejection is
      // delivered, `isConnectionError` matches, and `connectionErrorMessage()` pings /health
      // — which succeeds, because the network is back — and returns "Die Verbindung hat kurz
      // gehakt — bitte versuch es erneut". Meanwhile the return handler is asking the server
      // and finding the finished answer. Both used to write; the slower one lost.
      //
      // This is a GUESS about a socket, not a message from the server, so it now yields:
      // once a recovery owns the turn, this write is refused outright. The `await` below is
      // exactly where the old ordering was decided, so the guard is re-checked after it too
      // — a recovery can start while the health ping is in flight.
      if (!turnGuard.current.mayFinish(epoch)) {
        streamingMsgRef.current = null;
        return;
      }
      // P0.5 — connection-class failure: the message enters a visible
      // "wartet auf Verbindung" state with a safe retry (same id, server-side
      // dedupe) instead of a bare toast. Honest copy distinguishes offline
      // from server-down (P0.4 classifier).
      if (isConnectionError(err)) {
        const copy = await connectionErrorMessage();
        if (!turnGuard.current.mayFinish(epoch)) { streamingMsgRef.current = null; return; }
        setMessages(baseMessagesRef.current.map(m =>
          m.id === tempId ? { ...m, sendFailed: true } : m
        ));
        // A connection blip with a visible retry: actionable, not broken.
        showNotice(copy, 'warn');
      } else {
        showNotice(friendlyError(err, "Senden fehlgeschlagen — bitte nochmal versuchen."));
        setMessages(baseMessagesRef.current);
      }
      streamingMsgRef.current = null;
      lastStreamActivityRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    // Partial assistant message remains in messages[] — do NOT remove it.
    streamingMsgRef.current = null;
    // U1: a deliberate stop RESOLVES the turn. Retiring it here (begin() bumps the epoch)
    // means a later return does not treat the user's own stop as an interrupted turn and
    // go asking the server about it.
    turnGuard.current.begin();
    pendingPromptRef.current = null;
    pendingIdRef.current = null;
    lastStreamActivityRef.current = null;
    setIsStreaming(false);
  };

  const handleNewChat = async () => {
    try {
      const { data: { session } } = await (await import("@/lib/supabase/client")).createClient().auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch(`${apiBase}/api/chat-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const newSession = await res.json() as { id: string };
        router.push(`/dashboard/chat/${newSession.id}`);
      }
    } catch { /* ignore */ }
  };

  return (
    <ExistingFilesContext.Provider value={projectFilesMap}>
    <SendToCodeContext.Provider value={requestCardStc}>
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--surface-2)" }}>
      {/* C3: per-card "Ins Projekt übernehmen" preview (single file). */}
      {cardPreview && (
        <StcPreviewSheet
          files={cardPreview}
          projects={hasProject ? undefined : cardProjects}
          targetName={hasProject ? (projectName ?? undefined) : undefined}
          existingFiles={cardExistingFiles}
          onConfirm={async (files, chosen) => {
            setCardPreview(null);
            await stashAndRouteToCode(files, chosen, { projectId, sessionId, lastUserPrompt }, router.push);
          }}
          onCancel={() => setCardPreview(null)}
        />
      )}
      {/* Project context bar — only when this chat belongs to a project.
          Keeps the body identical to a top-level chat (10.7-14 parity). */}
      {projectName && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
          padding: "8px 16px", borderBottom: "1px solid var(--rule)",
          background: "var(--surface-2)", fontFamily: "var(--font-sans)",
        }}>
          <button
            onClick={() => projectId && router.push(`/dashboard/project/${projectId}`)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "none", border: "none", cursor: "pointer", padding: 0,
              fontSize: 12.5, color: "var(--meta)", fontFamily: "var(--font-sans)",
            }}
            title="Zum Projekt"
          >
            <span aria-hidden>←</span>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
              color: "var(--brand-green)", background: "color-mix(in srgb, var(--brand-green) 10%, transparent)",
              padding: "2px 8px", borderRadius: 6,
            }}>{projectName}</span>
          </button>
        </div>
      )}

      {/* ChatKeyBanner removed (STAGE 1B): a model is always available
          via the Groq free pool; the banner was misleading. Model switching
          lives on the composer pill, full management in Settings. */}

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`chat-scroll${messages.length === 0 ? " chat-scroll--empty" : ""}`}
        style={{ gap: 16 }}
      >
        {messages.length === 0
          ? <EmptyChatBound onSuggestion={p => handleSubmit(p, selectedModel)} />
          : messages.map(m => (
            <div key={m.id}>
              <Message msg={m} isStreaming={isStreaming} />
              {m.sendFailed && m.clientMessageId && (
                // P0.5 — the failed send stays visible and retryable; the retry
                // reuses the same clientMessageId so it can never double-submit.
                <div style={{
                  display: "flex", justifyContent: "flex-end", alignItems: "center",
                  gap: 8, marginTop: 4, fontSize: 12, color: "var(--meta)",
                  fontFamily: "var(--font-sans)",
                }}>
                  <span>{m.retryHint ?? "wartet auf Verbindung"}</span>
                  <button
                    onClick={() => handleSubmit(m.content, selectedModel, { retry: { id: m.id, clientMessageId: m.clientMessageId! } })}
                    disabled={isStreaming}
                    style={{
                      background: "none", border: "1px solid var(--div)", borderRadius: 6,
                      padding: "2px 10px", fontSize: 12, color: "var(--brand-green)",
                      cursor: isStreaming ? "default" : "pointer", fontFamily: "var(--font-sans)",
                    }}
                  >
                    {m.retryAction ?? "erneut senden"}
                  </button>
                </div>
              )}
            </div>
          ))
        }

        {error && (
          // U1 (visual): the tone is CARRIED, not sniffed from the prose. `errorTone` is set
          // by whoever raised the notice; untagged upstream strings fall back to the text
          // classifier. Every value is token-derived, so the box follows the theme instead
          // of the hard-coded light-mode reds this banner used to paint in both themes.
          <div style={{
            ...noticeToneStyle(errorTone ?? noticeToneFromText(error)),
            borderRadius: 10, padding: "12px 16px", fontSize: 13,
            fontFamily: "var(--font-sans)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <span>{error}</span>
            <button onClick={() => showNotice(null)} style={{ fontSize: 'var(--t-body-fs)', background: "none", border: "none", cursor: "pointer", color: "var(--meta)", padding: "0 2px" }}>×</button>
          </div>
        )}

      </div>

      {/* Input area — sticky bottom of the flex column. The iOS bottom safe-area
          (home-indicator gesture zone) is cleared by ChatInput itself
          (SAFEAREA-U-BOTTOM: its non-hero root pads paddingBottom by the inset),
          so this wrapper does NOT duplicate the inset — a double inset would leave a
          dead --surface-2 strip below the composer.
          FOUNDER-WALK-3 U3: the wrapper background is now --panel, NOT --surface-2.
          The composer it holds is --panel (white light / #08170F dark); painting the
          wrapper a DIFFERENT colour (--surface-2 bone) meant that if any seam opened
          in the home-indicator zone (the composer's inset white over the bone wrapper
          / page), the bone showed as a second bar under the white composer — the
          founder's stacked white+bone bars. One surface, one colour, continuous into
          the inset. chat-tab renders the composer with no such wrapper, so this
          aligns the two chat surfaces. */}
      <div style={{ borderTop: "1px solid var(--rule)", background: "var(--panel)" }}>
        <div style={{ position: "relative" }}>
          {/* U0: shown when the user scrolled away from the bottom; tap → back
              to live-follow. Sits centered above the composer, clear of the
              right-aligned code action button. */}
          {!atBottom && messages.length > 0 && (
            <ScrollToEndChip bottom="calc(100% + 12px)" onClick={() => scrollToBottom("smooth")} />
          )}
          {/* Code action button — sits above the input. Hidden in demo (its
              actions fetch projects / deep-link out of the iframe). */}
          {!demoMode && lastAssistantMsg?.has_code && (
            <div style={{ position: "absolute", right: 12, bottom: "calc(100% + 10px)", zIndex: 10 }}>
              <CodeActionButton lastMessage={lastAssistantMsg} lastUserPrompt={lastUserPrompt} hasProject={hasProject} projectId={projectId} projectName={projectName} sessionId={sessionId} />
            </div>
          )}
          <ChatInput
            onSubmit={handleSubmit}
            disabled={demoMode}
            isStreaming={isStreaming}
            onStop={handleStop}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            initialAttachments={seededAttachments}
          />
        </div>
      </div>
    </div>
    </SendToCodeContext.Provider>
    </ExistingFilesContext.Provider>
  );
}

function EmptyChatBound({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  const user = useUser();
  return <EmptyChat userName={user.fullName || user.email?.split('@')[0] || 'Vincent'} onSuggestionClick={onSuggestion} />;
}
