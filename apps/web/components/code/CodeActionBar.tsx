'use client';

import { Icon } from '@/components/ui/icon';
import { GoblinMark } from '@/components/ui/goblin-mark';

interface CodeActionBarProps {
  deploying: boolean;
  onDeploy: () => void;
  onPush: () => void;
}

export function CodeActionBar({ deploying, onDeploy, onPush }: CodeActionBarProps) {
  return (
    <div style={{
      display: 'flex', gap: 6, alignItems: 'center',
      padding: '6px 12px', borderBottom: '1px solid var(--rule-strong)',
      background: 'var(--green-950)', flexShrink: 0, justifyContent: 'flex-end',
    }}>
      <button
        onClick={onPush}
        style={{
          background: 'transparent', color: 'var(--ink-on-dark-2)',
          border: '1px solid rgba(138,170,133,0.25)',
          borderRadius: 6, padding: '5px 12px',
          fontSize: 12, fontWeight: 500,
          cursor: 'pointer', fontFamily: 'var(--font-sans)',
          display: 'flex', alignItems: 'center', gap: 6,
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(138,170,133,0.5)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(138,170,133,0.25)')}
      >
        <Icon name="github" size={13} /> Push GitHub
      </button>
      <button
        onClick={onDeploy}
        disabled={deploying}
        style={{
          background: deploying ? 'rgba(45,74,43,0.5)' : 'var(--brand-green)',
          color: 'var(--brand-gold)', border: 'none',
          borderRadius: 6, padding: '5px 14px',
          fontSize: 12, fontWeight: 600,
          cursor: deploying ? 'not-allowed' : 'pointer',
          fontFamily: 'var(--font-sans)',
          display: 'flex', alignItems: 'center', gap: 6,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { if (!deploying) (e.currentTarget as HTMLElement).style.background = 'var(--green-600)'; }}
        onMouseLeave={e => { if (!deploying) (e.currentTarget as HTMLElement).style.background = 'var(--brand-green)'; }}
      >
        {deploying
          ? <><GoblinMark size={14} /> Deploying…</>
          : <><Icon name="play" size={13} /> Build</>}
      </button>
    </div>
  );
}
