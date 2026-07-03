"use client";

import { useEffect } from "react";
import { ChatMessageItem } from "./ChatMessage";
import type { ChatMessage } from "@goblin/shared/src/schemas";
import { GoblinLogo } from "@/components/brand/GoblinLogo";
import { useStickToBottom } from "@/hooks/useStickToBottom";
import { ScrollToEndChip } from "@/components/chat/ScrollToEndChip";

// ─── Pricing ──────────────────────────────────────────────────────────────────

const PRICE_PER_1K: Record<string, { input: number; output: number }> = {
  anthropic: { input: 0.003,  output: 0.015  },
  openai:    { input: 0.002,  output: 0.006  },
  google:    { input: 0.001,  output: 0.002  },
  groq:      { input: 0.0002, output: 0.0006 },
  deepseek:  { input: 0.0002, output: 0.0006 },
  mistral:   { input: 0.002,  output: 0.006  },
  xai:       { input: 0.003,  output: 0.015  },
};

interface TokenInfo {
  input: number;
  output: number;
  provider: string;
  layer: string;
  tokenDisplay?: string;
}

function calcCost(t: TokenInfo): string | null {
  if (t.layer === 'goblin_hosted') return null;
  if (t.layer === 'free_api') return 'Free';
  const p = PRICE_PER_1K[t.provider];
  if (!p) return null;
  const cost = (t.input / 1000) * p.input + (t.output / 1000) * p.output;
  return `~$${cost.toFixed(4)}`;
}

// ─── Empty state ──────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { label: 'Login-Seite mit Supabase Auth', prompt: 'Baue mir eine Login-Seite mit Supabase Auth, E-Mail-Magic-Link und Google OAuth' },
  { label: 'Dark-Mode-Toggle', prompt: 'Füge einen Dark-Mode-Toggle zu meiner Navbar hinzu — CSS-Variablen und localStorage' },
  { label: 'REST API für Todo-Liste', prompt: 'Erstelle eine REST API für eine Todo-Liste: GET, POST, PUT, DELETE mit Supabase' },
  { label: 'Landing Page', prompt: 'Baue eine moderne Landing Page mit Hero, Features-Grid und CTA-Button' },
];

