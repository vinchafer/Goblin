'use client';
import { useEffect, useState } from 'react';
import { Smartphone, Tablet, Monitor, RotateCw, ExternalLink, Globe, Github, Rocket } from 'lucide-react';
import { GoblinLogo } from '@/components/brand/GoblinLogo';
import { createClient } from '@/lib/supabase/client';
import { useDemoMode } from '@/lib/demo/demo-mode-context';
import Link from 'next/link';

type Viewport = '375' | '768' | '1440';

interface PreviewTabProps {
  projectId: string;
  previewUrl?: string | null;
  /** Demo (Sprint 10): pretty URL shown in the toolbar bar instead of the long
      `data:` URI that actually feeds the iframe. Defaults to `previewUrl`. */
  displayUrl?: string;
}

export function PreviewTab({ projectId, previewUrl, displayUrl }: PreviewTabProps) {
  const demoMode = useDemoMode();
  const [viewport, setViewport] = useState<Viewport>('1440');
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  // FIX3-5 (V2-P2-2): the empty-state CTA must reflect the real next step, not
  // always "Vercel-Token hinzufügen" even when Vercel is already connected.
  const [conn, setConn] = useState<{ github: boolean; vercel: boolean } | null>(null);

  useEffect(() => {
    if (previewUrl) return; // only needed for the empty state
    if (demoMode) return; // Sprint 10 §7: no connector status fetch in demo.
    let alive = true;
    (async () => {
      try {
        const { data: { session } } = await createClient().auth.getSession();
        if (!session) return;
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
        const headers = { Authorization: `Bearer ${session.access_token}` };
        const [gh, vc] = await Promise.all([
          fetch(`${apiBase}/api/github/status`, { headers, signal: AbortSignal.timeout(8000) }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${apiBase}/api/integrations/vercel`, { headers, signal: AbortSignal.timeout(8000) }).then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        if (alive) setConn({ github: !!gh?.connected, vercel: !!vc?.connected });
      } catch { /* leave conn null → default add-token CTA */ }
    })();
    return () => { alive = false; };
  }, [previewUrl, demoMode]);

  const vpIcons: Record<Viewport, React.ReactNode> = {
    '375': <Smartphone size={14} />,
    '768': <Tablet size={14} />,
    '1440': <Monitor size={14} />,
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
        textAlign: 'center', background: 'var(--surface-2)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'rgba(26,58,42,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
        }}>
          <Globe size={32} color="var(--brand-green)" />
        </div>
        <h3 style={{
          fontFamily: 'var(--font-sans)', fontSize: 'var(--t-h3-fs)', color: 'var(--brand-green)',
          fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 8,
        }}>Noch nichts zum Vorschauen.</h3>
        <p style={{
          fontSize: 'var(--t-small-fs)', color: 'var(--ink-2)', maxWidth: 400,
          lineHeight: 1.65, marginBottom: 28,
        }}>
          Push dein Projekt zu GitHub, dann verbinde Vercel zum Deployen.
          Live-Vorschauen erscheinen hier automatisch.
        </p>

        {/* 3-Schritte-Anleitung */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10, width: '100%', maxWidth: 480, marginBottom: 24,
        }}>
          {[
            { icon: Github, step: '1', label: 'Zu GitHub pushen', desc: 'Im Code-Tab verbinden' },
            { icon: Rocket, step: '2', label: 'Vercel-Token hinzufügen', desc: 'Einstellungen → API-Keys' },
            { icon: Globe,  step: '3', label: 'Auto-Deploy', desc: 'Vorschau erscheint hier' },
          ].map(s => (
            <div key={s.step} style={{
              background: 'var(--surface-1)', border: '1px solid var(--rule)',
              borderRadius: 10, padding: '14px 12px', textAlign: 'left',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--gold-700)',
                  background: 'rgba(212,167,55,0.15)', padding: '1px 6px', borderRadius: 4,
                  letterSpacing: '0.04em',
                }}>SCHRITT {s.step}</span>
                <s.icon size={14} color="var(--ink-3)" />
              </div>
              <div style={{ fontSize: 'var(--t-caption-fs)', fontWeight: 600, color: 'var(--ink-1)', marginBottom: 2 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.4 }}>
                {s.desc}
              </div>
            </div>
          ))}
        </div>

        {/* FIX3-5: primary CTA = the actual next step for THIS account. */}
        {(() => {
          const primaryStyle: React.CSSProperties = {
            background: 'var(--brand-green)', color: '#fff', padding: '10px 20px',
            borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            boxShadow: '0 1px 2px rgba(15,43,30,0.18)',
          };
          const secondaryStyle: React.CSSProperties = {
            background: 'transparent', color: 'var(--brand-green)', padding: '10px 20px',
            borderRadius: 9, fontSize: 13, fontWeight: 500, textDecoration: 'none',
            border: '1.5px solid var(--rule)',
          };

          // Default (status unknown or nothing connected) → add Vercel token.
          if (!conn || (!conn.github && !conn.vercel)) {
            return (
              <div style={{ display: 'flex', gap: 8 }}>
                <Link href="/dashboard/settings/keys" style={primaryStyle}>Vercel-Token hinzufügen →</Link>
                <Link href="/dashboard/settings/integrations" style={secondaryStyle}>GitHub verbinden</Link>
              </div>
            );
          }
          // GitHub missing (Vercel may be connected) → connect GitHub first.
          if (!conn.github) {
            return (
              <div style={{ display: 'flex', gap: 8 }}>
                <Link href="/dashboard/settings/integrations" style={primaryStyle}>GitHub verbinden →</Link>
                {!conn.vercel && <Link href="/dashboard/settings/keys" style={secondaryStyle}>Vercel-Token</Link>}
              </div>
            );
          }
          // GitHub connected, Vercel missing → add the token.
          if (!conn.vercel) {
            return (
              <div style={{ display: 'flex', gap: 8 }}>
                <Link href="/dashboard/settings/keys" style={primaryStyle}>Vercel-Token hinzufügen →</Link>
              </div>
            );
          }
          // Both connected → the real next step is push + deploy from the Code tab.
          return (
            <div style={{ display: 'flex', gap: 8 }}>
              <Link href={`/dashboard/project/${projectId}/work?tab=code`} style={primaryStyle}>Im Code-Tab deployen →</Link>
            </div>
          );
        })()}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        height: 44, background: 'var(--surface-3)',
        borderBottom: '1px solid var(--rule)',
        display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 6, flexShrink: 0,
      }}>
        {/* Viewport switcher */}
        <div style={{ display: 'flex', background: 'var(--surface-1)', border: '1px solid var(--rule)', borderRadius: 7, padding: 2, gap: 1 }}>
          {(['375', '768', '1440'] as Viewport[]).map(v => (
            <button
              key={v}
              onClick={() => setViewport(v)}
              title={v === '375' ? 'Mobil (375px)' : v === '768' ? 'Tablet (768px)' : 'Desktop'}
              style={{
                padding: '4px 10px', borderRadius: 5,
                border: 'none', cursor: 'pointer',
                background: viewport === v ? 'rgba(212,167,55,0.18)' : 'transparent',
                color: viewport === v ? 'var(--gold-700)' : 'var(--ink-3)',
                outline: viewport === v ? '1.5px solid rgba(212,167,55,0.4)' : 'none',
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
          background: 'var(--surface-1)', border: '1px solid var(--rule)',
          borderRadius: 7, padding: '0 10px', height: 30, overflow: 'hidden',
        }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
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

      {/* FIX3-7 (BUG-10): a protected ('manual') deploy shows Vercel's login wall in
          the iframe. We can't detect that cross-origin, so we never leave the user at
          a dead login screen: an honest, always-present escape with a prominent
          "In Vercel öffnen" (the owner is logged in → sees it) + what makes auto-
          publish succeed. The normal ('public') deploy renders fine in the iframe.
          Hidden in demo (Sprint 10): the demo preview is a static inline page, no
          Vercel protection to escape. */}
      {!demoMode && (
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--rule)',
        fontSize: 'var(--t-small-fs)',
        color: 'var(--ink-3)',
        lineHeight: 1.45,
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        <span style={{ flex: 1, minWidth: 180 }}>
          Siehst du statt deiner Seite eine Login-Wand? Dann ist die Vercel-Deployment-
          Protection aktiv — auto-publish gelingt, wenn dein Vercel-Token vollen
          Projekt-Zugriff hat. Öffne sie hier (du bist bei Vercel eingeloggt):
        </span>
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: 'var(--brand-green)', color: '#fff', padding: '6px 14px',
            borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >In Vercel öffnen →</a>
      </div>
      )}

      {/* Iframe area */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'flex-start',
        justifyContent: 'center',
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
          {/* Sandbox: previews are deployed to external origins (Vercel/Netlify),
              so allow-same-origin does not enable framed code to reach this app's
              origin. If previews ever become same-origin to /dashboard,
              allow-same-origin MUST be removed. */}
          <iframe
            key={reloadKey}
            src={previewUrl}
            style={{
              width: '100%', height: '100%', border: 'none',
              opacity: loading ? 0 : 1, transition: 'opacity 0.2s',
            }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            onLoad={() => setLoading(false)}
            title="Projekt-Vorschau"
          />
        </div>
      </div>
    </div>
  );
}