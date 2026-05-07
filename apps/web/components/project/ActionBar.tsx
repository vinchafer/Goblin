'use client';

interface ActionBarProps {
  deploying: boolean;
  onDeploy: () => void;
  onPush: () => void;
}

export function ActionBar({ deploying, onDeploy, onPush }: ActionBarProps) {
  return (
    <div style={{
      display: 'flex', gap: 6, alignItems: 'center',
      padding: '6px 12px', borderBottom: '1px solid #1e2a1c',
      background: '#0f1410', flexShrink: 0, justifyContent: 'flex-end',
    }}>
      <button
        onClick={onPush}
        style={{
          background: 'transparent', color: '#8aaa85',
          border: '1px solid rgba(138,170,133,0.25)',
          borderRadius: 6, padding: '5px 12px',
          fontSize: 12, fontWeight: 500,
          cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
          display: 'flex', alignItems: 'center', gap: 5,
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(138,170,133,0.5)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(138,170,133,0.25)')}
      >
        ⬆ Push GitHub
      </button>
      <button
        onClick={onDeploy}
        disabled={deploying}
        style={{
          background: deploying ? 'rgba(45,74,43,0.5)' : 'var(--moss)',
          color: 'var(--ochre)', border: 'none',
          borderRadius: 6, padding: '5px 14px',
          fontSize: 12, fontWeight: 600,
          cursor: deploying ? 'not-allowed' : 'pointer',
          fontFamily: 'DM Sans, sans-serif',
          display: 'flex', alignItems: 'center', gap: 5,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { if (!deploying) (e.currentTarget as HTMLElement).style.background = 'var(--moss-2)'; }}
        onMouseLeave={e => { if (!deploying) (e.currentTarget as HTMLElement).style.background = 'var(--moss)'; }}
      >
        {deploying ? '▶ Deploying…' : '▶ Build'}
      </button>
    </div>
  );
}
