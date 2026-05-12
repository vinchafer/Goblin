"use client";

import { useRef, useEffect } from "react";
import { CodeBlock } from "./CodeBlock";
import type { ChatMessage as ChatMessageType } from "@goblin/shared/src/schemas";

const THINKING_PHRASES = [
  'Your goblin is thinking…',
  'Cooking up something good…',
  'Consulting the ancient scrolls…',
  'Connecting the dots…',
  'Spinning up the gears…',
];

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function parseMessage(text: string): {
  html: string;
  codeBlocks: Array<{ code: string; language: string; filename?: string }>;
} {
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

interface Props {
  msg: ChatMessageType;
  isStreaming: boolean;
  onSendToCode: (code: string, filename?: string) => void;
}

export function ChatMessageItem({ msg, isStreaming, onSendToCode }: Props) {
  const isUser = msg.role === 'user';
  const isThinking = msg.id === 'streaming' && msg.content === '';
  const { html, codeBlocks } = parseMessage(msg.content);
  const thinkingPhrase = THINKING_PHRASES[Math.floor(Date.now() / 8000) % THINKING_PHRASES.length];

  const modelLabel = msg.model_used
    ? msg.model_used
        .replace(/^anthropic\//, '')
        .replace(/^openai\//, '')
        .replace(/^gemini\//, '')
        .replace(/^groq\//, '')
    : null;

  if (isUser) {
    return (
      <div className="animate-msg-appear" style={{ display: 'flex', justifyContent: 'flex-end', maxWidth: '100%' }}>
        <div style={{
          maxWidth: '76%',
          background: 'var(--moss)',
          color: '#fff',
          borderRadius: '16px 4px 16px 16px',
          padding: '10px 14px',
          fontSize: 14, lineHeight: 1.65,
          fontFamily: 'DM Sans, sans-serif',
          wordBreak: 'break-word',
        }}>
          {msg.content}
        </div>
      </div>
    );
  }

  // AI message — no background bubble, inline text like claude.ai
  return (
    <div className="animate-msg-appear" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', maxWidth: '100%' }}>
      {/* Goblin avatar */}
      <div style={{
        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
        background: 'var(--moss)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, marginTop: 2,
        animation: isThinking ? 'goblin-think 1.8s ease-in-out infinite' : undefined,
      }}>
        👺
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {isThinking ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
            <span style={{ fontSize: 13, color: 'var(--text-faint)', fontFamily: 'DM Sans, sans-serif' }}>
              {thinkingPhrase}
            </span>
            <div style={{ display: 'flex', gap: 3 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: 'var(--ochre)',
                  animation: 'goblinPulse 1.2s ease-in-out infinite',
                  animationDelay: `${i * 0.16}s`,
                }} />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Text content — no bubble */}
            <div
              className="goblin-ai-text"
              dangerouslySetInnerHTML={{ __html: html }}
              style={{
                fontSize: 14, lineHeight: 1.7,
                color: 'var(--text, #2A2A2A)',
                fontFamily: 'DM Sans, sans-serif',
                wordBreak: 'break-word',
              }}
            />
            {/* Streaming cursor */}
            {isStreaming && msg.id === 'streaming' && msg.content.length > 0 && (
              <span style={{
                display: 'inline-block', width: 2, height: 14,
                background: 'var(--ochre)', marginLeft: 2, verticalAlign: 'text-bottom',
                animation: 'blink 0.8s step-end infinite',
              }} />
            )}

            {/* Code blocks */}
            {codeBlocks.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {codeBlocks.map((block, i) => (
                  <CodeBlock key={i} {...block} onSendToCode={onSendToCode} />
                ))}
              </div>
            )}

            {/* Model attribution */}
            {modelLabel && !isStreaming && (
              <div style={{
                marginTop: 6, fontSize: 11, color: 'var(--text-faint)',
                fontFamily: 'DM Sans, sans-serif',
              }}>
                {modelLabel}
                {msg.source_tier === 'free_api' && (
                  <span style={{ marginLeft: 4, color: '#4A7A7A' }}>· free</span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
