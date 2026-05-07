"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { apiStream, apiGet } from "@/lib/api";
import { ChatInput, useChatModel } from "@/components/chat/ChatInput";
import { ChatMessages, type TokenInfo } from "./ChatMessages";
import { GoblinLoader } from "@/components/ui/GoblinLoader";
import { FirstChatTip } from "@/components/onboarding/first-chat-tip";
import type { ChatMessage } from "@goblin/shared/src/schemas";
import type { SelectedModel } from "@/components/chat/ChatInput";

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);

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
    return () => { abortControllerRef.current?.abort(); };
  }, [projectId]);

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
            setError(d.message || 'Streaming error');
            setIsStreaming(false);
            setMessages(baseMessagesRef.current);
            streamingMessageRef.current = null;
          }
        },
        abortControllerRef.current.signal
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--cream, #F7F4ED)' }}>
      <FirstChatTip />

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
              fontFamily: 'DM Sans, sans-serif', transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--moss)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--div)')}
          >
            {isLoadingOlder ? '…' : '↑ Ältere Nachrichten laden'}
          </button>
        </div>
      )}

      <ChatMessages
        messages={messages}
        isStreaming={isStreaming}
        error={error}
        tokenInfo={tokenInfo}
        onSendToCode={sendToCode}
        onSuggestion={prompt => handleSubmit(prompt, selectedModel)}
        onDismissError={() => setError(null)}
      />

      <ChatInput
        onSubmit={handleSubmit}
        disabled={isStreaming}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
      />
    </div>
  );
}
