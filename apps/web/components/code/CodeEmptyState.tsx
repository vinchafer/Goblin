'use client';

import { Icon } from '@/components/ui/icon';
import { GoblinMark } from '@/components/ui/goblin-mark';

interface CodeEmptyStateProps {
  hasFiles: boolean;
}

export function CodeEmptyState({ hasFiles }: CodeEmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', textAlign: 'center', padding: 32, background: '#141a12',
    }}>
      <div style={{ marginBottom: 20 }}>
        <GoblinMark size={56} />
      </div>
      {hasFiles ? (
        <>
          <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: 22, color: '#e8eee5', fontWeight: 600, marginBottom: 8, letterSpacing: '-0.3px' }}>
            Wähle eine Datei
          </h3>
          <p style={{ fontSize: 14, color: '#8aaa85', fontFamily: 'var(--font-sans)', maxWidth: 320, lineHeight: 1.55 }}>
            Tipp links auf eine Datei aus dem Baum, um sie zu bearbeiten.
          </p>
        </>
      ) : (
        <>
          <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: 24, color: '#e8eee5', fontWeight: 600, marginBottom: 8, letterSpacing: '-0.3px' }}>
            Noch kein Code
          </h3>
          <p style={{ fontSize: 14, color: '#8aaa85', fontFamily: 'var(--font-sans)', maxWidth: 340, lineHeight: 1.6, marginBottom: 22 }}>
            Geh in den Chat und sag Goblin was du bauen willst. Mit „An Code senden" landet generierter Code direkt hier.
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('goblin:switchTab', { detail: 'chat' }))}
            style={{
              background: 'var(--brand-green)', color: 'var(--brand-gold)',
              border: 'none',
              borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}
          >
            <Icon name="chat" size={16} /> Chat öffnen
          </button>
        </>
      )}
    </div>
  );
}
