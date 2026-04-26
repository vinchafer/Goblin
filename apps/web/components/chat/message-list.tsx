"use client";

import { useEffect, useRef } from "react";
import { MessageContent } from "./message-content";
import { Bot, User } from "lucide-react";
import type { ChatMessage } from "@goblin/shared/src/schemas";

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentStreamingMessage: string;
}

export function MessageList({ messages, isStreaming, currentStreamingMessage }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages, currentStreamingMessage]);

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
            className={`max-w-2xl px-4 py-3 rounded-2xl ${message.role === 'user' ? 'rounded-tr-none' : 'rounded-tl-none'}`}
            style={{
              backgroundColor: message.role === 'user' ? 'rgba(212, 169, 74, 0.1)' : 'white',
              border: message.role === 'assistant' ? '1px solid var(--goblin-light)' : 'none'
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
          <div className="max-w-2xl px-4 py-3 rounded-2xl rounded-tl-none bg-white" style={{ border: '1px solid var(--goblin-light)' }}>
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