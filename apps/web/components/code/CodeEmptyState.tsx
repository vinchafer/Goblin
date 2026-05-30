'use client';

import { Icon } from '@/components/ui/icon';
import { GoblinLogo } from '@/components/brand/GoblinLogo';

interface CodeEmptyStateProps {
  hasFiles: boolean;
}

export function CodeEmptyState({ hasFiles }: CodeEmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', textAlign: 'center', padding: 32, background: 'var(--surface-ink-2)',
    }}>
      <div style={{ marginBottom: 20 }}>
        <GoblinLogo state="idle" size={56} variant="gold" />
      </div>
      {hasFiles ? (
        <>
          <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: 22, color: 'var(--ink-on-dark-1)', fontWeight: 600, marginBottom: 8, letterSpacing: '-0.3px' }}>
            Wähle eine Datei
          </h3>
          <p style={{ fontSize: 14, color: 'var(--ink-on-dark-2)', fontFamily: 'var(--font-sans)', maxWidth: 320, lineHeight: 1.55 }}>
            Tipp links auf eine Datei aus dem Baum, um sie zu bearbeiten.
          </p>
        </>
      ) : (
        <>
          <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: 24, color: 'var(--ink-on-dark-1)', fontWeight: 600, marginBottom: 8, letterSpacing: '-0.3px' }}>
            Noch kein Code
          </h3>
          <p style={{ fontSize: 14, color: 'var(--ink-on-dark-2)', fontFamily: 'var(--font-sans)', maxWidth: 340, lineHeight: 1.6, marginBottom: 22 }}>
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
