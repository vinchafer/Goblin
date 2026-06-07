"use client";

import { useState, useEffect, useRef, type ReactNode, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Copy, Download, Code2 } from "lucide-react";
import { apiStream } from "@/lib/api";
import { ChatInput, useChatModel } from "@/components/chat/ChatInput";
import type { SelectedModel } from "@/components/chat/ChatInput";
import { EmptyChat } from "@/components/chat/EmptyChat";
import Message from "./Message";
import { useUser } from "@/lib/hooks/useUser";
import { friendlyError } from "@/lib/friendly-error";
import { parseCodeBlocks } from "@/lib/parse-code-blocks";
import { StcPreviewSheet, type StcFile } from "@/components/code/StcPreviewSheet";
import { useApp } from "@/contexts/app-context";
import { useLang } from "@/lib/use-lang";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StandaloneMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  has_code: boolean;
  created_at: string;
  model_used?: string;
  source_tier?: string;
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

// ─── Code Action Dropdown ─────────────────────────────────────────────────────

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
  const confirmSend = (files: StcFile[], chosenProjectId: string | null) => {
    try {
      sessionStorage.setItem("goblin:stc-pending", JSON.stringify({
        files, content: files[0]?.content, filename: files[0]?.path,
        prompt: lastUserPrompt ?? undefined,
      }));
    } catch { /* ignore */ }
    setPreview(null);
    const target = chosenProjectId ?? projectId;
    if (target) {
      // 11A-A: remember the conversation we're leaving so the workspace "Chat"
      // tab (and back-from-code) returns HERE, not a new/different window.
      try { sessionStorage.setItem(`goblin:lastChat:${target}`, sessionId); } catch { /* ignore */ }
      router.push(`/dashboard/project/${target}/work?tab=code`);
    } else {
      // No project chosen → new-project flow picks up the stash on landing.
      router.push("/dashboard?start=1");
    }
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
        <Code2 size={16} strokeWidth={2} aria-hidden />
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
  const { selectedModel, setSelectedModel } = useChatModel();
  const { setChatProjectId } = useApp();

  // A.1 (NAVFIX-1): tell the shell which project this chat belongs to (or none),
  // so the header Code tab stays live from a project chat and project-less chats
  // keep it disabled. Clear on unmount so a later standalone chat isn't stuck
  // pointing at a stale project.
  useEffect(() => {
    setChatProjectId(projectId ?? null);
    return () => setChatProjectId(null);
  }, [projectId, setChatProjectId]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingContentRef = useRef("");
  const baseMessagesRef = useRef<typeof messages>([]);
  const streamingMsgRef = useRef<(typeof messages)[0] | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Seed-on-mount: the dashboard home composer (screen 03) stashes the
  // prompt in sessionStorage before navigating here. Pop it once and
  // auto-submit so the user lands inside a streaming reply.
  useEffect(() => {
    if (initialMessages.length > 0) return;
    try {
      const key = `goblin:seed:${sessionId}`;
      const seed = sessionStorage.getItem(key);
      if (seed) {
        sessionStorage.removeItem(key);
        // Defer to next tick so model state is initialised first.
        setTimeout(() => handleSubmit(seed, selectedModel), 0);
      }
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

  const handleSubmit = async (text: string, model: SelectedModel) => {
    const tempId = `temp-${Date.now()}`;
    const userMsg: typeof messages[0] = {
      id: tempId, role: "user", content: text,
      has_code: false, created_at: new Date().toISOString(),
    };

    const withUser = [...messages, userMsg];
    setMessages(withUser);
    baseMessagesRef.current = withUser;
    setIsStreaming(true);
    setError(null);
    streamingContentRef.current = "";

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
        { message: text, modelSlug: model.slug },
        (raw: unknown) => {
          const d = raw as StreamChunk;

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
            setIsStreaming(false);
          } else if (d.type === "error") {
            setError(friendlyError(d.message));
            setMessages(baseMessagesRef.current);
            streamingMsgRef.current = null;
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
        setIsStreaming(false);
        return;
      }
      setError(friendlyError(err, "Senden fehlgeschlagen — bitte nochmal versuchen."));
      setMessages(baseMessagesRef.current);
      streamingMsgRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    // Partial assistant message remains in messages[] — do NOT remove it.
    streamingMsgRef.current = null;
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bone)" }}>
      {/* Project context bar — only when this chat belongs to a project.
          Keeps the body identical to a top-level chat (10.7-14 parity). */}
      {projectName && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
          padding: "8px 16px", borderBottom: "1px solid var(--rule)",
          background: "var(--bone)", fontFamily: "var(--font-sans)",
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
        className={`chat-scroll${messages.length === 0 ? " chat-scroll--empty" : ""}`}
        style={{ gap: 16 }}
      >
        {messages.length === 0
          ? <EmptyChatBound onSuggestion={p => handleSubmit(p, selectedModel)} />
          : messages.map(m => (
            <Message key={m.id} msg={m} isStreaming={isStreaming} />
          ))
        }

        {error && (
          <div style={{
            background: /no model|no key|api key/i.test(error) ? "rgba(212,169,74,0.08)" : "#FEF2F2",
            border: `1px solid ${/no model|no key|api key/i.test(error) ? "rgba(212,169,74,0.3)" : "#FCA5A5"}`,
            borderRadius: 10, padding: "12px 16px", fontSize: 13,
            color: /no model|no key|api key/i.test(error) ? "var(--text)" : "#991B1B",
            fontFamily: "var(--font-sans)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ fontSize: 'var(--t-body-fs)', background: "none", border: "none", cursor: "pointer", color: "var(--meta)", padding: "0 2px" }}>×</button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area — sticky bottom of the flex column. Clears the iOS
          bottom safe area (gesture zone) so the composer stays thumb-reachable. */}
      <div style={{ borderTop: "1px solid var(--rule)", background: "var(--bone)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div style={{ position: "relative" }}>
          {/* Code action button — sits above the input */}
          {lastAssistantMsg?.has_code && (
            <div style={{ position: "absolute", right: 12, bottom: "calc(100% + 10px)", zIndex: 10 }}>
              <CodeActionButton lastMessage={lastAssistantMsg} lastUserPrompt={lastUserPrompt} hasProject={hasProject} projectId={projectId} projectName={projectName} sessionId={sessionId} />
            </div>
          )}
          <ChatInput
            onSubmit={handleSubmit}
            isStreaming={isStreaming}
            onStop={handleStop}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
          />
        </div>
      </div>
    </div>
  );
}

function EmptyChatBound({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  const user = useUser();
  return <EmptyChat userName={user.fullName || user.email?.split('@')[0] || 'Vincent'} onSuggestionClick={onSuggestion} />;
}
