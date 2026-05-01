"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { apiStream, apiGet } from "@/lib/api";
import { ChatInput, useChatModel, DEFAULT_MODEL } from "@/components/chat/ChatInput";
import { FirstChatTip } from "@/components/onboarding/first-chat-tip";
import type { ChatMessage } from "@goblin/shared/src/schemas";
import type { SelectedModel } from "@/components/chat/ChatInput";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatTabProps {
  projectId: string;
}

interface StreamMessage {
  type: 'meta' | 'delta' | 'done' | 'error' | 'fallback_notice';
  model?: string;
  model_slug?: string;
  source_tier?: string;
  provider?: string;
  content?: string;
  messageId?: string;
  model_used?: string;
  input_tokens?: number;
  output_tokens?: number;
  token_display?: string;
  message?: string;
}

interface TokenInfo {
  input: number;
  output: number;
  provider: string;
  layer: string;
  tokenDisplay?: string;
}

const THINKING_PHRASES = [
  'Your goblin is thinking…',
  'Cooking up something good…',
  'Consulting the ancient scrolls…',
  'Connecting the dots…',
  'Spinning up the gears…',
  'On it…',
];

// ─── Per-provider pricing (USD per 1K tokens) ─────────────────────────────────

const PRICE_PER_1K: Record<string, { input: number; output: number }> = {
  anthropic: { input: 0.003,  output: 0.015  },
  openai:    { input: 0.002,  output: 0.006  },
  google:    { input: 0.001,  output: 0.002  },
  groq:      { input: 0.0002, output: 0.0006 },
  deepseek:  { input: 0.0002, output: 0.0006 },
  mistral:   { input: 0.002,  output: 0.006  },
  xai:       { input: 0.003,  output: 0.015  },
};

function calcCost(tokens: TokenInfo): string | null {
  if (tokens.layer === 'goblin_hosted') return null;
  if (tokens.layer === 'free_api') return 'Free';
  const p = PRICE_PER_1K[tokens.provider];
  if (!p) return null;
  const cost = (tokens.input / 1000) * p.input + (tokens.output / 1000) * p.output;
  return `$${cost.toFixed(4)}`;
}

// ─── Markdown / code parsing ──────────────────────────────────────────────────

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function parseMessage(text: string): { html: string; codeBlocks: Array<{ code: string; language: string; filename?: string }> } {
  const codeBlocks: Array<{ code: string; language: string; filename?: string }> = [];

  const stripped = text.replace(/```(\w+)?(?: (.+))?\n([\s\S]*?)```/g, (_, lang, filename, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ code, language: lang || 'text', filename: filename?.trim() });
    return `\x00CODE${idx}\x00`;
  });

  let html = escapeHtml(stripped);
  html = html.replace(/\x00CODE(\d+)\x00/g, (_, i) =>
    `<span class="code-placeholder" data-idx="${i}"></span>`
  );
  html = html
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, (_, inner) => `<code class="ic">${escapeHtml(inner)}</code>`)
    .replace(/\n/g, '<br>');

  return { html, codeBlocks };
}

// ─── CodeBlock component ──────────────────────────────────────────────────────

