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
    <footer style={{ background: 'var(--moss)', padding: '64px 40px 40px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 40, marginBottom: 56 }}>
          {/* Brand */}
          <div style={{ maxWidth: 220 }}>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 28, color: 'var(--ochre)', fontWeight: 700, marginBottom: 10 }}>Goblin.</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, fontWeight: 300 }}>
              The cloud workshop for builders who ship from anywhere.
            </div>
            <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
              {['Discord', 'X', 'GitHub'].map(s => (
                <a key={s} href="#" style={{
                  width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: 'rgba(255,255,255,0.4)', textDecoration: 'none',
                  background: 'rgba(255,255,255,0.04)', transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.25)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}
                >{s[0]}</a>
              ))}
            </div>
          </div>

          {/* Nav cols */}
          <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
            {COLS.map(col => (
              <div key={col.title} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>{col.title}</div>
                {col.links.map(l => (
                  <a key={l.label} href={l.href} style={{
                    fontSize: 13, color: 'rgba(255,255,255,0.5)', textDecoration: 'none', transition: 'color 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                  >{l.label}</a>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          <span>© 2026 Goblin. All rights reserved.</span>
          <span>Built with a goblin 👺</span>
        </div>
      </div>
    </footer>
  );
}
