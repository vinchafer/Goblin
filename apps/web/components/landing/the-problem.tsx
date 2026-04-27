'use client';

const PROBLEMS = [
  {
    icon: '⚡',
    title: 'Token panic',
    desc: 'Claude Pro locks you out after 2 hours. You end up counting tokens instead of shipping.',
    fix: 'Fair-use unlimited inference',
  },
  {
    icon: '💻',
    title: 'Hardware wall',
    desc: 'Powerful models need 48GB+ VRAM. Your laptop cannot run them locally.',
    fix: 'Cloud-hosted GPU inference',
  },
  {
    icon: '📋',
    title: 'Copy-paste hell',
    desc: 'Chat → copy → switch tabs → paste → find the right file. Every. Single. Time.',
    fix: 'One-tap Send to Code',
  },
  {
    icon: '🔩',
    title: 'IDE overwhelm',
    desc: 'Cursor and VS Code were not built for builders who just want to ship fast.',
    fix: 'Focused builder UI',
  },
];

export function TheProblem() {
  return (
    <section id="why-goblin" style={{ background: 'var(--moss)', padding: '100px 40px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase' as const, color: 'var(--ochre)', marginBottom: 16 }}>The problem</div>
          <h2 style={{
            fontFamily: 'Fraunces, serif', fontSize: 'clamp(36px, 5vw, 56px)',
            color: '#fff', lineHeight: 1.05, letterSpacing: '-2px', fontWeight: 900, marginBottom: 16,
          }}>
            Building with AI<br />should not feel like this.
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6, fontWeight: 300 }}>
            Four walls every builder hits. Goblin removes all of them.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 20 }}>
          {PROBLEMS.map(p => (
            <div key={p.title} style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, padding: 28, display: 'flex', flexDirection: 'column', gap: 0,
            }}>
              <div style={{ fontSize: 28, marginBottom: 16 }}>{p.icon}</div>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, color: '#fff', fontWeight: 700, marginBottom: 8, letterSpacing: '-0.5px' }}>{p.title}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.65, fontWeight: 300, marginBottom: 20, flex: 1 }}>{p.desc}</div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 500,
                color: 'var(--ochre)', background: 'rgba(201,147,58,0.1)', border: '1px solid rgba(201,147,58,0.2)',
                borderRadius: 100, padding: '4px 12px', alignSelf: 'flex-start',
              }}>
                <span style={{ fontSize: 8 }}>✓</span> {p.fix}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
