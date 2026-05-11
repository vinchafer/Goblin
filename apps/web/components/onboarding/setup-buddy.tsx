'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { getAuthHeaders, API_URL } from '@/lib/api';
import { RecommendationCard, SetupCompleteCard } from './recommendation-card';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  structuredData?: Array<{ type: string }>;
  piiWarning?: boolean;
}

interface SetupBuddyProps {
  initialState?: {
    goal?: string;
    ai_provider_choice?: string;
    code_hosting_choice?: string;
    deploy_choice?: string;
  };
  isResume?: boolean;
}

function parseStructuredBlocks(text: string): { text: string; blocks: unknown[] } {
  const blocks: unknown[] = [];
  const jsonRegex = /```json\s*(\{[\s\S]*?\})\s*```/g;
  let match;
  while ((match = jsonRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]!);
      if (parsed.type) blocks.push(parsed);
    } catch { /* skip malformed */ }
  }
  const cleanText = text.replace(jsonRegex, '').trim();
  return { text: cleanText, blocks };
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export function SetupBuddy({ initialState, isResume }: SetupBuddyProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Welcome message on mount
  useEffect(() => {
    const welcome = isResume && initialState
      ? buildResumeMessage(initialState)
      : "Hey! I'm the Goblin Setup Buddy 👋\n\nI'll get you ready to build in under 5 minutes. First question:\n\n**What do you want to build?** Just describe it in your own words — no need to be technical.";

    setMessages([{ id: makeId(), role: 'assistant', content: welcome }]);
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;

    const userMsg: Message = { id: makeId(), role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setStreaming(true);
    setStreamingText('');
    setError(null);

    const history = messages.map(m => ({ role: m.role, content: m.content }));

    abortRef.current = new AbortController();

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/onboarding-agent/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: text.trim(), history }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let fullText = '';
      const structuredBlocks: unknown[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as { type: string; content?: string; data?: string; message?: string };
            if (evt.type === 'delta' && evt.content) {
              fullText += evt.content;
              setStreamingText(fullText);
            } else if (evt.type === 'structured' && evt.data) {
              try {
                const parsed = JSON.parse(evt.data);
                if (parsed.type) structuredBlocks.push(parsed);
              } catch { /* skip */ }
            } else if (evt.type === 'pii_warning') {
              const warnMsg: Message = {
                id: makeId(), role: 'assistant',
                content: evt.message ?? '[Sensitive data hidden for your security]',
                piiWarning: true,
              };
              setMessages(prev => [...prev, warnMsg]);
              setStreaming(false);
              setStreamingText('');
              return;
            } else if (evt.type === 'done') {
              break;
            }
          } catch { /* skip */ }
        }
      }

      // Parse any embedded JSON blocks from the full text
      const { text: cleanText, blocks: inlineBlocks } = parseStructuredBlocks(fullText);
      const allBlocks = [...structuredBlocks, ...inlineBlocks];

      const assistantMsg: Message = {
        id: makeId(),
        role: 'assistant',
        content: cleanText || fullText,
        structuredData: allBlocks.length > 0 ? (allBlocks as Array<{ type: string }>) : undefined,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError("Couldn't connect to Goblin. Check your connection and try again.");
    } finally {
      setStreaming(false);
      setStreamingText('');
    }
  }, [messages, streaming]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'DM Sans, sans-serif' }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.map(msg => (
          <div key={msg.id}>
            <div style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              gap: 10, alignItems: 'flex-start',
            }}>
              {msg.role === 'assistant' && (
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: '#2D4A2B', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 2,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#D4A94A', fontFamily: 'Fraunces, serif' }}>G</span>
                </div>
              )}
              <div style={{
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: msg.piiWarning ? 'rgba(184,92,60,0.08)' : msg.role === 'user' ? '#2D4A2B' : '#fff',
                border: msg.piiWarning ? '1px solid rgba(184,92,60,0.3)' : msg.role === 'assistant' ? '1px solid #E8E4DC' : 'none',
                color: msg.role === 'user' ? 'rgba(255,255,255,0.92)' : '#2A2A2A',
                fontSize: 13, lineHeight: 1.6,
              } as React.CSSProperties}>
                <MessageText content={msg.content} />
              </div>
            </div>

            {/* Structured recommendation cards */}
            {msg.structuredData && Array.isArray(msg.structuredData) && (
              <div style={{ marginLeft: 40, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(msg.structuredData as Array<{ type: string }>).map((block, i) => {
                  if (block.type === 'recommendation') {
                    return <RecommendationCard key={i} data={block as Parameters<typeof RecommendationCard>[0]['data']} />;
                  }
                  if (block.type === 'setup_complete') {
                    return <SetupCompleteCard key={i} data={block as Parameters<typeof SetupCompleteCard>[0]['data']} />;
                  }
                  return null;
                })}
              </div>
            )}
          </div>
        ))}

        {/* Streaming assistant message */}
        {streaming && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#2D4A2B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#D4A94A', fontFamily: 'Fraunces, serif' }}>G</span>
            </div>
            <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: '14px 14px 14px 4px', background: '#fff', border: '1px solid #E8E4DC', fontSize: 13, lineHeight: 1.6, color: '#2A2A2A' }}>
              {streamingText ? <MessageText content={streamingText} /> : (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 20 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#2D4A2B', animation: 'bounce 1.2s ease-in-out infinite', animationDelay: `${i * 0.16}s` }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(184,92,60,0.08)', border: '1px solid rgba(184,92,60,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#B85C3C' }}>
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #E8E4DC', background: '#FAFAF8' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Describe what you want to build..."
            rows={1}
            disabled={streaming}
            style={{
              flex: 1, padding: '9px 12px',
              border: '1.5px solid #E8E4DC', borderRadius: 10,
              fontSize: 13, fontFamily: 'DM Sans, sans-serif',
              resize: 'none', outline: 'none',
              background: '#fff', color: '#2A2A2A',
              lineHeight: 1.5,
              transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.target.style.borderColor = '#2D4A2B')}
            onBlur={e => (e.target.style.borderColor = '#E8E4DC')}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || streaming}
            style={{
              width: 38, height: 38, borderRadius: 10,
              background: input.trim() && !streaming ? '#2D4A2B' : '#E8E4DC',
              border: 'none', cursor: input.trim() && !streaming ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s', flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !streaming ? '#D4A94A' : '#9B9B9B'} strokeWidth="2.5" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div style={{ fontSize: 10, color: '#C0BAB0', textAlign: 'center', marginTop: 6, fontFamily: 'DM Sans, sans-serif' }}>
          Enter to send · Shift+Enter for new line
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
      `}</style>
    </div>
  );
}

function MessageText({ content }: { content: string }) {
  // Very basic markdown: bold, line breaks
  const parts = content.split(/\*\*(.*?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <strong key={i}>{part}</strong>
          : <span key={i}>{part.split('\n').map((line, j) => j === 0 ? line : [<br key={j} />, line])}</span>
      )}
    </>
  );
}

function buildResumeMessage(state: NonNullable<SetupBuddyProps['initialState']>): string {
  const done: string[] = [];
  if (state.ai_provider_choice) done.push(`AI Provider: ${state.ai_provider_choice}`);
  if (state.code_hosting_choice) done.push(`Code Hosting: ${state.code_hosting_choice}`);
  if (state.deploy_choice) done.push(`Deploy: ${state.deploy_choice}`);

  if (done.length === 0) {
    return "Welcome back! We didn't get very far last time. Let's start fresh — **what are you trying to build?**";
  }
  return `Welcome back! Last time we got:\n${done.map(d => `✓ ${d}`).join('\n')}\n\nWant to continue from here or start over?`;
}
