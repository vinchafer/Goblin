'use client';

const COLS = [
  {
    title: 'Product',
    links: [
      { label: 'Pricing', href: '#pricing' },
      { label: 'FAQ', href: '#faq' },
      { label: 'Changelog', href: '#' },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'Discord', href: '#' },
      { label: 'Twitter / X', href: '#' },
      { label: 'GitHub', href: '#' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Imprint', href: '/imprint' },
    ],
  },
];

export function Footer() {
  return (
    <footer style={{ background: 'var(--subtle)', borderTop: '1px solid var(--div)', padding: '64px 40px 40px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 40, marginBottom: 56 }}>
          {/* Brand */}
          <div style={{ maxWidth: 220 }}>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 28, color: 'var(--moss)', fontWeight: 700, marginBottom: 10 }}>Goblin.</div>
            <div style={{ fontSize: 13, color: 'var(--meta)', lineHeight: 1.6, fontWeight: 400 }}>
              The cloud workshop for builders who ship from anywhere.
            </div>
            <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { label: 'Discord', href: 'https://discord.gg/goblin' },
                { label: 'Twitter', href: 'https://twitter.com/justgoblin' },
                { label: 'GitHub',  href: 'https://github.com/justgoblin' },
              ].map(s => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" style={{
                  padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
                  display: 'inline-flex', alignItems: 'center',
                  fontSize: 12, color: 'var(--meta)', textDecoration: 'none',
                  background: 'var(--panel)', transition: 'all 0.15s',
                  fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--moss)'; (e.currentTarget as HTMLElement).style.color = 'var(--moss)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--meta)'; }}
                >{s.label}</a>
              ))}
            </div>
          </div>

          {/* Nav cols */}
          <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
            {COLS.map(col => (
              <div key={col.title} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text)', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>{col.title}</div>
                {col.links.map(l => (
                  <a key={l.label} href={l.href} style={{
                    fontSize: 13, color: 'var(--meta)', textDecoration: 'none', transition: 'color 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--meta)')}
                  >{l.label}</a>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: '1px solid var(--div)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, fontSize: 12, color: 'var(--meta)' }}>
          <span>© 2026 Goblin · Made in Switzerland 🇨🇭</span>
          <span style={{ color: 'var(--meta)' }}>Build anywhere. Code anything.</span>
        </div>
      </div>
    </footer>
  );
}
