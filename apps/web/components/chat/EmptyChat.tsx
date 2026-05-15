'use client';

import { getGreeting } from '@/lib/greeting';

interface EmptyChatProps {
  userName: string;
  onSuggestionClick: (prompt: string) => void;
}

const Sparkle32 = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="var(--ochre)" stroke="none">
    <path d="M12 2 13.5 8.5 20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5z" />
  </svg>
);

const Code20 = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;
const Bug20 = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="8" y="6" width="8" height="14" rx="4"/><path d="M12 6V3M9 3l3 3 3-3M4 11h4M16 11h4M4 19h3M17 19h3M4 15h3M17 15h3"/></svg>;
const Cloud20 = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 10a6 6 0 0 0-11.7-1A4 4 0 0 0 6 17h12a4 4 0 0 0 0-7z"/></svg>;

export function EmptyChat({ userName, onSuggestionClick }: EmptyChatProps) {
  const greeting = getGreeting(userName || 'Vincent');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'calc(100dvh - 56px - 100px)',
        padding: '24px 16px 0',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: 'min(120px, 15vh)',
        marginBottom: 'auto',
        gap: 12,
      }}>
        <Sparkle32 />
        <h1 style={{
          fontFamily: 'var(--font-brand)',
          fontSize: 'clamp(24px, 5vw, 32px)',
          fontWeight: 400,
          color: 'var(--text)',
          textAlign: 'center',
          margin: 0,
        }}>{greeting}</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 8 }}>
        <SuggestionRow icon={<Code20 />} label="App bauen" onClick={() => onSuggestionClick('Ich will eine App bauen die...')} testId="suggestion-build" />
        <SuggestionRow icon={<Bug20 />} label="Code debuggen" onClick={() => onSuggestionClick('Mein Code wirft folgenden Fehler:')} testId="suggestion-debug" />
        <SuggestionRow icon={<Cloud20 />} label="Deployen" onClick={() => onSuggestionClick('Wie deploye ich mein Projekt auf...')} testId="suggestion-deploy" />
      </div>
    </div>
  );
}

function SuggestionRow({ icon, label, onClick, testId }: { icon: React.ReactNode; label: string; onClick: () => void; testId: string }) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '14px 8px',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        color: 'var(--text)',
        fontSize: 16,
        fontFamily: 'var(--font-ui)',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <span style={{ color: 'var(--meta)', display: 'flex' }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
