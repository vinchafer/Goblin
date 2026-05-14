import Link from 'next/link';

export function Hero() {
  return (
    <section style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      padding: '120px 24px 80px', position: 'relative', overflow: 'hidden',
      background: 'var(--cream)',
    }}>
      {/* Subtle dot grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
        opacity: 0.6,
      }} />
      {/* Top moss glow — subtle */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '70%', height: '40%', pointerEvents: 'none',
        background: 'radial-gradient(ellipse at top, rgba(45,74,43,0.07) 0%, transparent 70%)',
      }} />

      {/* Beta badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'rgba(201,147,58,0.1)', border: '1px solid rgba(201,147,58,0.3)',
        borderRadius: 100, padding: '5px 14px', fontSize: 11, fontWeight: 600,
        color: 'var(--ochre-dark, #C9933A)', letterSpacing: '0.08em', textTransform: 'uppercase',
        marginBottom: 36, position: 'relative', zIndex: 1,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ochre)', display: 'inline-block' }} />
        Now in beta
      </div>

      <h1 style={{
        fontFamily: 'Fraunces, serif', fontSize: 'clamp(40px, 6vw, 76px)',
        lineHeight: 1.04, fontWeight: 700, color: 'var(--moss)',
        letterSpacing: '-2.5px', marginBottom: 24, maxWidth: 820,
        position: 'relative', zIndex: 1,
      }}>
        Code from anywhere.<br />
        <em style={{ fontStyle: 'italic', color: 'var(--ochre-dark, #C9933A)' }}>Ship from your phone.</em>
      </h1>

      <p style={{
        fontSize: 19, color: 'var(--text-2)', maxWidth: 540, lineHeight: 1.6,
        marginBottom: 40, fontWeight: 400, position: 'relative', zIndex: 1,
      }}>
        Goblin is the AI workshop for builders who don&apos;t want to wait for a laptop.
        Bring your own API keys. Push to GitHub. Deploy to Vercel.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', position: 'relative', zIndex: 1, marginBottom: 64 }}>
        <Link href="/login" style={{
          background: 'var(--moss)', color: '#fff', padding: '13px 28px',
          borderRadius: 9, fontSize: 14, fontWeight: 600, textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontFamily: 'DM Sans, sans-serif', boxShadow: '0 2px 12px rgba(45,74,43,0.25)',
        }}>Start Building &rarr;</Link>
        <a href="#how-it-works" style={{
          background: 'transparent', color: 'var(--meta)', padding: '13px 24px',
          borderRadius: 9, fontSize: 14, fontWeight: 400, textDecoration: 'none',
          border: '1px solid var(--border)',
          fontFamily: 'DM Sans, sans-serif',
        }}>See how it works &darr;</a>
      </div>

      {/* App window mockup */}
      <div style={{
        width: '100%', maxWidth: 900, borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(45,74,43,0.15), 0 0 0 1px var(--border)',
        position: 'relative', zIndex: 1,
      }}>
        {/* Window chrome */}
        <div style={{ background: '#1c1c1a', height: 36, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8 }}>
          {['#ff5f57', '#febc2e', '#28c840'].map(c => (
            <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />
          ))}
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 5, height: 20, margin: '0 12px', display: 'flex', alignItems: 'center', padding: '0 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
            app.justgoblin.com/dashboard
          </div>
        </div>
        {/* App layout */}
        <div style={{ background: '#F7F4ED', display: 'grid', gridTemplateColumns: '180px 1fr 260px', height: 340 }}>
          {/* Sidebar */}
          <div style={{ background: '#f7f3ec', borderRight: '1px solid #e4ddd2', padding: 12 }}>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 16, color: 'var(--moss)', fontWeight: 700, paddingBottom: 10, borderBottom: '1px solid #e4ddd2', marginBottom: 10 }}>
              Goblin<span style={{ color: 'var(--ochre)' }}>.</span>
            </div>
            {([['var(--ochre-dark)', 'MyStartup', true], ['var(--success)', 'NewsletterAI', false], ['#7a4a8a', 'LeadMagnet', false]] as [string, string, boolean][]).map(([c, n, a]) => (
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
                    <span style={{ color: 'var(--ochre-dark)' }}>export function</span> <span style={{ color: '#7dd3a8' }}>Navbar</span>()&nbsp;{'{'}..<br />{'}'  }
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--ochre)', color: 'var(--bark)', borderRadius: 6, padding: '5px 11px', fontSize: 11, fontWeight: 600 }}>Send to Code</div>
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
