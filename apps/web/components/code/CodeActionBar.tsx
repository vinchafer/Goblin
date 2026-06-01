'use client';

import { Icon } from '@/components/ui/icon';
import { GoblinLogo } from '@/components/brand/GoblinLogo';

interface CodeActionBarProps {
  deploying: boolean;
  onDeploy: () => void;
  onPush: () => void;
  editorTheme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export function CodeActionBar({ deploying, onDeploy, onPush, editorTheme = 'light', onToggleTheme }: CodeActionBarProps) {
  return (
    <div style={{
      display: 'flex', gap: 6, alignItems: 'center',
      padding: '7px 14px', borderBottom: '1px solid var(--ed-rule)',
      background: 'var(--ed-chrome)', flexShrink: 0, justifyContent: 'flex-end',
    }}>
      {onToggleTheme && (
        <button
          onClick={onToggleTheme}
          title={editorTheme === 'light' ? 'Dunkler Editor' : 'Heller Editor'}
          aria-label="Editor-Theme umschalten"
          style={{
            marginRight: 'auto', background: 'transparent', color: 'var(--ed-fg-3)',
            border: '1px solid var(--ed-rule)', borderRadius: 8, padding: '6px 11px',
            fontSize: 'var(--t-caption-fs)', fontWeight: 500, cursor: 'pointer',
            fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 6,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--ed-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {editorTheme === 'light'
            ? <><Icon name="moon" size={13} /> Dunkel</>
            : <><Icon name="sun" size={13} /> Hell</>}
        </button>
      )}
      <button
        onClick={onPush}
        style={{
          background: 'transparent', color: 'var(--ed-fg-2)',
          border: '1px solid var(--ed-rule)',
          borderRadius: 8, padding: '6px 13px',
          fontSize: 'var(--t-caption-fs)', fontWeight: 500,
          cursor: 'pointer', fontFamily: 'var(--font-sans)',
          display: 'flex', alignItems: 'center', gap: 6,
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--ed-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <Icon name="github" size={13} /> Push GitHub
      </button>
      <button
        onClick={onDeploy}
        disabled={deploying}
        style={{
          background: deploying ? 'var(--ed-hover)' : 'var(--ed-primary)',
          color: deploying ? 'var(--ed-fg-3)' : 'var(--ed-on-primary)', border: 'none',
          borderRadius: 8, padding: '6px 15px',
          fontSize: 'var(--t-caption-fs)', fontWeight: 600,
          cursor: deploying ? 'not-allowed' : 'pointer',
          fontFamily: 'var(--font-sans)',
          display: 'flex', alignItems: 'center', gap: 6,
          transition: 'background 0.15s, opacity 0.15s',
        }}
        onMouseEnter={e => { if (!deploying) (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
        onMouseLeave={e => { if (!deploying) (e.currentTarget as HTMLElement).style.opacity = '1'; }}
      >
        {deploying
          ? <><GoblinLogo state="working" size={14} variant="gold" /> Wird gebaut…</>
          : <><Icon name="play" size={13} /> Build</>}
      </button>
    </div>
  );
}
