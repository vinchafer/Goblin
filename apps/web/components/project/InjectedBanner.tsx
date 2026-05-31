'use client';

interface InjectedBannerProps {
  pendingCode: { content: string; filename?: string };
  deploying: boolean;
  undoPayload: { filePath: string; previousContent: string } | null;
  onDeploy: () => void;
  onApply: () => void;
  onPush: () => void;
  onUndo: () => void;
  onDismiss: () => void;
}

export function InjectedBanner({
  pendingCode,
  deploying,
  undoPayload,
  onDeploy,
  onApply,
  onPush,
  onUndo,
  onDismiss,
}: InjectedBannerProps) {
  return (
    <div style={{
      background: 'rgba(212,169,74,0.1)',
      borderBottom: '2px solid rgba(212,169,74,0.4)',
      borderTop: '1px solid rgba(212,169,74,0.2)',
      padding: '9px 14px',
      display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
    }}>
      <span style={{ color: 'var(--brand-gold)', fontSize: 13, flexShrink: 0 }}>✦</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 'var(--t-caption-fs)', fontWeight: 600, color: 'var(--brand-gold)',
          fontFamily: 'var(--font-sans)',
        }}>
          Injected via Send to Code
        </span>
        {pendingCode.filename && (
          <span style={{
            marginLeft: 8, fontSize: 11, color: 'var(--brand-gold)',
            fontFamily: 'JetBrains Mono, monospace',
            background: 'rgba(212,169,74,0.12)',
            padding: '1px 8px', borderRadius: 4,
          }}>
            {pendingCode.filename}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center' }}>
        <button
          onClick={onApply}
          style={{
            background: 'rgba(212,169,74,0.15)', color: 'var(--brand-gold)',
            border: '1px solid rgba(212,169,74,0.4)',
            borderRadius: 6, padding: '5px 12px', fontSize: 'var(--t-caption-fs)', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          ⟳ Review & Apply
        </button>
        <button
          onClick={onDeploy}
          disabled={deploying}
          style={{
            background: deploying ? 'rgba(45,74,43,0.5)' : 'var(--brand-green)',
            color: 'var(--brand-gold)', border: 'none',
            borderRadius: 6, padding: '5px 12px', fontSize: 'var(--t-caption-fs)', fontWeight: 600,
            cursor: deploying ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {deploying ? '▶ Deploying…' : '▶ Build'}
        </button>
        <button
          onClick={onPush}
          style={{
            background: 'transparent', color: 'var(--ink-on-dark-2)',
            border: '1px solid rgba(138,170,133,0.3)',
            borderRadius: 6, padding: '5px 12px', fontSize: 'var(--t-caption-fs)', fontWeight: 500,
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          → Push GitHub
        </button>
        {undoPayload && (
          <button
            onClick={onUndo}
            title="Undo last injection"
            style={{
              background: 'transparent', color: 'var(--ink-on-dark-3)',
              border: '1px solid rgba(107,138,107,0.3)',
              borderRadius: 6, padding: '5px 10px', fontSize: 'var(--t-caption-fs)',
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            ↩ Undo
          </button>
        )}
        <button
          onClick={onDismiss}
          style={{
            background: 'none', border: 'none', color: 'var(--ink-on-dark-3)',
            cursor: 'pointer', fontSize: 'var(--t-body-fs)', padding: '4px 6px', lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
