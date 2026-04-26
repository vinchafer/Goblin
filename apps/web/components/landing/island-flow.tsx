export function IslandFlow() {
  const steps = [
    { icon: '📱', label: 'Open Goblin', sub: 'Santorini', highlight: false },
    { icon: '💬', label: 'Chat/Voice', sub: 'describe it', highlight: false },
    { icon: '→', label: 'Send to Code', sub: 'one tap', highlight: true },
    { icon: '🔨', label: 'Build', sub: 'you decide', highlight: false },
    { icon: '🐙', label: 'GitHub', sub: 'auto push', highlight: false },
    { icon: '▲', label: 'Vercel', sub: '~34 seconds', highlight: false },
    { icon: '🔔', label: 'Push Notif', sub: 'live ✓', highlight: true },
    { icon: '🌐', label: 'Preview', sub: 'tap to see', highlight: false },
  ];
  return (
    <section id="how-it-works" style={{ background: '#111', padding: '100px 40px' }}>
      <div style={{ textAlign: 'center', marginBottom: 64 }}>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase' as const, color: 'var(--ochre)', marginBottom: 16 }}>The island flow</div>
        <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 'clamp(36px,5vw,56px)', color: '#fff', lineHeight: 1.05, letterSpacing: '-2px', fontWeight: 900, marginBottom: 16 }}>
          From beach to <em style={{ fontStyle: 'italic', color: 'var(--ochre)' }}>deployed.</em>
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6, fontWeight: 300 }}>
          Build your SaaS from Santorini. No laptop. No copy-paste. No token panic.
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' as const, gap: 6, maxWidth: 1100, margin: '0 auto' }}>
        {steps.map((s, i) => (
          <div key={s.label} style={{ display: 'contents' }}>
            <div style={{
              background: s.highlight ? 'rgba(201,147,58,0.08)' : '#1a1a18',
              border: `1px solid ${s.highlight ? 'var(--ochre)' : '#222'}`,
              borderRadius: 10, padding: '16px 20px', textAlign: 'center' as const, minWidth: 96,
            }}>
              <div style={{ fontSize: 20, marginBottom: 6, color: s.highlight ? 'var(--ochre)' : 'inherit' }}>{s.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 500, color: s.highlight ? 'var(--ochre)' : '#aaa' }}>{s.label}</div>
              <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{s.sub}</div>
            </div>
            {i < steps.length - 1 && <div style={{ color: '#2d4a2b', fontSize: 14 }}>→</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
