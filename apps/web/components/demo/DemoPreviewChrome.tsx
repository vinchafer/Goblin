'use client';

// DEMO-ONLY preview chrome — the device-frame content for `/demo-preview`, which the
// Goblin pitch embeds as an iframe (docs/DEMO_MODE_ARCHITECTURE.md, Sprint 10 §B.5).
//
// The PRODUCT preview was removed entirely in the tester-feedback wave: the button did
// not work, and a founder decision retired the feature rather than repairing it. This
// file is what is left of `components/preview/preview-tab.tsx`, and it lives under
// `components/demo/` precisely so the boundary is legible: NO app route reaches it, it
// mounts only from `app/demo-preview/page.tsx`, and it is not a surface any user can
// navigate to. Everything that made the old component a product surface — the empty
// state with its GitHub/Vercel connect CTAs, the connector-status fetch, the
// deployment-protection escape hatch — is gone; a demo always renders a fixed page.
//
// FOUNDER ACTION (carried, not decided here): the pitch still SHOWS a preview device
// frame for a feature the product no longer has. Whether §04 of the pitch keeps that
// frame is a pitch decision, and deleting this route would break the live embed, so it
// is reported rather than acted on.

import { useState } from 'react';
import { Smartphone, Tablet, Monitor, RotateCw, ExternalLink } from 'lucide-react';
import { GoblinLogo } from '@/components/brand/GoblinLogo';

type Viewport = '375' | '768' | '1440';

interface DemoPreviewChromeProps {
  /** The framed page (a `data:` URI in the demo seed). */
  previewUrl: string;
  /** Pretty URL shown in the toolbar instead of the long `data:` URI. */
  displayUrl?: string;
}

export function DemoPreviewChrome({ previewUrl, displayUrl }: DemoPreviewChromeProps) {
  const [viewport, setViewport] = useState<Viewport>('1440');
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);

  const vpIcons: Record<Viewport, React.ReactNode> = {
    '375': <Smartphone size={14} />,
    '768': <Tablet size={14} />,
    '1440': <Monitor size={14} />,
  };
  const widths: Record<Viewport, string> = { '375': '375px', '768': '768px', '1440': '100%' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        height: 44, background: 'var(--surface-3)',
        borderBottom: '1px solid var(--rule)',
        display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 6, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', background: 'var(--surface-1)', border: '1px solid var(--rule)', borderRadius: 7, padding: 2, gap: 1 }}>
          {(['375', '768', '1440'] as Viewport[]).map(v => (
            <button
              key={v}
              onClick={() => setViewport(v)}
              title={v === '375' ? 'Mobil (375px)' : v === '768' ? 'Tablet (768px)' : 'Desktop'}
              style={{
                padding: '4px 10px', borderRadius: 5,
                border: 'none', cursor: 'pointer',
                background: viewport === v ? 'var(--accent-primary-soft)' : 'transparent',
                color: viewport === v ? 'var(--brand-fg)' : 'var(--ink-3)',
                outline: viewport === v ? '1.5px solid var(--accent-primary-rule)' : 'none',
                transition: 'all 0.15s', minWidth: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {vpIcons[v]}
            </button>
          ))}
        </div>

        <div style={{
          flex: 1, marginLeft: 8, marginRight: 4,
          display: 'flex', alignItems: 'center',
          background: 'var(--surface-1)', border: '1px solid var(--rule)',
          borderRadius: 7, padding: '0 10px', height: 30, overflow: 'hidden',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono), JetBrains Mono, monospace', fontSize: 11,
            color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {displayUrl ?? previewUrl}
          </span>
        </div>

        <button
          onClick={() => { setLoading(true); setReloadKey(k => k + 1); }}
          style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', padding: '4px 6px', lineHeight: 1, display: 'flex', alignItems: 'center' }}
          title="Neu laden"
        ><RotateCw size={14} /></button>
        <a
          href={previewUrl} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--ink-3)', fontSize: 13, textDecoration: 'none', padding: '4px 6px', lineHeight: 1, display: 'flex', alignItems: 'center' }}
          title="In neuem Tab öffnen"
        ><ExternalLink size={14} /></a>
      </div>

      {/* Framed page */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        background: viewport === '1440' ? 'var(--surface-1)' : 'var(--surface-3)',
        overflow: 'auto',
        padding: viewport === '1440' ? 0 : 20,
      }}>
        <div style={{
          width: widths[viewport],
          height: '100%',
          background: 'var(--surface-0)',
          boxShadow: viewport !== '1440' ? '0 8px 32px rgba(15,43,30,0.25)' : 'none',
          transition: 'width 0.25s ease',
          flexShrink: 0,
          position: 'relative',
        }}>
          {loading && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: 'var(--surface-0)', fontSize: 'var(--t-small-fs)', color: 'var(--ink-3)',
              gap: 12,
            }}>
              {/* Mark is the only loader (§A8 / §B1.6) — no spinner. */}
              <GoblinLogo state="breath" size={64} variant="green" />
              Vorschau lädt…
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
            title="Demo-Vorschau"
          />
        </div>
      </div>
    </div>
  );
}
