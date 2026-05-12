const CODE_LINES = [
  'export function Navbar() {',
  '  const [dark, setDark] = useState(false)',
  '  const toggle = () => setDark(d => !d)',
  '  return <nav>...</nav>',
  '}',
];

export function SendToCodeDemo() {
  return (
    <section style={{ background: 'var(--cream2)', padding: '100px 40px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--ochre)', marginBottom: 16, fontFamily: 'DM Sans, sans-serif' }}>Core feature</div>
          <h2 style={{
            fontFamily: 'Fraunces, serif', fontSize: 'clamp(28px, 4vw, 44px)',
            color: 'var(--moss)', lineHeight: 1.1, letterSpacing: '-1.5px', fontWeight: 700, marginBottom: 16,
          }}>
            No more copy-paste.
          </h2>
          <p style={{ fontSize: 16, color: 'var(--meta)', maxWidth: 460, margin: '0 auto', lineHeight: 1.65, fontWeight: 400, fontFamily: 'DM Sans, sans-serif' }}>
            One tap sends AI code directly to your editor. No clipboard. No switching tabs.
          </p>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.07)',
        }} className="send-to-code-grid">
          {/* Chat panel */}
          <div style={{ background: '#fff', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: 'var(--moss)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: 'Fraunces, serif', color: 'var(--ochre)', fontSize: 15, fontWeight: 700 }}>Goblin Chat</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', background: 'rgba(201,147,58,0.15)', border: '1px solid rgba(201,147,58,0.4)', color: '#e8b05a', padding: '2px 8px', borderRadius: 20 }}>claude-sonnet-4-6</span>
            </div>
            <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ alignSelf: 'flex-end', background: 'var(--moss)', color: 'rgba(255,255,255,0.9)', borderRadius: 10, padding: '9px 14px', fontSize: 13, maxWidth: '85%' }}>
                Add a dark mode toggle to the navbar
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--moss)', color: 'var(--ochre)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>G</div>
                <div style={{ background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
                  Done! Here is the updated Navbar:
                  <div style={{ background: '#1a2018', borderRadius: 8, padding: '10px 12px', margin: '8px 0', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#8aaa85', lineHeight: 1.7 }}>
                    <span style={{ color: 'var(--ochre-dark)' }}>export function</span> <span style={{ color: '#7dd3a8' }}>Navbar</span>() {'{'}<br />
                    &nbsp;&nbsp;<span style={{ color: 'var(--ochre-dark)' }}>const</span> [dark, setDark] = useState(false)<br />
                    &nbsp;&nbsp;<span style={{ color: 'var(--ochre-dark)' }}>return</span> &lt;<span style={{ color: '#7dd3a8' }}>nav</span>&gt;...&lt;/<span style={{ color: '#7dd3a8' }}>nav</span>&gt;<br />
                    {'}'}
                  </div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'var(--success)', color: '#fff',
                    borderRadius: 7, padding: '7px 14px', fontSize: 13, fontWeight: 600,
                    fontFamily: 'DM Sans, sans-serif',
                  }}>
                    Sent to editor
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Code panel */}
          <div style={{ background: '#141a12', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#0f1410', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #1e2a1c' }}>
              <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', padding: '3px 10px', borderRadius: 4, background: '#1e2a1c', color: '#7aaa75', border: '1px solid #2d4a2b' }}>Navbar.tsx</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: 'var(--ochre)', background: 'rgba(201,147,58,0.1)', border: '1px solid rgba(201,147,58,0.25)', borderRadius: 5, padding: '3px 10px' }}>
                Injected
              </span>
            </div>
            <div style={{ flex: 1, padding: '14px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, lineHeight: 1.8 }}>
              <span style={{ color: '#3d6038' }}>// Navbar.tsx &mdash; injected</span><br />
              <span style={{ color: 'var(--ochre-dark)' }}>import</span> <span style={{ color: '#8aaa85' }}>{'{ useState }'}</span> <span style={{ color: 'var(--ochre-dark)' }}>from</span> <span style={{ color: '#98c379' }}>&apos;react&apos;</span><br /><br />
              {CODE_LINES.map((line, i) => (
                <span key={i} style={{ display: 'block', background: 'rgba(201,147,58,0.07)', borderLeft: '2px solid var(--ochre)', margin: '0 -16px', padding: '1px 16px', color: '#8aaa85' }}>{line}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 640px) { .send-to-code-grid { grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}
