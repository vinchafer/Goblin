const STEPS = [
  { icon: '📱', label: 'Open Goblin', sub: 'Santorini', highlight: false },
  { icon: '💬', label: 'Chat with AI', sub: 'describe it', highlight: false },
  { icon: '→', label: 'Send to Code', sub: 'one tap', highlight: true },
  { icon: '🔨', label: 'Build', sub: 'you decide', highlight: false },
  { icon: '🐙', label: 'Push to GitHub', sub: 'auto push', highlight: false },
  { icon: '▲', label: 'Vercel', sub: '~34 seconds', highlight: false },
  { icon: '🔔', label: 'Live', sub: 'push notif ✓', highlight: true },
  { icon: '🌐', label: 'Preview', sub: 'tap to see', highlight: false },
];

export function IslandFlow() {
  return (
    <section id="how-it-works" style={{ background: '#0e0e0c', padding: '100px 40px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 72 }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase' as const, color: 'var(--ochre)', marginBottom: 16 }}>The island flow</div>
          <h2 style={{
            fontFamily: 'Fraunces, serif', fontSize: 'clamp(36px, 5vw, 56px)',
            color: '#fff', lineHeight: 1.05, letterSpacing: '-2px', fontWeight: 900, marginBottom: 16,
          }}>
            From beach to{' '}<em style={{ fontStyle: 'italic', color: 'var(--ochre)' }}>deployed.</em>
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6, fontWeight: 300 }}>
            Build your SaaS from Santorini. No laptop. No copy-paste. No token panic.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 6 }}>
          {STEPS.map((s, i) => (
            <div key={s.label} style={{ display: 'contents' }}>
              <div style={{
                background: s.highlight ? 'rgba(201,147,58,0.08)' : '#1a1a18',
                border: `1px solid ${s.highlight ? 'var(--ochre)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 12, padding: '18px 22px', textAlign: 'center',
                minWidth: 100, transition: 'all 0.15s',
                boxShadow: s.highlight ? '0 0 24px rgba(201,147,58,0.12)' : 'none',
              }}>
                <div style={{ fontSize: 22, marginBottom: 8, color: s.highlight ? 'var(--ochre)' : 'inherit' }}>{s.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: s.highlight ? 'var(--ochre)' : 'rgba(255,255,255,0.7)', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{s.sub}</div>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ color: 'rgba(255,255,255,0.12)', fontSize: 14, flexShrink: 0 }}>→</div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom label */}
        <div style={{ textAlign: 'center', marginTop: 56 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 13,
            color: 'rgba(255,255,255,0.3)', fontWeight: 300,
          }}>
            <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
            Works on any device, from anywhere
            <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
          </div>
        </div>
      </div>
    </section>
  );
}