function EmptyState({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', textAlign: 'center',
    }}>
      <div style={{ marginBottom: 14 }}><GoblinLogo state="idle" size={52} variant="green" /></div>
      <h3 style={{
        fontFamily: 'var(--font-sans)', fontSize: 22,
        color: 'var(--brand-green)', fontWeight: 700, marginBottom: 8, letterSpacing: '-0.3px',
      }}>
        Dein Goblin ist bereit.
      </h3>
      <p style={{
        fontSize: 13, color: 'var(--meta)',
        fontFamily: 'var(--font-sans)',
        marginBottom: 8, maxWidth: 340, lineHeight: 1.6,
      }}>
        Einige Ideen:
      </p>
      {/* Idea list */}
      <ul style={{
        listStyle: 'none', padding: 0, margin: '0 0 24px',
        display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left',
        maxWidth: 380,
      }}>
        {SUGGESTIONS.slice(0, 3).map(s => (
          <li key={s.label}>
            <button
              onClick={() => onSuggestion(s.prompt)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, color: 'var(--text-2)',
                fontFamily: 'var(--font-sans)', textAlign: 'left',
                padding: '4px 0', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 8,
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--brand-green)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}
            >
              <span style={{ color: 'var(--brand-gold)', flexShrink: 0, fontSize: 'var(--t-caption-fs)', marginTop: 2 }}>•</span>
              <span>&ldquo;{s.label}&rdquo;</span>
            </button>
          </li>
        ))}
      </ul>
      {/* Quick-start chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', maxWidth: 420 }}>
        {SUGGESTIONS.map(s => (
          <button
            key={s.label}
            onClick={() => onSuggestion(s.prompt)}
            style={{
              padding: '7px 14px', borderRadius: 20,
              border: '1px solid #DDD7CC',
              background: '#fff', color: 'var(--text)',
              fontSize: 'var(--t-caption-fs)', fontFamily: 'var(--font-sans)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand-green)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'var(--brand-green)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ChatMessagesProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  tokenInfo: TokenInfo | null;
  onSendToCode: (code: string, filename?: string) => void;
  onSuggestion: (prompt: string) => void;
  onDismissError: () => void;
}

// ─── ChatMessages ─────────────────────────────────────────────────────────────

export function ChatMessages({
  messages, isStreaming, error, tokenInfo,
  onSendToCode, onSuggestion, onDismissError,
}: ChatMessagesProps) {
  // U0: auto-follow only while the user is at the bottom; scroll-up during
  // streaming releases the pin, the chip below brings them back.
  const { containerRef: scrollRef, atBottom, handleScroll, onContentChange, scrollToBottom } =
    useStickToBottom<HTMLDivElement>();

  useEffect(() => {
    onContentChange();
  }, [messages, onContentChange]);

  const isNoModel = error ? /no model|no key|api key|not connected|no provider/i.test(error) : false;

  return (
    <>
      <style>{`
        @keyframes goblinPulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1)} }
        @keyframes blink { 50%{opacity:0} }
        .ic { background:rgba(45,74,43,0.08);padding:1px 5px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:0.88em; }
        .goblin-ai-text strong { font-weight:600; }
        .goblin-ai-text em { font-style:italic; }
      `}</style>

      {/* Message list — relative wrapper anchors the U0 scroll chip */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1, overflowY: 'auto',
          padding: '20px 16px 8px',
          display: 'flex', flexDirection: 'column', gap: 18,
        }}>
        {messages.length === 0
          ? <EmptyState onSuggestion={onSuggestion} />
          : messages.map(m => (
              <ChatMessageItem
                key={m.id}
                msg={m}
                isStreaming={isStreaming}
                onSendToCode={onSendToCode}
              />
            ))
        }

        {/* Error banner */}
        {error && (
          <div style={{
            background: isNoModel ? 'rgba(212,169,74,0.08)' : '#FEF2F2',
            border: `1px solid ${isNoModel ? 'rgba(212,169,74,0.3)' : '#FCA5A5'}`,
            borderRadius: 10, padding: '11px 14px', fontSize: 13,
            color: isNoModel ? 'var(--text, var(--ink-1))' : '#991B1B',
            fontFamily: 'var(--font-sans)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <span>
              {isNoModel ? (
                <>
                  No model connected.{' '}
                  <a href="/dashboard/settings/keys" style={{ color: 'var(--brand-gold)', fontWeight: 600, textDecoration: 'underline' }}>
                    Add an API key →
                  </a>
                </>
              ) : error}
            </span>
            <button
              onClick={onDismissError}
              style={{ fontSize: 'var(--t-body-fs)', background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
              aria-label="Dismiss"
            >×</button>
          </div>
        )}

      </div>

      {/* U0: back-to-live chip when the user scrolled away from the bottom */}
      {!atBottom && messages.length > 0 && (
        <ScrollToEndChip onClick={() => scrollToBottom('smooth')} />
      )}
      </div>

      {/* Token bar */}
      {tokenInfo && (
        <div style={{
          padding: '3px 16px', flexShrink: 0,
          fontSize: 11, color: 'var(--text-faint)',
          fontFamily: 'JetBrains Mono, monospace',
          background: 'var(--paper)',
          display: 'flex', gap: 6, alignItems: 'center',
        }}>
          {tokenInfo.tokenDisplay ? (
            <span>{tokenInfo.tokenDisplay}</span>
          ) : (
            <>
              <span>↑{tokenInfo.input.toLocaleString()} ↓{tokenInfo.output.toLocaleString()}</span>
              {calcCost(tokenInfo) && <><span>·</span><span>{calcCost(tokenInfo)}</span></>}
            </>
          )}
        </div>
      )}
    </>
  );
}

export type { TokenInfo };
