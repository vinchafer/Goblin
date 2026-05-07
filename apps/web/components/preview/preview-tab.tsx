'use client';
import { useState } from 'react';

type Viewport = '375' | '768' | '1440';

interface PreviewTabProps {
  projectId: string;
  previewUrl?: string | null;
}

export function PreviewTab({ projectId, previewUrl }: PreviewTabProps) {
  const [viewport, setViewport] = useState<Viewport>('1440');
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);

  const vpLabels: Record<Viewport, string> = {
    '375': '📱',
    '768': '💻',
    '1440': '🖥',
  };

  const widths: Record<Viewport, string> = {
    '375': '375px',
    '768': '768px',
    '1440': '100%',
  };

  if (!previewUrl) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', gap: 20, padding: 48,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 56 }}>🌐</div>
        <h3 style={{
          fontFamily: 'Fraunces, serif', fontSize: 26, color: 'var(--moss)',
          fontWeight: 700, letterSpacing: '-0.5px',
        }}>No preview yet</h3>
        <p style={{
          fontSize: 14, color: 'var(--meta)', maxWidth: 360,
          lineHeight: 1.65, fontWeight: 300,
        }}>
          Deploy your project to Vercel to see a live preview here.
          Add your Vercel token in Settings → API Keys.
        </p>
        <a
          href="/dashboard/settings/keys"
          style={{
            background: 'var(--moss)', color: '#fff', padding: '10px 20px',
            borderRadius: 9, fontSize: 13, fontWeight: 500, textDecoration: 'none',
          }}
        >
          Add Vercel Token →
        </a>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        height: 44, background: 'var(--cream2)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 6, flexShrink: 0,
      }}>
        {/* Viewport switcher */}
        <div style={{ display: 'flex', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 7, padding: 2, gap: 1 }}>
          {(['375', '768', '1440'] as Viewport[]).map(v => (
            <button key={v} onClick={() => setViewport(v)} style={{
              padding: '3px 10px', borderRadius: 5, fontSize: 11,
              border: 'none', cursor: 'pointer',
              background: viewport === v ? 'rgba(212,169,74,0.18)' : 'transparent',
              color: viewport === v ? 'var(--ochre-dark, #C9933A)' : 'var(--meta)',
              outline: viewport === v ? '1.5px solid rgba(212,169,74,0.4)' : 'none',
              fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
              transition: 'all 0.15s', minWidth: 36,
            }}>{vpLabels[v]}</button>
          ))}
        </div>

        {/* URL bar */}
        <div style={{
          flex: 1, marginLeft: 8, marginRight: 4,
          display: 'flex', alignItems: 'center',
          background: 'var(--panel)', border: '1px solid var(--border)',
          borderRadius: 7, padding: '0 10px', height: 30, overflow: 'hidden',
        }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
            color: 'var(--meta)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {previewUrl}
          </span>
        </div>

        <button
          onClick={() => { setLoading(true); setReloadKey(k => k + 1); }}
          style={{ background: 'none', border: 'none', color: 'var(--meta)', cursor: 'pointer', fontSize: 15, padding: '4px 6px', lineHeight: 1 }}
          title="Reload"
        >↺</button>
        <a
          href={previewUrl} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--meta)', fontSize: 13, textDecoration: 'none', padding: '4px 6px', lineHeight: 1, display: 'flex', alignItems: 'center' }}
          title="Open in new tab"
        >↗</a>
      </div>

      {/* Iframe area */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'flex-start',
        justifyContent: 'center',
        background: viewport === '1440' ? '#fff' : '#6b6b6b',
        overflow: 'auto',
        padding: viewport === '1440' ? 0 : 20,
      }}>
        <div style={{
          width: widths[viewport],
          height: '100%',
          background: '#fff',
          boxShadow: viewport !== '1440' ? '0 8px 32px rgba(0,0,0,0.25)' : 'none',
          transition: 'width 0.25s ease',
          flexShrink: 0,
          position: 'relative',
        }}>
          {loading && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#fff', fontSize: 13, color: 'var(--meta)',
              gap: 8,
            }}>
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
              Loading preview…
            </div>
          )}
          <iframe
            key={reloadKey}
            src={previewUrl}
            style={{
              width: '100%', height: '100%', border: 'none',
              opacity: loading ? 0 : 1, transition: 'opacity 0.2s',
            }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            onLoad={() => setLoading(false)}
            title="Project Preview"
          />
        </div>
      </div>
    </div>
  );
}