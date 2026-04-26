export function Footer() {
  const cols = [
    { title: 'Product', links: ['Pricing','FAQ','Changelog'] },
    { title: 'Community', links: ['Discord','Twitter / X','GitHub'] },
    { title: 'Legal', links: ['Terms','Privacy','Imprint'] },
  ];
  return (
    <footer style={{ background: 'var(--moss)', padding: '60px 40px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' as const, gap: 32, maxWidth: 1000, margin: '0 auto 48px' }}>
        <div>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 28, color: 'var(--ochre)', fontWeight: 700, marginBottom: 8 }}>Goblin.</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', maxWidth: 220, lineHeight: 1.5, fontWeight: 300 }}>The cloud workshop for builders who ship from anywhere.</div>
        </div>
        <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' as const }}>
          {cols.map(col => (
            <div key={col.title} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5, textTransform: 'uppercase' as const, fontWeight: 500, marginBottom: 4 }}>{col.title}</div>
              {col.links.map(l => <a key={l} href="#" style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>{l}</a>)}
            </div>
          ))}
        </div>
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.25)', maxWidth: 1000, margin: '0 auto' }}>
        <span>© 2026 Goblin. All rights reserved.</span>
        <span>Built with a goblin 👺</span>
      </div>
    </footer>
  );
}