function CodeBlock({ code, language, filename, onSendToCode }: {
  code: string; language: string; filename?: string;
  onSendToCode: (code: string, filename?: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ margin: '10px 0', borderRadius: 10, overflow: 'hidden', border: '1px solid #2a2a2a' }}>
      {/* Header */}
      <div style={{
        background: '#1e1e1e', display: 'flex', alignItems: 'center',
        padding: '6px 12px', gap: 8,
      }}>
        <span style={{ fontSize: 11, color: '#9C9589', fontFamily: 'JetBrains Mono, monospace', flex: 1 }}>
          {filename || language}
        </span>
        <button
          onClick={copy}
          style={{
            background: 'none', border: 'none', color: copied ? '#4A7C3B' : '#9C9589',
            fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
            padding: '2px 6px', borderRadius: 4, transition: 'color 0.15s',
          }}
        >
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>
      </div>

      {/* Code */}
      <div style={{ background: '#111', padding: '14px 16px', overflowX: 'auto' }}>
        <pre style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#e8e8e8', lineHeight: 1.6 }}>
          <code>{code}</code>
        </pre>
      </div>

      {/* Send to Code button */}
      <button
        onClick={() => onSendToCode(code, filename || `${language}-snippet`)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', padding: '9px 14px',
          background: '#D4A94A', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, color: '#fff',
          fontFamily: 'DM Sans, sans-serif',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#e8b05a')}
        onMouseLeave={e => (e.currentTarget.style.background = '#D4A94A')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="5 12 12 5 19 12"/><polyline points="5 19 12 12 19 19"/>
        </svg>
        Send to Code →
      </button>
    </div>
  );
}

// ─── Message component ────────────────────────────────────────────────────────

function Message({ msg, isStreaming, onSendToCode }: {
  msg: ChatMessage; isStreaming: boolean;
  onSendToCode: (code: string, filename?: string) => void;
}) {
  const isUser = msg.role === 'user';
  const isThinking = msg.id === 'streaming' && msg.content === '';
  const { html, codeBlocks } = parseMessage(msg.content);

  const modelLabel = msg.model_used
    ? `via ${msg.model_used.replace(/^anthropic\/|^openai\/|^google\//, '')}${msg.source_tier ? ` · ${msg.source_tier}` : ''}`
    : null;

  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      flexDirection: isUser ? 'row-reverse' : 'row',
      maxWidth: '100%',
    }}>
      {/* Avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: isUser ? '#6B6B6B' : '#2D4A2B',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700,
        color: isUser ? '#fff' : '#D4A94A',
        marginTop: 2,
      }}>
        {isUser ? 'U' : 'G'}
      </div>

      <div style={{ flex: 1, minWidth: 0, maxWidth: '82%' }}>
        {/* Bubble */}
        <div style={{
          background: isUser ? '#2D4A2B' : '#fff',
          color: isUser ? '#fff' : '#2A2A2A',
          borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
          padding: '10px 14px',
          border: isUser ? 'none' : '1px solid #EDE8DC',
          fontSize: 14, lineHeight: 1.6,
          fontFamily: 'DM Sans, sans-serif',
        }}>
          {isThinking ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
              <span style={{ fontSize: 12, color: isUser ? 'rgba(255,255,255,0.6)' : '#9C9589' }}>
                {THINKING_PHRASES[Math.floor(Date.now() / 8000) % THINKING_PHRASES.length]}
              </span>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: '#9C9589', animation: 'bounce 1.2s ease infinite',
                  animationDelay: `${i * 0.2}s`,
                }} />
              ))}
            </div>
          ) : (
            <>
              <div
                dangerouslySetInnerHTML={{ __html: html }}
                style={{ wordBreak: 'break-word' }}
              />
              {isStreaming && msg.id === 'streaming' && msg.content.length > 0 && (
                <span style={{
                  display: 'inline-block', width: 2, height: 14,
                  background: '#D4A94A', marginLeft: 2, verticalAlign: 'text-bottom',
                  animation: 'blink 0.8s step-end infinite',
                }} />
              )}
            </>
          )}
        </div>

        {/* Code blocks */}
        {!isUser && codeBlocks.length > 0 && (
          <div style={{ marginTop: 6 }}>
            {codeBlocks.map((block, i) => (
              <CodeBlock key={i} {...block} onSendToCode={onSendToCode} />
            ))}
          </div>
        )}

        {/* Model label */}
        {!isUser && modelLabel && !isStreaming && (
          <div style={{ marginTop: 5, fontSize: 11, color: '#9C9589', fontFamily: 'DM Sans, sans-serif' }}>
            {modelLabel}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { label: 'Build a landing page', prompt: 'Create a modern landing page with hero section, features grid, and CTA button' },
  { label: 'Create a REST API', prompt: 'Design a REST API with authentication, CRUD endpoints, and proper error handling' },
  { label: 'Add dark mode', prompt: 'Implement dark mode toggle with CSS variables and localStorage persistence' },
  { label: 'Deploy to Vercel', prompt: 'Guide me through deploying this project to Vercel with environment variables' },
];

function EmptyState({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 52, marginBottom: 16, lineHeight: 1 }}>👺</div>
      <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 20, color: '#2D4A2B', fontWeight: 700, marginBottom: 8 }}>
        What are you building today?
      </h3>
      <p style={{ fontSize: 14, color: '#6B6B6B', fontFamily: 'DM Sans, sans-serif', marginBottom: 24, maxWidth: 360, lineHeight: 1.6 }}>
        Describe a feature, ask for code, or request a review. Your goblin handles it.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 420 }}>
        {SUGGESTIONS.map(s => (
          <button
            key={s.label}
            onClick={() => onSuggestion(s.prompt)}
            style={{
              padding: '8px 14px', borderRadius: 20,
              border: '1px solid #DDD7CC',
              background: '#fff', color: '#2A2A2A',
              fontSize: 13, fontFamily: 'DM Sans, sans-serif',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget.style.background = '#2D4A2B'); (e.currentTarget.style.color = '#fff'); (e.currentTarget.style.borderColor = '#2D4A2B'); }}
            onMouseLeave={e => { (e.currentTarget.style.background = '#fff'); (e.currentTarget.style.color = '#2A2A2A'); (e.currentTarget.style.borderColor = '#DDD7CC'); }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── ChatTab ──────────────────────────────────────────────────────────────────

export function ChatTab({ projectId }: ChatTabProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);

  const { selectedModel, changeModel, setSelectedModel } = useChatModel();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingContentRef = useRef('');
  const baseMessagesRef = useRef<ChatMessage[]>([]);
  const streamingMessageRef = useRef<ChatMessage | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadHistory();
    return () => { abortControllerRef.current?.abort(); };
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const history = await apiGet<ChatMessage[]>(`/api/chat/${projectId}/history`);
      setMessages(history);
    } catch { /* non-fatal */ } finally { setIsLoadingHistory(false); }
  };

  const sendToCode = (code: string, filename?: string) => {
    window.dispatchEvent(new CustomEvent('goblin:sendToCode', {
      detail: { code, filename: filename || 'generated-code.js' }
    }));
    toast.success('Sent to Code tab ✓', { duration: 1500 });
  };

  const handleSubmit = async (text: string, model: SelectedModel) => {
    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      project_id: projectId,
      role: 'user',
      content: text,
      model_used: null,
      source_tier: null,
      created_at: new Date(),
    };

    const withUser = [...messages, userMsg];
    setMessages(withUser);
    setIsStreaming(true);
    setError(null);
    setTokenInfo(null);

    streamingContentRef.current = '';
    baseMessagesRef.current = withUser;

    const streamMsg: ChatMessage = {
      id: 'streaming',
      project_id: projectId,
      role: 'assistant',
      content: '',
      model_used: model.slug,
      source_tier: null,
      created_at: new Date(),
    };
    streamingMessageRef.current = streamMsg;
    setMessages([...withUser, streamMsg]);

    try {
      abortControllerRef.current = new AbortController();
      await apiStream(
        '/api/chat/stream',
        { projectId, message: text, modelSlug: model.slug },
        (raw: unknown) => {
          const d = raw as StreamMessage;

          if (d.type === 'meta') {
            if (streamingMessageRef.current) {
              streamingMessageRef.current = {
                ...streamingMessageRef.current,
                model_used: d.model || model.slug,
                source_tier: (d.source_tier || null) as ChatMessage['source_tier'],
              };
              setMessages([...baseMessagesRef.current, streamingMessageRef.current]);
            }
          } else if (d.type === 'delta') {
            streamingContentRef.current += d.content ?? '';
            if (streamingMessageRef.current) {
              streamingMessageRef.current = { ...streamingMessageRef.current, content: streamingContentRef.current };
              setMessages([...baseMessagesRef.current, streamingMessageRef.current]);
            }
          } else if (d.type === 'done') {
            if (streamingMessageRef.current) {
              const final: ChatMessage = {
                ...streamingMessageRef.current,
                id: d.messageId || streamingMessageRef.current.id,
                model_used: d.model_used || streamingMessageRef.current.model_used,
                source_tier: (d.source_tier || streamingMessageRef.current.source_tier) as ChatMessage['source_tier'],
              };
              setMessages([...baseMessagesRef.current, final]);
              streamingMessageRef.current = null;
            }
            if (d.input_tokens != null && d.output_tokens != null) {
              setTokenInfo({
                input: d.input_tokens, output: d.output_tokens,
                provider: model.provider, layer: d.source_tier || model.layer,
                tokenDisplay: d.token_display,
              });
            }
            setIsStreaming(false);
          } else if (d.type === 'error') {
            setError(d.message || 'Streaming error');
            setIsStreaming(false);
            setMessages(baseMessagesRef.current);
            streamingMessageRef.current = null;
          }
        },
        abortControllerRef.current.signal
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send';
      setError(msg);
      setIsStreaming(false);
      setMessages(baseMessagesRef.current);
      streamingMessageRef.current = null;
    }
  };

  const handleSuggestion = (prompt: string) => {
    // Pre-fill input by triggering submit directly
    handleSubmit(prompt, selectedModel);
  };

  if (isLoadingHistory) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 32, height: 32, border: '2px solid #EDE8DC', borderTopColor: '#2D4A2B', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ fontSize: 13, color: '#9C9589', fontFamily: 'DM Sans, sans-serif' }}>Loading…</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F7F4ED' }}>
      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:scale(0)}40%{transform:scale(1)} }
        @keyframes blink { 50%{opacity:0} }
        .ic { background:rgba(45,74,43,0.08);padding:1px 5px;border-radius:4px;font-family:JetBrains Mono,monospace;font-size:0.9em; }
      `}</style>

      {/* First-chat tip (dismissable) */}
      <FirstChatTip />

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0
          ? <EmptyState onSuggestion={handleSuggestion} />
          : messages.map(m => (
              <Message
                key={m.id}
                msg={m}
                isStreaming={isStreaming}
                onSendToCode={sendToCode}
              />
            ))
        }

        {error && (() => {
          const isNoModel = /no model|no key|api key|not connected|no provider/i.test(error);
          return (
            <div style={{
              background: isNoModel ? 'rgba(212,169,74,0.08)' : '#FEF2F2',
              border: `1px solid ${isNoModel ? 'rgba(212,169,74,0.3)' : '#FCA5A5'}`,
              borderRadius: 10, padding: '12px 16px', fontSize: 13,
              color: isNoModel ? 'var(--text)' : '#991B1B',
              fontFamily: 'DM Sans, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <span>
                {isNoModel ? (
                  <>
                    No model connected.{' '}
                    <a href="/dashboard/settings/keys" style={{ color: 'var(--ochre-dark)', fontWeight: 600, textDecoration: 'underline' }}>
                      Add an API key in Settings →
                    </a>
                  </>
                ) : error}
              </span>
              <button
                onClick={() => setError(null)}
                style={{ fontSize: 16, background: 'none', border: 'none', color: isNoModel ? 'var(--meta)' : '#991B1B', cursor: 'pointer', flexShrink: 0, lineHeight: 1, padding: '0 2px' }}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          );
        })()}

        <div ref={messagesEndRef} />
      </div>

      {/* Token display */}
      {tokenInfo && (
        <div style={{
          padding: '4px 16px',
          fontSize: 11, color: 'var(--meta)',
          fontFamily: 'JetBrains Mono, monospace',
          background: 'var(--cream)',
          display: 'flex', gap: 6, alignItems: 'center',
        }}>
          {tokenInfo.tokenDisplay
            ? <span>{tokenInfo.tokenDisplay}</span>
            : (
              <>
                <span>↑{tokenInfo.input.toLocaleString()} ↓{tokenInfo.output.toLocaleString()} tokens</span>
                {calcCost(tokenInfo) && (
                  <><span>·</span><span>{calcCost(tokenInfo)}</span></>
                )}
              </>
            )
          }
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSubmit={handleSubmit}
        disabled={isStreaming}
        selectedModel={selectedModel}
        onModelChange={(m) => setSelectedModel(m)}
      />
    </div>
  );
}
