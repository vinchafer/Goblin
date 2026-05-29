'use client';
import { useState } from 'react';
import { DeviceMobile, Laptop, Monitor, ArrowClockwise, ArrowSquareOut, Globe, GithubLogo, RocketLaunch } from '@phosphor-icons/react';
import Link from 'next/link';

type Viewport = '375' | '768' | '1440';

interface PreviewTabProps {
  projectId: string;
  previewUrl?: string | null;
}

export function PreviewTab({ projectId, previewUrl }: PreviewTabProps) {
  const [viewport, setViewport] = useState<Viewport>('1440');
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);

  const vpIcons: Record<Viewport, React.ReactNode> = {
    '375': <DeviceMobile size={14} weight="bold" />,
    '768': <Laptop size={14} weight="bold" />,
    '1440': <Monitor size={14} weight="bold" />,
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
        justifyContent: 'center', height: '100%', gap: 0, padding: '48px 24px',
        textAlign: 'center', background: 'var(--paper)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'rgba(45,74,43,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
        }}>
          <Globe size={32} weight="duotone" color="var(--brand-green)" />
        </div>
        <h3 style={{
          fontFamily: 'var(--font-sans)', fontSize: 24, color: 'var(--brand-green)',
          fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 8,
        }}>Nothing to preview yet</h3>
        <p style={{
          fontSize: 14, color: 'var(--meta)', maxWidth: 400,
          lineHeight: 1.65, marginBottom: 28,
        }}>
          Push your project to GitHub, then connect Vercel to deploy.
          Live previews appear here automatically.
        </p>

        {/* 3-step guide cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10, width: '100%', maxWidth: 480, marginBottom: 24,
        }}>
          {[
            { icon: GithubLogo, step: '1', label: 'Push to GitHub', desc: 'Connect from Code tab' },
            { icon: RocketLaunch, step: '2', label: 'Add Vercel token', desc: 'Settings → API Keys' },
            { icon: Globe, step: '3', label: 'Auto-deploy', desc: 'Preview shows here' },
          ].map(s => (
            <div key={s.step} style={{
              background: 'var(--panel)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '14px 12px', textAlign: 'left',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--gold-700)',
                  background: 'rgba(212,169,74,0.15)', padding: '1px 6px', borderRadius: 4,
                  letterSpacing: '0.04em',
                }}>STEP {s.step}</span>
                <s.icon size={14} weight="regular" color="var(--meta)" />
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--meta)', lineHeight: 1.4 }}>
                {s.desc}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            href="/dashboard/settings/keys"
            style={{
              background: 'var(--brand-green)', color: '#fff', padding: '10px 20px',
              borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              boxShadow: '0 1px 2px rgba(45,74,43,0.18)',
            }}
          >
            Add Vercel Token →
          </Link>
          <Link
            href="/dashboard/settings/integrations"
            style={{
              background: 'transparent', color: 'var(--brand-green)', padding: '10px 20px',
              borderRadius: 9, fontSize: 13, fontWeight: 500, textDecoration: 'none',
              border: '1.5px solid var(--border)',
            }}
          >
            Connect GitHub
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        height: 44, background: 'var(--surface-3)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 6, flexShrink: 0,
      }}>
        {/* Viewport switcher */}
        <div style={{ display: 'flex', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 7, padding: 2, gap: 1 }}>
          {(['375', '768', '1440'] as Viewport[]).map(v => (
            <button
              key={v}
              onClick={() => setViewport(v)}
              title={v === '375' ? 'Mobile (375px)' : v === '768' ? 'Tablet (768px)' : 'Desktop'}
              style={{
                padding: '4px 10px', borderRadius: 5,
                border: 'none', cursor: 'pointer',
                background: viewport === v ? 'rgba(212,169,74,0.18)' : 'transparent',
                color: viewport === v ? 'var(--gold-700)' : 'var(--meta)',
                outline: viewport === v ? '1.5px solid rgba(212,169,74,0.4)' : 'none',
                transition: 'all 0.15s', minWidth: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {vpIcons[v]}
            </button>
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
          style={{ background: 'none', border: 'none', color: 'var(--meta)', cursor: 'pointer', padding: '4px 6px', lineHeight: 1, display: 'flex', alignItems: 'center' }}
          title="Reload"
        ><ArrowClockwise size={14} weight="bold" /></button>
        <a
          href={previewUrl} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--meta)', fontSize: 13, textDecoration: 'none', padding: '4px 6px', lineHeight: 1, display: 'flex', alignItems: 'center' }}
          title="Open in new tab"
        ><ArrowSquareOut size={14} weight="bold" /></a>
      </div>

      {/* Iframe area */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'flex-start',
        justifyContent: 'center',
        background: viewport === '1440' ? '#fff' : 'var(--meta)',
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