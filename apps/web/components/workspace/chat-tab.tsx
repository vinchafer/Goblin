"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiStream, apiGet } from "@/lib/api";
import { ChatInput, useChatModel } from "@/components/chat/ChatInput";
import { ChatMessages, type TokenInfo } from "./ChatMessages";
import { GoblinLoader } from "@/components/ui/GoblinLoader";
import { FirstChatTip } from "@/components/onboarding/first-chat-tip";
import type { ChatMessage } from "@goblin/shared/src/schemas";
import type { SelectedModel } from "@/components/chat/ChatInput";

const EXAMPLE_PROMPTS = [
  'Build a simple landing page with a hero section and CTA button.',
  'Create a REST API endpoint that returns user data as JSON.',
  'Write a React component for a contact form with validation.',
];

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

const PAGE_SIZE = 20;

export function ChatTab({ projectId }: ChatTabProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [hasAvailableModel, setHasAvailableModel] = useState<boolean | null>(null);

  const { selectedModel, setSelectedModel } = useChatModel();

  const streamingContentRef = useRef('');
  const baseMessagesRef = useRef<ChatMessage[]>([]);
  const streamingMessageRef = useRef<ChatMessage | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages([]);
    setOffset(0);
    setHasMore(false);
    loadHistory(0, true);
    checkModels();
    return () => { abortControllerRef.current?.abort(); };
  }, [projectId]);

  const checkModels = async () => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL;
      if (!apiBase) { setHasAvailableModel(false); return; }
      const [models, keys] = await Promise.all([
        apiGet<Array<{ layer: string; available: boolean; provider: string }>>('/api/models'),
        apiGet<Array<{ provider: string }>>('/api/byok-keys'),
      ]);
      const connectedProviders = new Set(keys.map((k: { provider: string }) => k.provider));
      const anyAvailable = models.some((m: { layer: string; available: boolean; provider: string }) => {
        if (m.layer === 'free_api' && m.available) return true;
        if (m.layer === 'goblin_hosted' && m.available) return true;
        if (m.layer === 'byok' && connectedProviders.has(m.provider)) return true;
        return false;
      });
      setHasAvailableModel(anyAvailable);
    } catch {
      setHasAvailableModel(true); // Don't block UI on network error
    }
  };

  const loadHistory = async (currentOffset: number, initial = false) => {
    try {
      if (initial) setIsLoadingHistory(true);
      else setIsLoadingOlder(true);
      const page = await apiGet<ChatMessage[]>(
        `/api/chat/${projectId}/history?limit=${PAGE_SIZE}&offset=${currentOffset}`
      );
      if (initial) {
        setMessages(page);
      } else {
        setMessages(prev => [...page, ...prev]);
      }
      setHasMore(page.length === PAGE_SIZE);
      setOffset(currentOffset + page.length);
    } catch { /* non-fatal */ } finally {
      setIsLoadingHistory(false);
      setIsLoadingOlder(false);
    }
  };

  const loadOlder = () => loadHistory(offset);

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
            setError(d.message || 'Etwas ist schiefgelaufen — bitte erneut versuchen. Deine Nachricht wurde nicht gesendet.');
            setIsStreaming(false);
            setMessages(baseMessagesRef.current);
            streamingMessageRef.current = null;
          }
        },
        abortControllerRef.current.signal
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Server nicht erreichbar — prüfe deine Verbindung und versuche es erneut.');
      setIsStreaming(false);
      setMessages(baseMessagesRef.current);
      streamingMessageRef.current = null;
    }
  };

  if (isLoadingHistory) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <GoblinLoader variant="thinking" size="md" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--paper)' }}>
      <FirstChatTip />

      {/* FIX C: No model configured banner */}
      {hasAvailableModel === false && (
        <div style={{
          background: 'rgba(184,92,60,0.06)', borderBottom: '1px solid rgba(184,92,60,0.2)',
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <div style={{ flex: 1, fontSize: 13, color: 'var(--danger)', fontFamily: 'var(--font-sans)' }}>
            No model configured. Add an API key to start chatting.
          </div>
          <button
            onClick={() => router.push('/dashboard/settings/keys')}
            style={{
              background: 'var(--brand-green)', color: '#fff', border: 'none',
              borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)',
            }}
          >
            Add API key →
          </button>
        </div>
      )}

      {/* Decryption error banner */}
      {error && error.includes('re-entered') && (
        <div style={{
          background: 'rgba(184,92,60,0.06)', borderBottom: '1px solid rgba(184,92,60,0.2)',
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <div style={{ flex: 1, fontSize: 13, color: 'var(--danger)', fontFamily: 'var(--font-sans)' }}>
            {error}
          </div>
          <button
            onClick={() => router.push('/dashboard/settings/keys')}
            style={{
              background: 'var(--brand-green)', color: '#fff', border: 'none',
              borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)',
            }}
          >
            Go to API Keys →
          </button>
        </div>
      )}

      {/* Load older messages */}
      {hasMore && (
        <div style={{ textAlign: 'center', padding: '8px 0', flexShrink: 0 }}>
          <button
            onClick={loadOlder}
            disabled={isLoadingOlder}
            style={{
              background: 'none', border: '1px solid var(--div)',
              borderRadius: 20, padding: '5px 16px',
              fontSize: 12, color: 'var(--meta)', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-green)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--div)')}
          >
            {isLoadingOlder ? '…' : '↑ Ältere Nachrichten laden'}
          </button>
        </div>
      )}

      {/* FIX B: Empty state with example prompts */}
      {messages.length === 0 && !isStreaming && !isLoadingHistory ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px 48px' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 20, color: 'var(--brand-green)', fontWeight: 700, marginBottom: 6 }}>
              What are we building?
            </div>
            <div style={{ fontSize: 13, color: 'var(--meta)', fontFamily: 'var(--font-sans)' }}>
              Describe your idea or pick a starting point below.
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 480 }}>
            {EXAMPLE_PROMPTS.map(prompt => (
              <button
                key={prompt}
                onClick={() => hasAvailableModel !== false && handleSubmit(prompt, selectedModel)}
                disabled={hasAvailableModel === false}
                style={{
                  background: 'var(--panel)', border: '1px solid var(--div)',
                  borderRadius: 8, padding: '11px 16px', textAlign: 'left',
                  fontSize: 13, color: 'var(--text)', cursor: hasAvailableModel === false ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-sans)', transition: 'border-color 0.15s',
                  opacity: hasAvailableModel === false ? 0.5 : 1,
                }}
                onMouseEnter={e => { if (hasAvailableModel !== false) e.currentTarget.style.borderColor = 'var(--brand-green)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--div)'; }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ChatMessages
          messages={messages}
          isStreaming={isStreaming}
          error={error}
          tokenInfo={tokenInfo}
          onSendToCode={sendToCode}
          onSuggestion={prompt => handleSubmit(prompt, selectedModel)}
          onDismissError={() => setError(null)}
        />
      )}

      <ChatInput
        onSubmit={handleSubmit}
        disabled={isStreaming || hasAvailableModel === false}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
      />
    </div>
  );
}
