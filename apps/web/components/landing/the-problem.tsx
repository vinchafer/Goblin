export function TheProblem() {
  const items = [
    { icon: '⚡', title: 'Token panic', desc: 'Claude Pro locks you out after 2 hours. Counting tokens instead of shipping.' },
    { icon: '💻', title: 'Hardware wall', desc: 'Powerful models need 48GB+ VRAM. Your laptop simply does not have it.' },
    { icon: '📋', title: 'Copy-paste hell', desc: 'Chat → copy → switch tabs → paste → find the right file. Every. Single. Time.' },
    { icon: '🔩', title: 'IDE overwhelm', desc: 'Cursor and VS Code were not built for builders who just want to ship fast.' },
  ];
  return (
    <section id="why-goblin" style={{ background: 'var(--moss)', padding: '100px 40px' }}>
      <div style={{ textAlign: 'center', marginBottom: 64 }}>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase' as const, color: 'var(--ochre)', marginBottom: 16 }}>The problem</div>
        <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 'clamp(36px,5vw,56px)', color: '#fff', lineHeight: 1.05, letterSpacing: '-2px', fontWeight: 900, marginBottom: 16 }}>
          Building with AI<br />should not feel like this.
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6, fontWeight: 300 }}>
          Four walls every builder hits. Goblin removes all of them.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, maxWidth: 1000, margin: '0 auto' }}>
        {items.map(p => (
          <div key={p.title} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 28 }}>
            <div style={{ fontSize: 24, marginBottom: 14 }}>{p.icon}</div>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, color: '#fff', fontWeight: 700, marginBottom: 8, letterSpacing: '-0.5px' }}>{p.title}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, fontWeight: 300 }}>{p.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
