"use client";

import { useEffect, useRef } from "react";
import { MessageContent } from "./message-content";
import { Bot, User, Sparkles } from "lucide-react";
import type { ChatMessage } from "@goblin/shared/src/schemas";

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentStreamingMessage: string;
  isLoadingHistory?: boolean;
  onSuggestionClick?: (text: string) => void;
  metaInfo?: { model: string; sourceTier: string } | null;
}

const SUGGESTIONS = [
  "Build a landing page",
  "Add a dark mode toggle",
  "Create a Stripe checkout",
  "Add user authentication",
];

export function MessageList({ messages, isStreaming, currentStreamingMessage, isLoadingHistory, onSuggestionClick, metaInfo }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages, currentStreamingMessage]);

  // Loading state: skeleton bubbles
  if (isLoadingHistory) {
    return (
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-6">
        {[1, 2, 3].map(i => (
          <div key={i} className={`flex gap-3 ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
            {i % 2 !== 0 && (
              <div className="w-8 h-8 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: 'var(--goblin-light)' }} />
            )}
            <div
              className={`max-w-[65%] px-4 py-3 rounded-2xl animate-pulse ${i % 2 === 0 ? 'rounded-tr-none' : 'rounded-tl-none'}`}
              style={{
                backgroundColor: i % 2 === 0 ? 'rgba(212, 169, 74, 0.15)' : 'var(--goblin-light)',
                height: `${40 + i * 20}px`,
              }}
            />
            {i % 2 === 0 && (
              <div className="w-8 h-8 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: 'var(--goblin-light)' }} />
            )}
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (messages.length === 0 && !isStreaming) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingBottom: 40 }}>
        {/* Goblin Logo - small, Moss */}
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--moss)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--white)', fontFamily: 'Fraunces, serif' }}>G</span>
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text)', marginBottom: 8, fontFamily: 'Fraunces, serif' }}>
          What are you building today?
        </h2>
        <p style={{ fontSize: 14, color: 'var(--meta)', marginBottom: 32 }}>
          Describe your project or ask me anything.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, maxWidth: 400 }}>
          {SUGGESTIONS.map(text => (
            <button
              key={text}
              onClick={() => onSuggestionClick?.(text)}
              style={{
                padding: '8px 16px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 500,
                backgroundColor: 'var(--white)',
                color: 'var(--text)',
                border: '1px solid #EDE8DC',
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: 'DM Sans, sans-serif',
              }}
              onMouseEnter={e => { 
                e.currentTarget.style.backgroundColor = '#F7F3EC'; 
                e.currentTarget.style.borderColor = 'var(--ochre)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => { 
                e.currentTarget.style.backgroundColor = 'var(--white)'; 
                e.currentTarget.style.borderColor = 'var(--div)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const showMetaBadge = metaInfo && currentStreamingMessage;

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-6">
      {messages.map(message => (
        <div
          key={message.id}
          style={{ display: 'flex', gap: 12, marginBottom: 16, justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start' }}
        >
          {message.role === 'assistant' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--moss)' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>G</span>
              </div>
              {message.model_used && message.source_tier && (
                <span style={{ fontSize: 9, color: '#6b6560', whiteSpace: 'nowrap', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  via {message.model_used.split('-').slice(0, 2).join('-')} · {(message.source_tier as string) === 'byok' ? 'BYOK' : (message.source_tier as string) === 'free_api' ? 'Free' : 'Hosted'}
                </span>
              )}
            </div>
          )}

          <div
            style={{
              maxWidth: message.role === 'user' ? '75%' : '85%',
              padding: '12px 16px',
              borderRadius: message.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              backgroundColor: message.role === 'user' ? 'var(--moss)' : 'var(--white)',
              border: message.role === 'assistant' ? '1px solid #EDE8DC' : 'none',
              color: message.role === 'user' ? 'rgba(255, 255, 255, 0.92)' : 'var(--text)',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            <MessageContent content={message.content} messageId={message.id} role={message.role} />
          </div>

          {message.role === 'user' && (
            <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--ochre)', flexShrink: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>U</span>
            </div>
          )}
        </div>
      ))}

      {isStreaming && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, justifyContent: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--moss)' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>G</span>
            </div>
            {showMetaBadge && (
              <span style={{ fontSize: 10, color: 'var(--meta)', whiteSpace: 'nowrap', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'JetBrains Mono, monospace' }}>
                via {metaInfo.model.split('-').slice(0, 2).join('-')} · {(metaInfo.sourceTier as string) === 'byok' ? 'BYOK' : (metaInfo.sourceTier as string) === 'free_api' ? 'Free' : 'Hosted'}
              </span>
            )}
          </div>
          <div
            style={{
              maxWidth: '85%',
              padding: '12px 16px',
              borderRadius: '16px 16px 16px 4px',
              backgroundColor: 'var(--white)',
              border: '1px solid #EDE8DC',
              color: 'var(--text)',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            {currentStreamingMessage ? (
              <div className="streaming-cursor">
                <MessageContent content={currentStreamingMessage} role="assistant" />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 24 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--moss)', opacity: 0.8, animation: 'goblin-pulse 1.4s infinite ease-in-out' }} />
                <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--moss)', opacity: 0.8, animation: 'goblin-pulse 1.4s infinite ease-in-out', animationDelay: '0.22s' }} />
                <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--moss)', opacity: 0.8, animation: 'goblin-pulse 1.4s infinite ease-in-out', animationDelay: '0.44s' }} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}