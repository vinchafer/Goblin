import Link from 'next/link';

export function Hero() {
  return (
    <section style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      padding: '120px 24px 80px', position: 'relative', overflow: 'hidden',
      background: 'var(--cream)',
    }}>
      {/* Grid background */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(30,58,28,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(30,58,28,0.04) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />
      {/* Radial glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(30,58,28,0.1) 0%, transparent 70%)',
      }} />

      {/* Beta badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'rgba(201,147,58,0.1)', border: '1px solid rgba(201,147,58,0.3)',
        borderRadius: 100, padding: '6px 16px', fontSize: 11, fontWeight: 500,
        color: 'var(--ochre)', letterSpacing: '0.5px', textTransform: 'uppercase',
        marginBottom: 32, position: 'relative', zIndex: 1,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ochre)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
        Now in beta
      </div>

      <h1 style={{
        fontFamily: 'Fraunces, serif', fontSize: 'clamp(48px, 7vw, 88px)',
        lineHeight: 1.0, fontWeight: 900, color: 'var(--moss)',
        letterSpacing: '-3px', marginBottom: 24, maxWidth: 860,
        position: 'relative', zIndex: 1,
      }}>
        Build from{' '}<em style={{ fontStyle: 'italic', color: 'var(--ochre)' }}>anywhere.</em>
        <br />Ship everything.
      </h1>

      <p style={{
        fontSize: 18, color: 'var(--meta)', maxWidth: 520, lineHeight: 1.65,
        marginBottom: 48, fontWeight: 300, position: 'relative', zIndex: 1,
      }}>
        Your AI workshop in the cloud. No token panic. No laptop limits.
        Your goblin handles the rest.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 24, position: 'relative', zIndex: 1 }}>
        <Link href="/login" style={{
          background: 'var(--moss)', color: '#fff', padding: '14px 28px',
          borderRadius: 10, fontSize: 15, fontWeight: 500, textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 16px rgba(30,58,28,0.25)',
        }}>Start building free →</Link>
        <a href="#how-it-works" style={{
          background: 'transparent', color: 'var(--text)', padding: '14px 24px',
          borderRadius: 10, fontSize: 15, fontWeight: 400, textDecoration: 'none',
          border: '1px solid rgba(0,0,0,0.12)',
        }}>See how it works</a>
      </div>

      <p style={{ fontSize: 13, color: 'var(--meta)', position: 'relative', zIndex: 1, marginBottom: 64 }}>
        Fair-use unlimited inference · BYOK support · GitHub push built-in
      </p>

      {/* App window mockup */}
      <div style={{
        width: '100%', maxWidth: 900, borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 40px 120px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.08)',
        position: 'relative', zIndex: 1,
      }}>
        {/* Window chrome */}
        <div style={{ background: '#1c1c1a', height: 36, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8 }}>
          {['#ff5f57', '#febc2e', '#28c840'].map(c => (
            <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />
          ))}
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 5, height: 20, margin: '0 12px', display: 'flex', alignItems: 'center', padding: '0 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
            🔒 app.justgoblin.com/dashboard
          </div>
        </div>
        {/* App layout */}
        <div style={{ background: '#fff', display: 'grid', gridTemplateColumns: '180px 1fr 260px', height: 340 }}>
          {/* Sidebar */}
          <div style={{ background: '#f7f3ec', borderRight: '1px solid #e4ddd2', padding: 12 }}>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 16, color: 'var(--moss)', fontWeight: 700, paddingBottom: 10, borderBottom: '1px solid #e4ddd2', marginBottom: 10 }}>
              Goblin<span style={{ color: 'var(--ochre)' }}>.</span>
            </div>
            {([['#c9933a', 'MyStartup', true], ['#4a7c3b', 'NewsletterAI', false], ['#7a4a8a', 'LeadMagnet', false]] as [string, string, boolean][]).map(([c, n, a]) => (
              <div key={n} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 7, marginBottom: 3,
                background: a ? 'rgba(201,147,58,0.1)' : 'transparent',
                border: a ? '1px solid rgba(201,147,58,0.2)' : '1px solid transparent',
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)' }}>{n}</span>
              </div>
            ))}
          </div>
          {/* Chat */}
          <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #e4ddd2' }}>
            <div style={{ background: 'var(--moss)', height: 44, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8, flexShrink: 0 }}>
              <span style={{ fontFamily: 'Fraunces, serif', color: 'var(--ochre)', fontSize: 15, fontWeight: 700 }}>Goblin.</span>
              {['Chat', 'Code', 'Preview'].map((t, i) => (
                <span key={t} style={{ padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: 500, background: i === 0 ? 'rgba(255,255,255,0.12)' : 'transparent', color: i === 0 ? '#fff' : 'rgba(255,255,255,0.45)' }}>{t}</span>
              ))}
            </div>
            <div style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
              <div style={{ alignSelf: 'flex-end', background: 'var(--moss)', color: 'rgba(255,255,255,0.9)', borderRadius: 10, padding: '8px 12px', fontSize: 11, maxWidth: '85%' }}>
                Add dark mode toggle to navbar
              </div>
              <div style={{ display: 'flex', gap: 7 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--moss)', color: 'var(--ochre)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>G</div>
                <div style={{ background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 11 }}>
                  Done! Here is the updated Navbar:
                  <div style={{ background: '#1a2018', borderRadius: 6, padding: '7px 9px', margin: '6px 0', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#8aaa85', lineHeight: 1.6 }}>
                    <span style={{ color: '#c9933a' }}>export function</span> <span style={{ color: '#7dd3a8' }}>Navbar</span>()&nbsp;{'{'}..<br />{'}'  }
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--ochre)', color: 'var(--bark)', borderRadius: 6, padding: '5px 11px', fontSize: 11, fontWeight: 600 }}>→ Send to Code</div>
                </div>
              </div>
            </div>
          </div>
          {/* Code */}
          <div style={{ background: '#141a12', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#0f1410', padding: '8px 12px', display: 'flex', gap: 5, borderBottom: '1px solid #1e2a1c' }}>
              <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', padding: '2px 8px', borderRadius: 4, background: '#1e2a1c', color: '#7aaa75', border: '1px solid #2d4a2b' }}>Navbar.tsx</span>
            </div>
            <div style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#5a8a55', lineHeight: 1.8 }}>
              <span style={{ color: '#3d6038' }}>// injected via Send to Code</span><br />
              {['export function Navbar() {', '  const [dark, setDark] = useState(false)', '  const toggle = () => setDark(d => !d)', '  return <nav>...</nav>', '}'].map((line, i) => (
                <span key={i} style={{ display: 'block', background: 'rgba(201,147,58,0.07)', borderLeft: '2px solid #c9933a', margin: '2px -12px', padding: '0 12px', color: '#8aaa85' }}>{line}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
