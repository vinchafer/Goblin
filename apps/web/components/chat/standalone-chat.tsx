"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiStream } from "@/lib/api";
import { ChatInput, useChatModel } from "@/components/chat/ChatInput";
import type { SelectedModel } from "@/components/chat/ChatInput";

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

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function parseMessage(text: string) {
  const codeBlocks: Array<{ code: string; language: string; filename?: string }> = [];
  const stripped = text.replace(/```(\w+)?(?: (.+))?\n([\s\S]*?)```/g, (_, lang, filename, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ code, language: lang || "text", filename: filename?.trim() });
    return `\x00CODE${idx}\x00`;
  });
  let html = escapeHtml(stripped);
  html = html.replace(/\x00CODE(\d+)\x00/g, (_, i) =>
    `<span class="code-placeholder" data-idx="${i}"></span>`
  );
  html = html
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, (_, inner) => `<code class="ic">${escapeHtml(inner)}</code>`)
    .replace(/\n/g, "<br>");
  return { html, codeBlocks };
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
          color: "var(--moss)", fontSize: 11, fontFamily: "JetBrains Mono, monospace",
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
            label="✦ Send to Code"
            sub={!hasProject ? "Open a project first" : undefined}
          />
          <DropItem onClick={handleCopy} label="□ Copy code" />
          <DropItem onClick={handleDownload} label="⬇ Download as file" />
        </div>
      )}
    </div>
  );
}

function DropItem({ onClick, disabled, label, sub }: {
  onClick: () => void; disabled?: boolean; label: string; sub?: string;
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
        fontFamily: "DM Sans, sans-serif",
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = "var(--subtle)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; }}
    >
      {label}
      {sub && <span style={{ fontSize: 10, color: "var(--meta)", display: "block", marginTop: 1 }}>{sub}</span>}
    </button>
  );
}

// ─── Suggestion Chips ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { label: "Explain how APIs work", prompt: "Can you explain how REST APIs work in simple terms?" },
  { label: "Help me plan my SaaS", prompt: "I want to build a SaaS product. Help me plan the architecture and key features." },
  { label: "Review my code idea", prompt: "I have a code idea I'd like you to review and give feedback on." },
  { label: "Build a landing page", prompt: "Help me write the copy and structure for a landing page." },
];

