import { DeviceMobile, ChatCircle, Code, Terminal, GitBranch, TriangleDashed, BellRinging, Globe } from '@phosphor-icons/react/dist/ssr';

const STEPS = [
  { Icon: DeviceMobile, label: 'Open Goblin', sub: 'On your phone, tablet, or laptop' },
  { Icon: ChatCircle, label: 'Chat with AI', sub: 'Describe what you want to build' },
  { Icon: Code, label: 'Send to Code', sub: 'One tap. No copy-paste.' },
  { Icon: Terminal, label: 'Build', sub: 'You decide what runs and when' },
  { Icon: GitBranch, label: 'Push to GitHub', sub: 'Automatic, with commit messages' },
  { Icon: TriangleDashed, label: 'Deploy to Vercel', sub: '~34 seconds, every time' },
  { Icon: BellRinging, label: 'Live notification', sub: 'Push to your phone when it ships' },
  { Icon: Globe, label: 'Preview', sub: 'Tap to see your live site' },
];

export function IslandFlow() {
  return (
    <section id="how-it-works" style={{ background: '#0e0e0c', padding: '100px 24px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase' as const, color: 'var(--ochre)', marginBottom: 16 }}>The island flow</div>
          <h2 style={{
            fontFamily: 'Fraunces, serif', fontSize: 'clamp(32px, 5vw, 48px)',
            color: '#fff', lineHeight: 1.05, letterSpacing: '-1.5px', fontWeight: 700, marginBottom: 16,
          }}>
            From beach to{' '}<em style={{ fontStyle: 'italic', color: 'var(--ochre)' }}>deployed.</em>
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6, fontWeight: 300 }}>
            Build your SaaS from Santorini. No laptop. No copy-paste. No token panic.
          </p>
        </div>

        <div style={{ position: 'relative', maxWidth: 560, margin: '0 auto' }}>
          {/* Vertical connector line */}
          <div style={{
            position: 'absolute',
            left: 24, top: 30, bottom: 30,
            width: 2,
            background: 'linear-gradient(180deg, transparent 0%, rgba(201,147,58,0.5) 10%, rgba(201,147,58,0.5) 90%, transparent 100%)',
          }} />

          {STEPS.map((s, i) => (
            <div key={s.label} style={{
              display: 'flex', alignItems: 'flex-start', gap: 20,
              marginBottom: i < STEPS.length - 1 ? 28 : 0,
              position: 'relative', zIndex: 1,
            }}>
              <div style={{
                width: 50, height: 50, flexShrink: 0,
                background: '#1a1a18',
                border: '1px solid rgba(201,147,58,0.35)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <s.Icon size={22} weight="duotone" color="var(--ochre)" />
              </div>
              <div style={{ paddingTop: 6 }}>
                <h4 style={{
                  fontFamily: 'DM Sans, sans-serif', fontSize: 17, fontWeight: 600,
                  color: '#fff', margin: 0, marginBottom: 4, lineHeight: 1.2,
                }}>{s.label}</h4>
                <p style={{
                  color: 'rgba(255,255,255,0.45)', fontSize: 14, margin: 0, lineHeight: 1.45,
                  fontFamily: 'DM Sans, sans-serif',
                }}>{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

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
