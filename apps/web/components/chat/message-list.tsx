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
}

const SUGGESTIONS = [
  "Build a landing page",
  "Add a dark mode toggle",
  "Create a Stripe checkout",
  "Add user authentication",
];

export function MessageList({ messages, isStreaming, currentStreamingMessage, isLoadingHistory, onSuggestionClick }: MessageListProps) {
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
          Your goblin is ready.
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--goblin-gray)' }}>
          Start with one of these:
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

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-6">
      {messages.map(message => (
        <div
          key={message.id}
          className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {message.role === 'assistant' && (
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--goblin-moss)' }}>
              <Bot className="w-4 h-4 text-white" />
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
              <User className="w-4 h-4 text-white" />
            </div>
          )}
        </div>
      ))}

      {isStreaming && (
        <div className="flex gap-3 justify-start">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--goblin-moss)' }}>
            <Bot className="w-4 h-4 text-white" />
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