'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { getAuthHeaders, API_URL } from '@/lib/api';
import { useLang, t } from '@/lib/use-lang';

interface SupportMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

interface SupportChatProps {
  onClose: () => void;
}

export function SupportChat({ onClose }: SupportChatProps) {
  const lang = useLang();
  const [messages, setMessages] = useState<SupportMessage[]>([{
    id: 'welcome',
    role: 'assistant',
    content: t(lang,
      'Hi! Ich bin Goblin Hilfe 👋\n\nWomit kann ich helfen?',
      "Hi! I'm Goblin Hilfe 👋\n\nWhat can I help you with?"),
  }]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [rateLimited, setRateLimited] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;
    const userMsg: SupportMessage = { id: makeId(), role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setStreaming(true);
    setStreamingText('');
    setRateLimited(null);

    const history = messages.map(m => ({ role: m.role, content: m.content }));

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/support/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: text.trim(), history }),
      });

      if (res.status === 429) {
        const data = await res.json() as { message: string };
        setRateLimited(data.message);
        setStreaming(false);
        return;
      }

      if (!res.ok) throw new Error(`Error ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as { type: string; content?: string };
            if (evt.type === 'delta' && evt.content) {
              fullText += evt.content;
              setStreamingText(fullText);
            } else if (evt.type === 'message' && evt.content) {
              fullText = evt.content;
              setStreamingText(fullText);
            } else if (evt.type === 'done') {
              break;
            }
          } catch { /* skip */ }
        }
      }

      setMessages(prev => [...prev, { id: makeId(), role: 'assistant', content: fullText }]);
    } catch {
      setMessages(prev => [...prev, { id: makeId(), role: 'assistant', content: t(lang,
        'Keine Verbindung. Prüfe dein Internet und versuch es nochmal.',
        "Couldn't connect. Check your internet and try again.") }]);
    } finally {
      setStreaming(false);
      setStreamingText('');
    }
  }, [messages, streaming, lang]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        background: 'var(--brand-green)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(212,169,74,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 'var(--t-caption-fs)', fontWeight: 700, color: 'var(--brand-gold)', fontFamily: 'var(--font-sans)' }}>G</span>
          </div>
          <span style={{ color: '#fff', fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 600 }}>{t(lang, 'Goblin Hilfe', 'Goblin Hilfe')}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
            background: 'rgba(212,169,74,0.2)', color: 'var(--brand-gold)',
            fontFamily: 'var(--font-sans)', letterSpacing: '0.5px', textTransform: 'uppercase',
          }}>Beta</span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 6px' }}
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%',
              padding: '8px 12px',
              borderRadius: msg.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
              background: msg.role === 'user' ? 'var(--brand-green)' : 'var(--panel, #fff)',
              border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
              color: msg.role === 'user' ? 'rgba(255,255,255,0.92)' : 'var(--text)',
              fontSize: 'var(--t-caption-fs)', lineHeight: 1.6,
              fontFamily: 'var(--font-sans)',
              whiteSpace: 'pre-wrap',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {streaming && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              maxWidth: '85%', padding: '8px 12px',
              borderRadius: '12px 12px 12px 3px',
              background: 'var(--panel, #fff)', border: '1px solid var(--border)',
              fontSize: 'var(--t-caption-fs)', lineHeight: 1.6, color: 'var(--text)',
              fontFamily: 'var(--font-sans)', whiteSpace: 'pre-wrap',
            }}>
              {streamingText || (
                <div style={{ display: 'flex', gap: 3, alignItems: 'center', height: 16 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--brand-green)', animation: 'bounce 1.2s ease-in-out infinite', animationDelay: `${i * 0.16}s` }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {rateLimited && (
          <div style={{ fontSize: 11, color: 'var(--danger)', textAlign: 'center', padding: '4px 0', fontFamily: 'var(--font-sans)' }}>
            {rateLimited}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface-1, #FAFAF8)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={t(lang, 'Frag mich alles …', 'Ask anything…')}
            disabled={streaming}
            style={{
              flex: 1, padding: '7px 10px',
              border: '1.5px solid var(--border)', borderRadius: 8,
              fontSize: 'var(--t-caption-fs)', fontFamily: 'var(--font-sans)',
              outline: 'none', background: 'var(--panel, #fff)', color: 'var(--text)',
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || streaming}
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: input.trim() && !streaming ? 'var(--brand-green)' : 'var(--div)',
              cursor: input.trim() && !streaming ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !streaming ? 'var(--brand-gold)' : 'var(--disabled)'} strokeWidth="2.5" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
      <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }`}</style>
    </div>
  );
}
