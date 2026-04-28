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
      <div className="flex-1 flex flex-col items-center justify-center text-center pb-10">
        <div className="text-6xl mb-4">👺</div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--goblin-slate)', fontFamily: 'Fraunces, serif' }}>
          What are you building today?
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--goblin-gray)' }}>
          Describe your project or ask me anything.
        </p>
        <div className="flex flex-wrap justify-center gap-2 max-w-md">
          {SUGGESTIONS.map(text => (
            <button
              key={text}
              onClick={() => onSuggestionClick?.(text)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
              style={{
                backgroundColor: 'rgba(45, 74, 43, 0.08)',
                color: 'var(--goblin-moss)',
                border: '1px solid rgba(45, 74, 43, 0.15)',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(45, 74, 43, 0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(45, 74, 43, 0.08)'; }}
            >
              <Sparkles className="w-3 h-3 inline-block mr-1.5" />
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
          className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {message.role === 'assistant' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--goblin-moss)' }}>
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
            className={`max-w-[88%] md:max-w-2xl px-4 py-3 rounded-2xl ${message.role === 'user' ? 'rounded-tr-none' : 'rounded-tl-none'}`}
            style={{
              backgroundColor: message.role === 'user' ? 'var(--goblin-moss)' : 'white',
              border: message.role === 'assistant' ? '1px solid var(--goblin-light)' : 'none',
              color: message.role === 'user' ? 'white' : 'inherit',
            }}
          >
            <MessageContent content={message.content} messageId={message.id} role={message.role} />
          </div>

          {message.role === 'user' && (
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--goblin-ochre)' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>U</span>
            </div>
          )}
        </div>
      ))}

      {isStreaming && (
        <div className="flex gap-3 justify-start">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--goblin-moss)' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>G</span>
            </div>
            {showMetaBadge && (
              <span style={{ fontSize: 9, color: '#6b6560', whiteSpace: 'nowrap', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                via {metaInfo.model.split('-').slice(0, 2).join('-')} · {(metaInfo.sourceTier as string) === 'byok' ? 'BYOK' : (metaInfo.sourceTier as string) === 'free_api' ? 'Free' : 'Hosted'}
              </span>
            )}
          </div>
          <div className="max-w-[88%] md:max-w-2xl px-4 py-3 rounded-2xl rounded-tl-none bg-white" style={{ border: '1px solid var(--goblin-light)' }}>
            {currentStreamingMessage ? (
              <MessageContent content={currentStreamingMessage} role="assistant" />
            ) : (
              <div className="flex items-center gap-1 h-6">
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--goblin-moss)', animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--goblin-moss)', animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--goblin-moss)', animationDelay: '300ms' }} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}