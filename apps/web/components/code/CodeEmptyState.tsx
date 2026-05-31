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
      height: '100%', textAlign: 'center', padding: 32, background: 'var(--ed-canvas)',
    }}>
      <div style={{ marginBottom: 22 }}>
        <GoblinLogo state="idle" size={52} variant="gold" />
      </div>
      {hasFiles ? (
        <>
          <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: 22, color: 'var(--ed-fg-1)', fontWeight: 600, marginBottom: 10, letterSpacing: '-0.3px' }}>
            Wähle eine Datei
          </h3>
          <p style={{ fontSize: 'var(--t-small-fs)', color: 'var(--ed-fg-3)', fontFamily: 'var(--font-sans)', maxWidth: 320, lineHeight: 1.6 }}>
            Öffne eine Datei aus dem Projekt, um sie zu bearbeiten.
          </p>
        </>
      ) : (
        <>
          <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: 23, color: 'var(--ed-fg-1)', fontWeight: 600, marginBottom: 10, letterSpacing: '-0.3px' }}>
            Noch nichts hier.
          </h3>
          <p style={{ fontSize: 'var(--t-small-fs)', color: 'var(--ed-fg-3)', fontFamily: 'var(--font-sans)', maxWidth: 360, lineHeight: 1.6, marginBottom: 22 }}>
            Sag Goblin im Chat, was du bauen willst. Mit „An Code senden" landet der generierte Code direkt hier — als Entwurf, den du in Ruhe ansehen kannst.
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('goblin:switchTab', { detail: 'chat' }))}
            style={{
              background: 'var(--ed-primary)', color: 'var(--ed-on-primary)',
              border: 'none',
              borderRadius: 11, padding: '10px 20px', fontSize: 'var(--t-small-fs)', fontWeight: 600,
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
