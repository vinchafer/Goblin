import { GoblinLogo } from '@/components/brand/GoblinLogo';

export default function Loading() {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      background: 'var(--surface-page)',
    }}>
      <GoblinLogo state="breath" size={64} variant="green" />
      <p style={{
        fontFamily: 'var(--font-mono), JetBrains Mono, ui-monospace, monospace',
        fontSize: 12.5,
        textTransform: 'uppercase',
        letterSpacing: '0.18em',
        color: 'var(--ink-muted)',
        margin: 0,
      }}>
        Workspace wird geladen
      </p>
    </div>
  );
}
