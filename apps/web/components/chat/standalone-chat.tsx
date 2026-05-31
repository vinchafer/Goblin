"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Copy, Download } from "lucide-react";
import { apiStream } from "@/lib/api";
import { ChatInput, useChatModel } from "@/components/chat/ChatInput";
import type { SelectedModel } from "@/components/chat/ChatInput";
import { EmptyChat } from "@/components/chat/EmptyChat";
import Message from "./Message";
import { useUser } from "@/lib/hooks/useUser";

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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasCodeBlock(text: string) {
  return text.includes("```");
}

// ─── Code Action Dropdown ─────────────────────────────────────────────────────

function CodeActionButton({ lastMessage, hasProject }: {
  lastMessage: StandaloneMessage | null;
  hasProject: boolean;
}) {
  const [open, setOpen] = useState(false);
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

  const handleSendToCode = () => {
    if (!hasProject) return;
    window.dispatchEvent(new CustomEvent("goblin:sendToCode", {
      detail: { code: lastCodeBlock, filename: "generated-code.js" },
    }));
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Code actions"
        style={{
          width: 32, height: 32, borderRadius: 8,
          background: "var(--subtle)", border: "1px solid var(--div)",
          color: "var(--brand-green)", fontSize: 11, fontFamily: "JetBrains Mono, monospace",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 600, transition: "background 0.1s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--div)")}
        onMouseLeave={e => (e.currentTarget.style.background = "var(--subtle)")}
      >
        {"</>"}
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
            disabled={!hasProject}
            icon={<ArrowUpRight size={14} />}
            label="Send to Code"
            sub={!hasProject ? "Open a project first" : undefined}
          />
          <DropItem onClick={handleCopy} icon={<Copy size={14} />} label="Copy code" />
          <DropItem onClick={handleDownload} icon={<Download size={14} />} label="Download as file" />
        </div>
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

export function StandaloneChat({ sessionId, initialMessages = [] }: StandaloneChatProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<(StandaloneMessage & { id: string })[]>(
    initialMessages.map(m => ({ ...m, model_used: undefined, source_tier: undefined }))
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { selectedModel, setSelectedModel } = useChatModel();

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
  // Project detection — if URL has a project context in the future
  const hasProject = false;

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
            setError(d.message || "Stream error");
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
      setError(err instanceof Error ? err.message : "Failed to send");
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
            <div style={{ position: "absolute", right: 12, bottom: "calc(100% + 6px)", zIndex: 10 }}>
              <CodeActionButton lastMessage={lastAssistantMsg} hasProject={hasProject} />
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
