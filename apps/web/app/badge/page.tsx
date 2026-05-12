export const metadata = { title: 'Built with Goblin — Badge' };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://justgoblin.com';

const BADGES = [
  {
    id: 'standard',
    label: 'Standard',
    bg: 'var(--subtle)',
    src: '/badge.svg',
    html: `<a href="${APP_URL}" target="_blank" rel="noopener"><img src="${APP_URL}/badge.svg" alt="Built with Goblin" width="140" height="28" /></a>`,
    md: `[![Built with Goblin](${APP_URL}/badge.svg)](${APP_URL})`,
  },
  {
    id: 'dark',
    label: 'Dark',
    bg: '#1a1e18',
    src: '/badge-dark.svg',
    html: `<a href="${APP_URL}" target="_blank" rel="noopener"><img src="${APP_URL}/badge-dark.svg" alt="Built with Goblin" width="140" height="28" /></a>`,
    md: `[![Built with Goblin](${APP_URL}/badge-dark.svg)](${APP_URL})`,
  },
  {
    id: 'minimal',
    label: 'Minimal',
    bg: 'var(--subtle)',
    src: '/badge-minimal.svg',
    html: `<a href="${APP_URL}" target="_blank" rel="noopener"><img src="${APP_URL}/badge-minimal.svg" alt="Built with Goblin" width="100" height="22" /></a>`,
    md: `[![Built with Goblin](${APP_URL}/badge-minimal.svg)](${APP_URL})`,
  },
];

function CodeBlock({ code }: { code: string }) {
  return (
    <div style={{
      background: 'var(--code-bg)', borderRadius: 8,
      padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace',
      fontSize: 12, color: 'var(--code-fg)',
      overflowX: 'auto', marginTop: 8,
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{code}</pre>
    </div>
  );
}

export default function BadgePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', fontFamily: 'DM Sans, sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'var(--moss)', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', gap: 10 }}>
        <a href="/" style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 700, color: 'var(--ochre)', textDecoration: 'none' }}>👺 Goblin</a>
        <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 8, fontSize: 13 }}>/ Badge</span>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '56px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 36, fontWeight: 700, color: 'var(--moss)', letterSpacing: '-1px', marginBottom: 12 }}>
            Built with Goblin
          </h1>
          <p style={{ fontSize: 16, color: 'var(--meta)', lineHeight: 1.6 }}>
            Built something with Goblin? Show it off. Drop a badge in your README or footer.
          </p>
        </div>

        {BADGES.map(badge => (
          <div key={badge.id} style={{
            background: 'var(--panel)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '24px 28px', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 17, fontWeight: 700, color: 'var(--moss)' }}>{badge.label}</h2>
            </div>

            {/* Preview */}
            <div style={{
              background: badge.bg, borderRadius: 10, padding: '24px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 20, border: '1px solid var(--div)',
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={badge.src} alt="Built with Goblin" style={{ display: 'block' }} />
            </div>

            {/* HTML embed */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--meta)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>HTML</div>
              <CodeBlock code={badge.html} />
            </div>

            {/* Markdown embed */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--meta)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Markdown</div>
              <CodeBlock code={badge.md} />
            </div>
          </div>
        ))}

        {/* Direct badge URL */}
        <div style={{
          background: 'var(--subtle)', borderRadius: 12, padding: '20px 24px',
          border: '1px solid var(--div)', marginTop: 32,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Direct badge URLs</div>
          {[
            { label: 'Standard', url: `${APP_URL}/badge.svg` },
            { label: 'Dark', url: `${APP_URL}/badge-dark.svg` },
            { label: 'Minimal', url: `${APP_URL}/badge-minimal.svg` },
          ].map(b => (
            <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--meta)', width: 60, flexShrink: 0 }}>{b.label}</span>
              <code style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--moss)', background: 'var(--div)', padding: '2px 8px', borderRadius: 4 }}>
                {b.url}
              </code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