function EmptyState({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px 24px", textAlign: "center",
    }}>
      <div style={{
        fontFamily: "Fraunces, serif", fontSize: 36, color: "var(--moss)",
        fontWeight: 700, letterSpacing: "-1px", marginBottom: 8,
      }}>
        Goblin.
      </div>
      <p style={{
        fontSize: 15, color: "var(--meta)",
        fontFamily: "DM Sans, sans-serif",
        marginBottom: 28, maxWidth: 340, lineHeight: 1.6,
      }}>
        Describe what you want.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 440 }}>
        {SUGGESTIONS.map(s => (
          <button
            key={s.label}
            onClick={() => onSuggestion(s.prompt)}
            style={{
              padding: "8px 14px", borderRadius: 6,
              border: "1px solid var(--ochre)",
              background: "transparent", color: "var(--moss)",
              fontSize: 13, fontFamily: "DM Sans, sans-serif",
              cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget.style.background = "var(--moss)");
              (e.currentTarget.style.color = "#fff");
              (e.currentTarget.style.borderColor = "var(--moss)");
            }}
            onMouseLeave={e => {
              (e.currentTarget.style.background = "transparent");
              (e.currentTarget.style.color = "var(--moss)");
              (e.currentTarget.style.borderColor = "var(--ochre)");
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Message ──────────────────────────────────────────────────────────────────

function Message({ msg, isStreaming }: { msg: StandaloneMessage & { id: string }; isStreaming: boolean }) {
  const isUser = msg.role === "user";
  const isThinking = msg.id === "streaming" && msg.content === "";
  const { html, codeBlocks } = parseMessage(msg.content);

  return (
    <div style={{
      display: "flex", gap: 10, alignItems: "flex-start",
      flexDirection: isUser ? "row-reverse" : "row",
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
        background: isUser ? "#6B6B6B" : "var(--moss)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 700,
        color: isUser ? "#fff" : "var(--ochre)", marginTop: 2,
      }}>
        {isUser ? "U" : "G"}
      </div>

      <div style={{ flex: 1, minWidth: 0, maxWidth: "82%" }}>
        <div style={{
          background: isUser ? "var(--moss)" : "var(--panel)",
          color: isUser ? "#fff" : "var(--text)",
          borderRadius: isUser ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
          padding: "10px 14px",
          border: isUser ? "none" : "1px solid var(--div)",
          fontSize: 14, lineHeight: 1.6,
          fontFamily: "DM Sans, sans-serif",
        }}>
          {isThinking ? (
            <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "4px 0" }}>
              <span style={{ fontSize: 12, color: "var(--meta)" }}>Thinking…</span>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: "var(--meta)", animation: "bounce 1.2s ease infinite",
                  animationDelay: `${i * 0.2}s`,
                }} />
              ))}
            </div>
          ) : (
            <>
              <div dangerouslySetInnerHTML={{ __html: html }} style={{ wordBreak: "break-word" }} />
              {isStreaming && msg.id === "streaming" && msg.content.length > 0 && (
                <span style={{
                  display: "inline-block", width: 2, height: 14,
                  background: "var(--ochre)", marginLeft: 2, verticalAlign: "text-bottom",
                  animation: "blink 0.8s step-end infinite",
                }} />
              )}
            </>
          )}
        </div>

        {!isUser && codeBlocks.length > 0 && (
          <div style={{ marginTop: 6 }}>
            {codeBlocks.map((block, i) => (
              <div key={i} style={{ margin: "6px 0", borderRadius: 10, overflow: "hidden", border: "1px solid #2a2a2a" }}>
                <div style={{ background: "#1e1e1e", display: "flex", alignItems: "center", padding: "6px 12px", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#9C9589", fontFamily: "JetBrains Mono, monospace", flex: 1 }}>
                    {block.filename || block.language}
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(block.code).catch(() => {})}
                    style={{ background: "none", border: "none", color: "#9C9589", fontSize: 11, cursor: "pointer", fontFamily: "DM Sans, sans-serif", padding: "2px 6px" }}
                  >
                    Copy
                  </button>
                </div>
                <div style={{ background: "#111", padding: "14px 16px", overflowX: "auto" }}>
                  <pre style={{ margin: 0, fontFamily: "JetBrains Mono, monospace", fontSize: 13, color: "#e8e8e8", lineHeight: 1.6 }}>
                    <code>{block.code}</code>
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isUser && msg.model_used && !isStreaming && (
          <div style={{ marginTop: 4, fontSize: 11, color: "var(--meta)", fontFamily: "DM Sans, sans-serif" }}>
            {msg.model_used.replace(/^(?:anthropic|openai|google)\//, "")}
            {msg.source_tier ? ` · ${msg.source_tier}` : ""}
          </div>
        )}
      </div>
    </div>
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
      setError(err instanceof Error ? err.message : "Failed to send");
      setMessages(baseMessagesRef.current);
      streamingMsgRef.current = null;
      setIsStreaming(false);
    }
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--cream)" }}>
      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:scale(0)}40%{transform:scale(1)} }
        @keyframes blink { 50%{opacity:0} }
        .ic { background:rgba(45,74,43,0.08);padding:1px 5px;border-radius:4px;font-family:JetBrains Mono,monospace;font-size:0.9em; }
      `}</style>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        {messages.length === 0
          ? <EmptyState onSuggestion={p => handleSubmit(p, selectedModel)} />
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
            fontFamily: "DM Sans, sans-serif",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ fontSize: 16, background: "none", border: "none", cursor: "pointer", color: "var(--meta)", padding: "0 2px" }}>×</button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{ borderTop: "1px solid var(--div)", background: "var(--cream)" }}>
        <div style={{ position: "relative" }}>
          {/* Code action button — sits above the input */}
          {lastAssistantMsg?.has_code && (
            <div style={{ position: "absolute", right: 12, bottom: "calc(100% + 6px)", zIndex: 10 }}>
              <CodeActionButton lastMessage={lastAssistantMsg} hasProject={hasProject} />
            </div>
          )}
          <ChatInput
            onSubmit={handleSubmit}
            disabled={isStreaming}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
          />
        </div>
      </div>
    </div>
  );
}
